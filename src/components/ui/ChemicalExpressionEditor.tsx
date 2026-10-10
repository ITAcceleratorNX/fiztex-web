import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import { CollapsibleCard } from './CollapsibleCard';
import { Formula } from './MathText';
import { PeriodicTablePicker } from './PeriodicTablePicker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
import { renderFormula } from '@/lib/katexRender';
import { chemicalBlocks, eraseChemicalText, insertChemicalText, reactionExpression, replaceChemicalBlock, speciesExpression } from '@/lib/chemistryEditor';

type Target = 'argument' | 'species' | 'left' | 'right' | 'condition';
type Cursor = { start: number; end: number };
type HistoryEntry = { target: Target; value: string; cursor: Cursor };
const labels: Record<Target, string> = {
  argument: 'Вещество или реакция', species: 'Элемент или группа', left: 'Реагенты', right: 'Продукты', condition: 'Условия реакции',
};
const keyGroups = [
  { title: 'Реакции', keys: [
    ['+ Сложение веществ', ' + '], ['→ Прямая реакция', ' -> '], ['← Обратная реакция', ' <- '],
    ['⇌ Равновесие', ' <=> '], ['↑ Газ', ' ^'], ['↓ Осадок', ' v'],
  ] },
  { title: 'Связи и группы', keys: [
    ['— Одинарная связь', '-'], ['= Двойная связь', '='], ['≡ Тройная связь', '#'], ['( ) Группа', '()'], ['[ ] Комплекс', '[]'],
  ] },
  { title: 'Заряды', keys: [['1+', '^{+}'], ['2+', '^{2+}'], ['3+', '^{3+}'], ['1−', '^{-}'], ['2−', '^{2-}'], ['3−', '^{3-}']] },
  { title: 'Состояние вещества', keys: [['Твёрдое (s)', '(s)'], ['Жидкое (l)', '(l)'], ['Газ (g)', '(g)'], ['Раствор (aq)', '(aq)']] },
];

