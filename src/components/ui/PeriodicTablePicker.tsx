import { useId, useState } from 'react';
import { Button } from './Button';
import { Field, TextInput } from './Field';
import { chemicalElements, commonElementSymbols, elementsBySymbol, findChemicalElements, periodicTableRows, type ChemicalElement } from '@/lib/chemicalElements';

/** A local picker: choosing an element never requests a server or guesses a compound. */
export function PeriodicTablePicker({ onSelect }: { onSelect: (element: ChemicalElement) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ChemicalElement>();
  const contentId = useId();
  const matches = findChemicalElements(search);
  function choose(element: ChemicalElement) { setSelected(element); onSelect(element); }
  const label = (element: ChemicalElement) => `${element.name}, ${element.symbol}, атомный номер ${element.atomicNumber}`;

  return <section className="space-y-3" aria-label="Выбор химического элемента">
    <p className="text-sm font-semibold text-ink">Частые элементы</p>
    <div className="flex flex-wrap gap-2">
      {commonElementSymbols.map(symbol => {
        const element = elementsBySymbol.get(symbol)!;
        return <Button key={symbol} type="button" variant="secondary" className="min-w-11 px-3"
          title={label(element)} aria-label={label(element)} onMouseDown={event => event.preventDefault()}
          onClick={() => choose(element)}>{symbol}</Button>;
      })}
    </div>
    <Button type="button" variant="secondary" aria-expanded={open} aria-controls={contentId}
      onClick={() => setOpen(value => !value)}>{open ? 'Скрыть таблицу Менделеева' : 'Таблица Менделеева'}</Button>
    {open && <div id={contentId} className="space-y-3 rounded-xl border border-line bg-white p-3">
      <Field label="Найти элемент" hint="По русскому названию, символу или атомному номеру">
        <TextInput value={search} onChange={event => setSearch(event.target.value)} placeholder="Например: железо, Fe или 26" />
      </Field>
      {search.trim() ? <>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSearch('')}>Сбросить поиск</Button>
        {matches.length === 0 ? <p role="status" className="text-sm text-muted">Элемент не найден. Проверьте название, символ или номер.</p>
          : <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Найденные элементы">
            {matches.map(element => <Button key={element.symbol} type="button" variant="secondary" className="justify-start px-3"
              aria-label={label(element)} onClick={() => choose(element)}>{element.symbol} · {element.name} · {element.atomicNumber}</Button>)}
          </div>}
      </> : <>
        <p className="text-13 text-muted">Нажмите на элемент, чтобы вставить его символ. Число в ячейке — атомный номер. Нижние строки: лантаноиды (57–71) и актиноиды (89–103). В узком окне таблицу можно прокрутить в сторону.</p>
        <div className="max-w-full overflow-x-auto rounded-lg" tabIndex={0} aria-label="Прокрутка таблицы Менделеева">
          <table className="w-full border-separate border-spacing-1" aria-label="Периодическая таблица элементов">
            <caption className="sr-only">{chemicalElements.length} элементов. Группы с 1 по 18; лантаноиды и актиноиды приведены ниже.</caption>
            <thead><tr><th scope="col" className="text-11 text-muted">Период</th>
              {Array.from({ length: 18 }, (_, index) => <th key={index} scope="col" className="text-11 text-muted">{index + 1}</th>)}
            </tr></thead>
            <tbody>{periodicTableRows.map((row, rowIndex) => <tr key={rowIndex}>
              <th scope="row" className="px-1 text-11 font-medium text-muted">{rowIndex < 7 ? rowIndex + 1 : rowIndex === 7 ? '57–71' : '89–103'}</th>
              {row.map((symbol, column) => {
                const element = symbol ? elementsBySymbol.get(symbol) : undefined;
                return <td key={column} className="p-0">{element ? <Button type="button" variant="secondary" className="h-14 w-full min-w-11 px-1"
                  title={label(element)} aria-label={label(element)} onClick={() => choose(element)}>
                  <span className="flex flex-col"><span className="text-11 font-normal text-muted">{element.atomicNumber}</span><span className="text-base">{element.symbol}</span></span>
                </Button> : symbol ? <span className="block text-center text-11 text-muted">{symbol}</span> : null}</td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>}
    <p role="status" className="min-h-5 text-13 text-muted">{selected ? `Выбран элемент: ${selected.name} (${selected.symbol}), атомный номер ${selected.atomicNumber}.` : 'Выберите элемент или введите его символ в поле.'}</p>
  </section>;
}
