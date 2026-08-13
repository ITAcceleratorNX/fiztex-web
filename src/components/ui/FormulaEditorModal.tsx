import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Formula } from './MathText';
import { hasForbiddenCommand, stripPlaceholders } from '@/lib/mathMarkup';

/**
 * Визуальный редактор одной формулы (ТЗ §4: «знание LaTeX от учителя не требуется»).
 *
 * <p>Ввод — MathLive: учитель видит саму формулу, а не разметку, и правит её как в редакторе
 * формул Word. Палитра вставляет школьные шаблоны, предпросмотр показывает результат тем же
 * компонентом, которым он отрисуется у ученика.
 *
 * <p>MathLive подгружается динамическим `import()` только при открытии окна: это ~1 МБ,
 * которому нечего делать в основном бандле админки. Если загрузка не удалась, окно остаётся
 * рабочим — остаётся поле разметки, палитра и предпросмотр.
 */

type Snippet = { label: string; latex: string; insert: string };

/** Шаблоны школьной математики и физики 1–11. `#?` — место, куда MathLive ставит курсор. */
const PALETTE: { title: string; items: Snippet[] }[] = [
  {
    title: 'Числа и действия',
    items: [
      { label: 'дробь', latex: '\\frac{a}{b}', insert: '\\frac{#?}{#?}' },
      { label: 'степень', latex: 'a^{n}', insert: '#?^{#?}' },
      { label: 'индекс', latex: 'a_{n}', insert: '#?_{#?}' },
      { label: 'корень', latex: '\\sqrt{a}', insert: '\\sqrt{#?}' },
      { label: 'корень n-й', latex: '\\sqrt[n]{a}', insert: '\\sqrt[#?]{#?}' },
      { label: 'модуль', latex: '|a|', insert: '\\left|#?\\right|' },
      { label: 'умножение', latex: '\\cdot', insert: '\\cdot ' },
      { label: 'деление', latex: '\\div', insert: '\\div ' },
      { label: 'плюс-минус', latex: '\\pm', insert: '\\pm ' },
    ],
  },
  {
    title: 'Сравнения и системы',
    items: [
      { label: 'меньше или равно', latex: '\\le', insert: '\\le ' },
      { label: 'больше или равно', latex: '\\ge', insert: '\\ge ' },
      { label: 'не равно', latex: '\\ne', insert: '\\ne ' },
      { label: 'приблизительно', latex: '\\approx', insert: '\\approx ' },
      { label: 'система', latex: '\\begin{cases} x \\\\ y \\end{cases}', insert: '\\begin{cases} #? \\\\ #? \\end{cases}' },
      { label: 'матрица', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', insert: '\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}' },
    ],
  },
  {
    title: 'Функции и анализ',
    items: [
      { label: 'логарифм', latex: '\\log_{a} b', insert: '\\log_{#?}{#?}' },
      { label: 'натуральный логарифм', latex: '\\ln a', insert: '\\ln #?' },
      { label: 'синус', latex: '\\sin \\alpha', insert: '\\sin #?' },
      { label: 'косинус', latex: '\\cos \\alpha', insert: '\\cos #?' },
      { label: 'тангенс', latex: '\\tg \\alpha', insert: '\\tg #?' },
      { label: 'предел', latex: '\\lim_{x \\to 0}', insert: '\\lim_{#? \\to #?}' },
      { label: 'сумма', latex: '\\sum_{i=1}^{n}', insert: '\\sum_{#?}^{#?}' },
      { label: 'интеграл', latex: '\\int_{a}^{b}', insert: '\\int_{#?}^{#?}' },
      { label: 'производная', latex: "f'(x)", insert: "#?'" },
    ],
  },
  {
    title: 'Физика и обозначения',
    items: [
      { label: 'вектор', latex: '\\vec{F}', insert: '\\vec{#?}' },
      { label: 'градусы', latex: '20^\\circ', insert: '^\\circ ' },
      { label: 'пи', latex: '\\pi', insert: '\\pi ' },
      { label: 'альфа', latex: '\\alpha', insert: '\\alpha ' },
      { label: 'бета', latex: '\\beta', insert: '\\beta ' },
      { label: 'ро', latex: '\\rho', insert: '\\rho ' },
      { label: 'мю', latex: '\\mu', insert: '\\mu ' },
      { label: 'дельта', latex: '\\Delta', insert: '\\Delta ' },
      { label: 'омега', latex: '\\Omega', insert: '\\Omega ' },
      { label: 'текст в формуле', latex: '\\text{кг}', insert: '\\text{#?}' },
    ],
  },
];

