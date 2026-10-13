import { describe, expect, it } from 'vitest';
import { renderFormula } from './katexRender';
import { eraseChemicalText, insertChemicalText, reactionExpression, speciesExpression } from './chemistryEditor';

describe('chemical editing', () => {
  it('вставляет в середину и оборачивает выделенную группу, сохраняя соседний текст', () => {
    expect(insertChemicalText('HO', 1, 1, '2')).toEqual({ value: 'H2O', caret: 2 });
    expect(insertChemicalText('NH4 + H2O', 0, 3, '()')).toEqual({ value: '(NH4) + H2O', caret: 5 });
    expect(insertChemicalText('Fe + H2O', 0, 2, 'Co')).toEqual({ value: 'Co + H2O', caret: 2 });
    expect(insertChemicalText('', 0, 0, '[]')).toEqual({ value: '[]', caret: 1 });
    expect(eraseChemicalText('H2O + CO', 6, 8)).toEqual({ value: 'H2O + ', caret: 6 });
    expect(eraseChemicalText('H2O', 2, 2)).toEqual({ value: 'HO', caret: 1 });
  });

  it.each([
    'H2SO4', '(NH4)2SO4', '[Fe(CN)6]^{3-}', 'CH3-CH=CH2', 'HC#CH',
    'Zn + 2HCl -> ZnCl2 + H2 ^', 'Ca^{2+} + CO3^{2-} -> CaCO3 v', 'NaCl(s) -> NaCl(aq)',
    speciesExpression('C', '', '14', '6'), reactionExpression('N2 + 3H2', '2NH3', '<=>', '\\Delta'),
  ])('собранная запись отображается через настоящий mhchem: %s', argument => {
    expect(renderFormula(`\\ce{${argument}}`).ok).toBe(true);
  });
});
