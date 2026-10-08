import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import { Formula } from './MathText';
import { renderFormula } from '@/lib/katexRender';
import { chemicalBlocks, reactionExpression, replaceChemicalBlock, speciesExpression } from '@/lib/chemistryEditor';

export function ChemicalExpressionEditor({ latex, onChange }: { latex: string; onChange: (latex: string) => void }) {
  const blocks = chemicalBlocks(latex);
  const [index, setIndex] = useState(0);
  const block = blocks[index];
  const [argument, setArgument] = useState(block?.argument ?? '');
  const [species, setSpecies] = useState('Fe');
  const [charge, setCharge] = useState('3+');
  const [mass, setMass] = useState('');
  const [atomic, setAtomic] = useState('');
  const [left, setLeft] = useState('2H2 + O2');
  const [right, setRight] = useState('2H2O');
  const [arrow, setArrow] = useState('->');
  const [condition, setCondition] = useState('');
  useEffect(() => { setArgument(block?.argument ?? ''); }, [block?.argument, index]);
  if (!block) return null;
  const rendered = renderFormula(`\\${block.command}{${argument}}`, false);
  function field(label: string, value: string, set: (value: string) => void, placeholder?: string) {
    return <label className="block text-13 text-muted">{label}<input className="input-base mt-1" aria-label={label}
      value={value} onChange={e => set(e.target.value)} placeholder={placeholder} spellCheck={false} /></label>;
  }
  return <section className="space-y-3 rounded-xl border border-line bg-canvas p-3">
    <p className="text-sm font-semibold text-ink">Химическая запись</p>
    <Select aria-label="Химический блок" value={String(index)} onChange={e => setIndex(Number(e.target.value))}>
      {blocks.map((item, i) => <option value={i} key={i}>{`${i + 1}. ${item.argument}`}</option>)}
    </Select>
    <p className="text-13 text-muted">Пишите H2O, Fe3+, (NH4)2SO4. Сохраняйте регистр: CO и Co — разные вещества. Меняется только выбранный блок.</p>
    {field('Вещество или реакция', argument, setArgument)}
    {block.command === 'ce' && <>
      <div className="grid grid-cols-2 gap-2">
        {field('Элемент или группа', species, setSpecies)}{field('Заряд', charge, setCharge, '2-')}
        {field('Массовое число', mass, setMass, '14')}{field('Атомный номер', atomic, setAtomic, '6')}
      </div>
      <Button variant="secondary" disabled={!species.trim()} onClick={() => setArgument(speciesExpression(species, charge, mass, atomic))}>Собрать ион или изотоп</Button>
      <div className="grid grid-cols-2 gap-2">{field('Реагенты', left, setLeft)}{field('Продукты', right, setRight)}</div>
      <div className="grid grid-cols-2 gap-2">
        <Select aria-label="Стрелка реакции" value={arrow} onChange={e => setArrow(e.target.value)}>
          <option value="->">Прямая реакция →</option><option value="<=>">Равновесие ⇌</option><option value="<-">Обратная реакция ←</option>
        </Select>
        {field('Условия реакции', condition, setCondition, 'T,p')}
      </div>
      <Button variant="secondary" disabled={!left.trim() || !right.trim()} onClick={() => setArgument(reactionExpression(left, right, arrow, condition))}>Собрать реакцию</Button>
    </>}
    <div className="min-w-0 overflow-x-auto"><Formula latex={`\\${block.command}{${argument}}`} /></div>
    <div className="flex flex-wrap gap-2">
      <Button disabled={!argument.trim() || !rendered.ok} onClick={() => onChange(replaceChemicalBlock(latex, index, argument))}>Применить к блоку</Button>
      <Button variant="secondary" onClick={() => setArgument(block.argument)}>Отменить правку блока</Button>
    </div>
  </section>;
}
