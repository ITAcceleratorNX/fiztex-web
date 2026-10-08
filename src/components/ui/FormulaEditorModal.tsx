import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Formula } from './MathText';
import { ChemicalExpressionEditor } from './ChemicalExpressionEditor';
import { checkFormulas, hasBlockingProblem } from '@/lib/formulaChecks';
import { FORMULA_PROFILES, type FormulaProfile } from '@/lib/formulaProfiles';
import catalog from '@/lib/formulaCatalog.json';
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

export type Snippet = { label: string; latex: string; insert: string };
export type PaletteGroup = { title: string; items: Snippet[] };

export function FormulaEditorModal({
  open,
  initialLatex = '',
  initialDisplay = false,
  profile = 'GENERAL',
  onClose,
  onSave,
}: {
  open: boolean;
  initialLatex?: string;
  initialDisplay?: boolean;
  profile?: FormulaProfile;
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
    let previousLayouts: typeof window.mathVirtualKeyboard.layouts | undefined;

    void (async () => {
      try {
        const mathlive = await import('mathlive');
        if (cancelled) return;
        // Шрифты уже объявлены katex.min.css (MathLive использует те же KaTeX_*), звуки
        // нажатий здесь не нужны — иначе оба каталога запрашивались бы с 404.
        mathlive.MathfieldElement.fontsDirectory = null;
        mathlive.MathfieldElement.soundsDirectory = null;

        field = new mathlive.MathfieldElement() as unknown as MathfieldLike;
        previousLayouts = window.mathVirtualKeyboard.layouts;
        window.mathVirtualKeyboard.layouts = ['numeric', 'symbols', 'alphabetic',
          ...(profile === 'PHYSICS' || profile === 'CHEMISTRY' ? [{
            label: FORMULA_PROFILES[profile], rows: catalog[profile].flatMap(group => {
              const keys = group.items.map(item => ({ latex: item.latex, insert: item.insert, tooltip: item.label }));
              return [keys.slice(0, 5), keys.slice(5)].filter(row => row.length > 0);
            }),
          }] : [])];
        field.mathVirtualKeyboardPolicy = 'manual';
        field.value = initialLatex;
        field.className = 'w-full min-h-16 text-xl';
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
      if (previousLayouts) window.mathVirtualKeyboard.layouts = previousLayouts;
      fieldRef.current = null;
      setVisualReady(false);
      (field as unknown as HTMLElement | null)?.remove();
    };
  }, [open, initialLatex, profile]);

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
  const problems = checkFormulas([{ where: 'Формула', text: `${display ? '$$' : '$'}${trimmed}${display ? '$$' : '$'}` }]);
  const invalid = forbidden || hasBlockingProblem(problems);
  const palette: PaletteGroup[] = [...catalog.common, ...(profile === 'GENERAL' ? [] : catalog[profile])];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Формула · ${FORMULA_PROFILES[profile]}`}
      subtitle="Соберите формулу мышью или наберите с клавиатуры — знание LaTeX не нужно"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={!trimmed || invalid} onClick={() => onSave(trimmed, display)}>
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

        <ChemicalExpressionEditor latex={latex} onChange={value => { fromFieldRef.current = null; setLatex(value); }} />

        <div className="space-y-3">
          {palette.map((group) => (
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
          <div className="mt-2 min-w-0 text-base text-ink">
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

        {!forbidden && trimmed && problems.length > 0 && <p role="alert" className="text-sm text-danger-fg">{problems.map(problem => problem.message).join('; ')}</p>}

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
  mathVirtualKeyboardPolicy: 'manual';
  insert(latex: string, options?: { focus?: boolean }): void;
}
