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
