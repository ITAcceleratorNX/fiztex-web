import { chemicalEndAt } from './mathMarkup';

export type ChemicalBlock = { start: number; end: number; command: 'ce' | 'pu'; argument: string };

/** Offsets belong to this exact source, so identical blocks can be edited independently. */
export function chemicalBlocks(latex: string): ChemicalBlock[] {
  const blocks: ChemicalBlock[] = [];
  for (let i = 0; i < latex.length; i += 1) {
    if (latex[i] !== '\\') continue;
    const end = chemicalEndAt(latex, i);
    if (end < 0) { i += 1; continue; }
    const open = latex.indexOf('{', i);
    blocks.push({ start: i, end, command: latex.slice(i + 1, i + 3) as 'ce' | 'pu', argument: latex.slice(open + 1, end - 1) });
    i = end - 1;
  }
  return blocks;
}

export function replaceChemicalBlock(latex: string, index: number, argument: string): string {
  const block = chemicalBlocks(latex)[index];
  if (!block) return latex;
  return latex.slice(0, block.start) + `\\${block.command}{${argument}}` + latex.slice(block.end);
}

export function speciesExpression(species: string, charge: string, mass: string, atomic: string): string {
  return `${mass ? `^{${mass}}` : ''}${atomic ? `_{${atomic}}` : ''}${species}${charge ? `^{${charge}}` : ''}`;
}

export function reactionExpression(left: string, right: string, arrow: string, condition: string): string {
  return `${left} ${arrow}${condition ? `[${condition}]` : ''} ${right}`;
}

/** Plain mhchem input keeps its case and surroundings; groups wrap a selection. */
export function insertChemicalText(value: string, start: number, end: number, token: string): { value: string; caret: number } {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  const group = token === '()' || token === '[]';
  const insertion = group ? token[0] + value.slice(from, to) + token[1] : token;
  return { value: value.slice(0, from) + insertion + value.slice(to),
    caret: from + (group && from === to ? 1 : insertion.length) };
}

export function eraseChemicalText(value: string, start: number, end: number): { value: string; caret: number } {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  const deleteFrom = from === to ? Math.max(0, from - 1) : from;
  return { value: value.slice(0, deleteFrom) + value.slice(to), caret: deleteFrom };
}