export function FormulaEditorModal({
  open,
  initialLatex = '',
  initialDisplay = false,
  onClose,
  onSave,
}: {
  open: boolean;
  initialLatex?: string;
  initialDisplay?: boolean;
  onClose: () => void;
  /** Возвращает разметку формулы без разделителей — их ставит вызывающая сторона. */
  onSave: (latex: string, display: boolean) => void;
}) {
  const [latex, setLatex] = useState(initialLatex);
  const [display, setDisplay] = useState(initialDisplay);
  const [visualReady, setVisualReady] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<MathfieldLike | null>(null);
  // Значение, которое пришло из самого поля: не пишем его обратно и не сбиваем курсор.
  const fromFieldRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLatex(initialLatex);
    setDisplay(initialDisplay);
  }, [open, initialLatex, initialDisplay]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let field: MathfieldLike | null = null;

    void (async () => {
      try {
        const mathlive = await import('mathlive');
        if (cancelled) return;
        // Шрифты уже объявлены katex.min.css (MathLive использует те же KaTeX_*), звуки
        // нажатий здесь не нужны — иначе оба каталога запрашивались бы с 404.
        mathlive.MathfieldElement.fontsDirectory = null;
        mathlive.MathfieldElement.soundsDirectory = null;

        field = new mathlive.MathfieldElement() as unknown as MathfieldLike;
        field.value = initialLatex;
        field.style.width = '100%';
        field.style.minHeight = '64px';
        field.style.fontSize = '20px';
        field.addEventListener('input', () => {
          const value = field?.value ?? '';
          fromFieldRef.current = value;
          setLatex(value);
        });
        hostRef.current?.replaceChildren(field as unknown as Node);
        fieldRef.current = field;
        setVisualReady(true);
        field.focus();
      } catch {
        // Остаётся путь через поле разметки и палитру — окно не должно ломаться целиком.
        setVisualReady(false);
      }
    })();

    return () => {
      cancelled = true;
      fieldRef.current = null;
      setVisualReady(false);
      (field as unknown as HTMLElement | null)?.remove();
    };
  }, [open, initialLatex]);

  // Правка разметки руками должна доехать до визуального поля — но не наоборот.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    if (fromFieldRef.current === latex) return;
    if (field.value !== latex) field.value = latex;
  }, [latex]);

  function insert(snippet: Snippet) {
    const field = fieldRef.current;
    if (field) {
      field.insert(snippet.insert, { focus: true });
      fromFieldRef.current = field.value;
      setLatex(field.value);
      return;
    }
    setLatex((prev) => (prev ? `${prev} ${snippet.insert.replace(/#\?/g, '')}` : snippet.insert.replace(/#\?/g, '')));
  }

  // Незаполненные места визуального редактора не должны попасть ни в предпросмотр, ни в
  // текст вопроса: KaTeX команды \placeholder не знает.
  const trimmed = stripPlaceholders(latex).trim();
  const forbidden = hasForbiddenCommand(trimmed);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Формула"
      subtitle="Соберите формулу мышью или наберите с клавиатуры — знание LaTeX не нужно"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={!trimmed || forbidden} onClick={() => onSave(trimmed, display)}>
            Вставить формулу
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label-base">Формула</label>
          <div
            ref={hostRef}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-300"
          />
          {!visualReady && (
            <textarea
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              rows={2}
              className="input-base mt-2 font-mono text-13"
              placeholder="\frac{m}{V}"
              aria-label="Разметка формулы"
            />
          )}
        </div>

        <div className="space-y-3">
          {PALETTE.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 text-11 font-semibold uppercase tracking-wide text-slate-400">
                {group.title}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    title={item.label}
                    onClick={() => insert(item)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    <Formula latex={item.latex} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={display}
            onChange={(e) => setDisplay(e.target.checked)}
            className="h-4 w-4 accent-brand-500"
          />
          Отдельным блоком (для системы уравнений или матрицы)
        </label>

        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-11 font-semibold uppercase tracking-wide text-slate-400">
            Так увидит ученик
          </p>
          <div className="mt-2 text-[17px] text-slate-800">
            {trimmed ? <Formula latex={trimmed} display={display} /> : <span className="text-slate-400">—</span>}
          </div>
        </div>

        {visualReady && (
          <div>
            <label className="label-base">Разметка (для тех, кто знает LaTeX)</label>
            <input
              value={latex}
              onChange={(e) => {
                fromFieldRef.current = null;
                setLatex(e.target.value);
              }}
              className="input-base font-mono text-13"
              spellCheck={false}
              aria-label="Разметка формулы"
            />
          </div>
        )}

        {forbidden && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
            В формуле есть команда, которую нельзя показывать ученику (макросы и загрузка
            внешних файлов). Уберите её.
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * Ровно то, что нужно от `MathfieldElement`. Свой тип, а не импортированный: тип из
 * `mathlive` затащил бы пакет в статический граф, и динамический `import()` перестал бы
 * что-либо экономить.
 */
interface MathfieldLike extends HTMLElement {
  value: string;
  insert(latex: string, options?: { focus?: boolean }): void;
}
