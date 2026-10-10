import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button, buttonClassName } from './Button';
import { Formula } from './MathText';
import { ChemicalExpressionEditor } from './ChemicalExpressionEditor';
import { CollapsibleCard } from './CollapsibleCard';
import { SegmentedTabs } from './SegmentedTabs';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
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
  const [mathEditorVisible, setMathEditorVisible] = useState(profile !== 'CHEMISTRY');
  const [visualReady, setVisualReady] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const keyboardHostRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<MathfieldLike | null>(null);
  const keyboardRef = useRef<typeof window.mathVirtualKeyboard | null>(null);
  // Значение, которое пришло из самого поля: не пишем его обратно и не сбиваем курсор.
  const fromFieldRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLatex(initialLatex);
    setDisplay(initialDisplay);
    setMathEditorVisible(profile !== 'CHEMISTRY');
  }, [open, initialLatex, initialDisplay, profile]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let field: MathfieldLike | null = null;
    let keyboard: typeof window.mathVirtualKeyboard | null = null;
    let previousLayouts: typeof window.mathVirtualKeyboard.layouts | undefined;
    let previousContainer: HTMLElement | null | undefined;
    const syncKeyboard = () => {
      setKeyboardVisible(keyboard?.visible ?? false);
      setKeyboardHeight(keyboard?.visible ? keyboard.boundingRect.height : 0);
    };

    void (async () => {
      try {
        const mathlive = await import('mathlive');
        if (cancelled) return;
        // Шрифты уже объявлены katex.min.css (MathLive использует те же KaTeX_*), звуки
        // нажатий здесь не нужны — иначе оба каталога запрашивались бы с 404.
        mathlive.MathfieldElement.fontsDirectory = null;
        mathlive.MathfieldElement.soundsDirectory = null;

        field = new mathlive.MathfieldElement() as unknown as MathfieldLike;
        keyboard = window.mathVirtualKeyboard;
        previousLayouts = keyboard.layouts;
        previousContainer = keyboard.container;
        keyboard.hide({ animate: false });
        // Modal makes everything outside its dialog inert, including MathLive's
        // default body-level keyboard. The fixed host stays inside the dialog but
        // anchors the keys to the viewport even when the palette is taller than it.
        keyboard.container = keyboardHostRef.current;
        keyboard.addEventListener('geometrychange', syncKeyboard);
        keyboardRef.current = keyboard;
        syncKeyboard();
        keyboard.layouts = ['numeric', 'symbols', 'alphabetic',
          ...(profile === 'PHYSICS' || profile === 'CHEMISTRY' ? [{
            label: FORMULA_PROFILES[profile], rows: catalog[profile].flatMap(group => {
              const keys = group.items.map(item => ({ latex: item.latex, insert: item.insert, tooltip: item.label }));
              return [keys.slice(0, 5), keys.slice(5)].filter(row => row.length > 0);
            }),
          }] : [])];
        field.mathVirtualKeyboardPolicy = 'manual';
        field.value = initialLatex;
        field.className = 'w-full min-h-16 text-xl';
        field.setAttribute('aria-label', 'Визуальный редактор формулы');
        field.addEventListener('input', () => {
          const value = field?.value ?? '';
          fromFieldRef.current = value;
          setLatex(value);
        });
        hostRef.current?.replaceChildren(field as unknown as Node);
        fieldRef.current = field;
        setVisualReady(true);
        if (profile !== 'CHEMISTRY') field.focus();
      } catch {
        // Остаётся путь через поле разметки и палитру — окно не должно ломаться целиком.
        setVisualReady(false);
      }
    })();

    return () => {
      cancelled = true;
      if (keyboard) {
        keyboard.removeEventListener('geometrychange', syncKeyboard);
        keyboard.hide({ animate: false });
        keyboard.container = previousContainer ?? null;
        if (previousLayouts) keyboard.layouts = previousLayouts;
      }
      keyboardRef.current = null;
      setKeyboardVisible(false);
      setKeyboardHeight(0);
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
  }, [latex, visualReady]);

  function toggleKeyboard() {
    const keyboard = keyboardRef.current;
    if (!keyboard) return;
    if (keyboard.visible) keyboard.hide();
    else {
      fieldRef.current?.focus();
      keyboard.show();
    }
    setKeyboardVisible(keyboard.visible);
  }

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

  const mathEditor = (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-line bg-white p-4" aria-label="Ввод формулы">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-semibold text-ink">Запись формулы</p>
          {visualReady && <Button type="button" variant="secondary" size="sm" aria-expanded={keyboardVisible}
            className="min-h-11" onClick={toggleKeyboard}>
            {keyboardVisible ? 'Скрыть клавиатуру' : 'Показать клавиатуру'}
          </Button>}
        </div>
        <div
          ref={hostRef}
          className="rounded-xl border border-line bg-white px-3 py-2 focus-within:border-brand-300"
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
        <p className="text-13 text-muted">Наберите формулу в поле или выберите шаблон ниже. Для ввода мышью откройте клавиатуру.</p>
      </section>

      {profile !== 'CHEMISTRY' && <ChemicalExpressionEditor showPreview={false} latex={latex} onChange={value => { fromFieldRef.current = null; setLatex(value); }} />}

      <section className="space-y-3 rounded-xl border border-line bg-white p-4" aria-label="Шаблоны формул">
        <p className="text-base font-semibold text-ink">Шаблоны и знаки</p>
        <Tabs key={profile} defaultValue="group-0" className="space-y-3">
          <TabsList className="flex-wrap">{palette.map((group, index) => <TabsTrigger key={group.title} className="min-h-11" value={`group-${index}`}>{group.title}</TabsTrigger>)}</TabsList>
          {palette.map((group, index) => (
            <TabsContent key={group.title} value={`group-${index}`}>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => insert(item)}
                    className={buttonClassName({ variant: 'secondary', className: 'h-auto min-h-16 min-w-0 flex-col gap-2 px-3 py-3' })}
                  >
                    <Formula latex={item.latex} />
                    <span className="text-13 font-medium">{item.label}</span>
                  </button>
              ))}
            </div>
          </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={profile === 'CHEMISTRY' ? '2xl' : 'lg'}
      scrollable
      bottomInset={keyboardHeight}
      title={`Формула · ${FORMULA_PROFILES[profile]}`}
      subtitle="Создайте запись, проверьте результат и вставьте в задание"
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
      <div ref={keyboardHostRef} data-formula-keyboard className="fixed inset-x-0 bottom-0 z-50"
        style={{ height: keyboardHeight }} />
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {profile === 'CHEMISTRY' ? (
            <Tabs value={mathEditorVisible ? 'math' : 'chemistry'} onValueChange={value => {
              setMathEditorVisible(value === 'math');
              keyboardRef.current?.hide();
            }} className="space-y-4">
              <TabsList className="flex-wrap">
                <TabsTrigger className="min-h-11" value="chemistry">Химическая запись</TabsTrigger>
                <TabsTrigger className="min-h-11" value="math">Математические обозначения</TabsTrigger>
              </TabsList>
              <TabsContent value="chemistry" forceMount>
                <ChemicalExpressionEditor allowCreate showPreview={false} latex={latex} onChange={value => { fromFieldRef.current = null; setLatex(value); }} />
              </TabsContent>
              <TabsContent value="math" forceMount>{mathEditor}</TabsContent>
            </Tabs>
          ) : mathEditor}

          {visualReady && (
            <CollapsibleCard title="Разметка LaTeX" className="p-4 shadow-none">
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
            </CollapsibleCard>
          )}
        </div>

        <aside className="min-w-0 space-y-4 self-start rounded-xl border border-line bg-canvas p-4 lg:sticky lg:top-0" aria-label="Предпросмотр формулы">
          <div className="space-y-3">
            <p className="text-base font-semibold text-ink">Так увидит ученик</p>
            <div className="min-h-20 min-w-0 rounded-xl bg-white p-3 text-base text-ink">
              {trimmed ? <Formula latex={trimmed} display={display} /> : <span className="text-sm text-muted">Здесь появится формула. Начните с ввода или выбора элемента.</span>}
            </div>
          </div>
          <div className="space-y-2 border-t border-line pt-4">
            <p className="text-sm font-semibold text-ink">Размещение в задании</p>
            <SegmentedTabs value={display ? 'block' : 'inline'} onChange={value => setDisplay(value === 'block')}
              ariaLabel="Размещение формулы" options={[{ value: 'inline', label: 'В строке' }, { value: 'block', label: 'Отдельно' }]} />
            <p className="text-13 text-muted">{display ? 'На отдельной строке — удобно для длинной реакции, системы или матрицы.' : 'Внутри текста задания, рядом с обычными словами.'}</p>
          </div>
          {!forbidden && trimmed && problems.length > 0 && <p role="alert" className="text-sm text-red-700">{problems.map(problem => problem.message).join('; ')}</p>}
          {forbidden && <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-red-700">В формуле есть команда, которую нельзя показывать ученику (макросы и загрузка внешних файлов). Уберите её.</p>}
          {trimmed && !invalid && <p className="text-sm text-muted">Формула готова. Нажмите «Вставить формулу».</p>}
        </aside>
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