export function ChemicalExpressionEditor({ latex, onChange, allowCreate = false, showPreview = true }: {
  latex: string; onChange: (latex: string) => void; allowCreate?: boolean; showPreview?: boolean;
}) {
  // Keep the edit's source stable even while a manually typed brace is unfinished.
  // Reparse external MathLive edits, but never our own intermediate input.
  const [baseLatex, setBaseLatex] = useState(latex);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const emittedRef = useRef<string | null>(null);
  const blocks = chemicalBlocks(baseLatex);
  const block = blocks[index];
  const visibleBlocks = chemicalBlocks(latex);
  const [argument, setArgument] = useState(block?.argument ?? '');
  const [species, setSpecies] = useState('');
  const [charge, setCharge] = useState('');
  const [mass, setMass] = useState('');
  const [atomic, setAtomic] = useState('');
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [arrow, setArrow] = useState('->');
  const [condition, setCondition] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTarget, setActiveTarget] = useState<Target>('argument');
  const inputs = useRef<Partial<Record<Target, HTMLInputElement>>>({});
  const selections = useRef<Partial<Record<Target, Cursor>>>({});
  const pendingCursor = useRef<{ target: Target; cursor: Cursor } | null>(null);
  const values = { argument, species, left, right, condition };
  const setters = { argument: writeArgument, species: setSpecies, left: setLeft, right: setRight, condition: setCondition };
  const command = block?.command ?? 'ce';
  const rendered = renderFormula(`\\${command}{${argument}}`, false);

  useEffect(() => {
    if (latex === emittedRef.current) return;
    const incoming = chemicalBlocks(latex);
    const nextIndex = incoming[indexRef.current] ? indexRef.current : 0;
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    setBaseLatex(latex);
    setArgument(incoming[nextIndex]?.argument ?? '');
    setHistory([]);
  }, [latex]);

  useLayoutEffect(() => {
    if (activeTarget !== 'argument' && !inputs.current[activeTarget]?.isConnected) setActiveTarget('argument');
    const pending = pendingCursor.current;
    if (!pending) return;
    pendingCursor.current = null;
    const input = inputs.current[pending.target];
    input?.focus({ preventScroll: true });
    input?.setSelectionRange(pending.cursor.start, pending.cursor.end);
    selections.current[pending.target] = pending.cursor;
  });

  function writeArgument(value: string) {
    setArgument(value);
    const next = value.trim() ? (block ? replaceChemicalBlock(baseLatex, index, value)
      : `${baseLatex}${baseLatex ? ' ' : ''}\\ce{${value}}`)
      : block ? baseLatex.slice(0, block.start) + baseLatex.slice(block.end) : baseLatex;
    emittedRef.current = next;
    onChange(next);
  }

  function cursor(target: Target): Cursor {
    return selections.current[target] ?? { start: values[target].length, end: values[target].length };
  }

  function change(target: Target, value: string, restoreCursor?: Cursor) {
    if (value === values[target] && restoreCursor) {
      const input = inputs.current[target];
      input?.focus({ preventScroll: true });
      input?.setSelectionRange(restoreCursor.start, restoreCursor.end);
      selections.current[target] = restoreCursor;
      return;
    }
    if (value !== values[target]) setHistory(previous => [...previous.slice(-49), { target, value: values[target], cursor: cursor(target) }]);
    if (restoreCursor) pendingCursor.current = { target, cursor: restoreCursor };
    setters[target](value);
  }

  function insert(token: string) {
    const target = inputs.current[activeTarget]?.isConnected ? activeTarget : 'argument';
    setActiveTarget(target);
    const selection = cursor(target);
    const next = insertChemicalText(values[target], selection.start, selection.end, token);
    change(target, next.value, { start: next.caret, end: next.caret });
    return target;
  }

  function useBuiltExpression(value: string) {
    setActiveTarget('argument');
    change('argument', value, { start: value.length, end: value.length });
  }

  function selectBlock(nextIndex: number) {
    setBaseLatex(latex);
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    setArgument(visibleBlocks[nextIndex]?.argument ?? '');
    setHistory([]);
    setActiveTarget('argument');
    selections.current.argument = undefined;
  }

  function field(label: string, value: string, set: (value: string) => void, placeholder?: string, target?: Target) {
    return <label className="block text-sm text-muted">{label}<input className="input-base mt-1" aria-label={label}
      ref={input => { if (target) { if (input) inputs.current[target] = input; else delete inputs.current[target]; } }} value={value}
      onFocus={() => { if (target) setActiveTarget(target); }}
      onSelect={event => { if (target) selections.current[target] = { start: event.currentTarget.selectionStart ?? value.length, end: event.currentTarget.selectionEnd ?? value.length }; }}
      onChange={event => { if (target) change(target, event.target.value); else set(event.target.value); }}
      placeholder={placeholder} spellCheck={false} /></label>;
  }

  if (!block && !allowCreate) return null;
  return <section className="space-y-4 rounded-xl border border-line bg-white p-4" aria-label="Химический конструктор">
    <div className="space-y-2">
      <p className="text-base font-semibold text-ink">Химический конструктор</p>
      <p className="text-sm text-muted">Выбирайте элементы и знаки кнопками. Цифра после элемента станет нижним индексом, перед веществом — коэффициентом.</p>
      {visibleBlocks.length > 0 && <label className="block text-sm text-muted">Какую запись редактировать<Select className="mt-1" aria-label="Химический блок" value={String(index)} disabled={Boolean(argument.trim()) && !rendered.ok}
        onChange={event => selectBlock(Number(event.target.value))}>
        {visibleBlocks.map((item, i) => <option value={i} key={i}>{`${i + 1}. ${item.argument}`}</option>)}
        {allowCreate && <option value={visibleBlocks.length}>Новая химическая запись</option>}
      </Select></label>}
    </div>
    <div className="space-y-2 rounded-xl border border-line bg-canvas p-3 sm:sticky sm:top-0 sm:z-10">
      {field(labels.argument, argument, setArgument, 'Выберите элементы или введите H2O', 'argument')}
      {showPreview && <div className="space-y-2 rounded-xl bg-white p-3">
        <p className="text-13 font-semibold text-ink">Получается такая запись</p>
        <div className="min-w-0 overflow-x-auto">{argument.trim() ? <Formula latex={`\\${command}{${argument}}`} /> : <span className="text-sm text-muted">Начните с выбора элемента.</span>}</div>
      </div>}
      {argument.trim() && !rendered.ok && <p role="alert" className="text-sm text-red-700">Проверьте запись: скобки, индексы и заряды должны быть заполнены.</p>}
      <p className="text-13 text-muted">Кнопки вставляют в поле «{labels[activeTarget]}» на месте курсора. Выделенный текст заменяется. Регистр важен: CO и Co — разные записи.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={history.length === 0} onClick={() => {
          const previous = history.at(-1);
          if (!previous) return;
          setHistory(history.slice(0, -1));
          pendingCursor.current = { target: previous.target, cursor: previous.cursor };
          setActiveTarget(previous.target);
          setters[previous.target](previous.value);
        }}>Отменить действие</Button>
        <Button type="button" variant="secondary" onMouseDown={event => event.preventDefault()} onClick={() => {
          const target = inputs.current[activeTarget]?.isConnected ? activeTarget : 'argument';
          setActiveTarget(target);
          const selection = cursor(target);
          const next = eraseChemicalText(values[target], selection.start, selection.end);
          change(target, next.value, { start: next.caret, end: next.caret });
        }}>Удалить символ</Button>
        <Button type="button" variant="ghost" onClick={() => useBuiltExpression(block?.argument ?? '')}>Отменить правку блока</Button>
      </div>
    </div>
    {command === 'ce' && <>
      <Tabs defaultValue="elements" className="space-y-4">
        <TabsList className="flex-wrap"><TabsTrigger className="min-h-11" value="elements">Элементы и цифры</TabsTrigger><TabsTrigger className="min-h-11" value="signs">Знаки и связи</TabsTrigger></TabsList>
        <TabsContent value="elements" forceMount className="space-y-4">
          <PeriodicTablePicker onSelect={element => {
            if (insert(element.symbol) === 'species') setAtomic(String(element.atomicNumber));
          }} />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">Цифры: индексы и коэффициенты</p>
            <div className="flex flex-wrap gap-2">{Array.from({ length: 10 }, (_, number) => <Button key={number} type="button" variant="secondary" className="min-w-11 px-3"
              aria-label={`Цифра ${number}`} onMouseDown={event => event.preventDefault()} onClick={() => insert(String(number))}>{number}</Button>)}</div>
          </div>
        </TabsContent>
        <TabsContent value="signs" className="grid gap-4 sm:grid-cols-2">
          {keyGroups.map(group => <div key={group.title} className="space-y-2 rounded-xl bg-canvas p-3">
            <p className="text-sm font-semibold text-ink">{group.title}</p>
            <div className="flex flex-wrap gap-2">{group.keys.map(([label, token]) => <Button key={label} type="button" variant="secondary" className="px-3"
              onMouseDown={event => event.preventDefault()} onClick={() => insert(token)}>{label}</Button>)}</div>
          </div>)}
        </TabsContent>
      </Tabs>
      <div className="space-y-3 border-t border-line pt-4">
        <p className="text-sm font-semibold text-ink">Дополнительные инструменты</p>
        <CollapsibleCard title="Ионы и изотопы" className="p-4 shadow-none"
          onOpenChange={open => { if (!open && activeTarget === 'species') setActiveTarget('argument'); }}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field(labels.species, species, setSpecies, 'Fe или SO4', 'species')}{field('Заряд', charge, setCharge, '2-')}
              {field('Массовое число', mass, setMass, '14')}{field('Атомный номер', atomic, setAtomic, '6')}
            </div>
            <p className="text-13 text-muted">Выберите элемент для этого поля в таблице: атомный номер подставится автоматически. Для изотопа укажите массовое число; у обычного иона атомный номер не выводится.</p>
            <Button type="button" variant="secondary" disabled={!species.trim()} onClick={() => useBuiltExpression(speciesExpression(species, charge, mass, mass.trim() ? atomic : ''))}>Собрать ион или изотоп</Button>
          </div>
        </CollapsibleCard>
        <CollapsibleCard title="Реакция с условиями" className="p-4 shadow-none"
          onOpenChange={open => { if (!open && ['left', 'right', 'condition'].includes(activeTarget)) setActiveTarget('argument'); }}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{field(labels.left, left, setLeft, 'Например: 2H2 + O2', 'left')}{field(labels.right, right, setRight, 'Например: 2H2O', 'right')}</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm text-muted">Стрелка реакции<Select aria-label="Стрелка реакции" className="mt-1" value={arrow} onChange={event => setArrow(event.target.value)}>
                <option value="->">Прямая реакция →</option><option value="<=>">Равновесие ⇌</option><option value="<-">Обратная реакция ←</option>
              </Select></label>
              {field(labels.condition, condition, setCondition, 'Температура, давление или катализатор', 'condition')}
            </div>
            <Button type="button" variant="secondary" onClick={() => change('condition', '\\Delta')}>Δ Нагревание</Button>
            <Button type="button" variant="secondary" disabled={!left.trim() || !right.trim()} onClick={() => useBuiltExpression(reactionExpression(left, right, arrow, condition))}>Собрать реакцию</Button>
          </div>
        </CollapsibleCard>
      </div>
    </>}
  </section>;
}
