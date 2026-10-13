import { describe, expect, it } from 'vitest';
import { chemicalElements, findChemicalElements, periodicTableRows } from './chemicalElements';

describe('chemical elements', () => {
  it('содержит 118 уникальных элементов с последовательными атомными номерами', () => {
    expect(chemicalElements).toHaveLength(118);
    expect(new Set(chemicalElements.map(element => element.symbol)).size).toBe(118);
    expect(chemicalElements.map(element => element.atomicNumber)).toEqual(Array.from({ length: 118 }, (_, index) => index + 1));
    expect(chemicalElements[26]).toEqual({ symbol: 'Co', name: 'Кобальт', atomicNumber: 27 });
    expect(chemicalElements[112]).toEqual({ symbol: 'Nh', name: 'Нихоний', atomicNumber: 113 });
    expect(chemicalElements[117]).toEqual({ symbol: 'Og', name: 'Оганесон', atomicNumber: 118 });
    const symbols = periodicTableRows.flat().filter(symbol => chemicalElements.some(element => element.symbol === symbol));
    expect(symbols).toHaveLength(118);
    expect(new Set(symbols)).toEqual(new Set(chemicalElements.map(element => element.symbol)));
    expect(periodicTableRows.every(row => row.length === 18)).toBe(true);
  });

  it.each(['ЖЕЛЕЗО', 'Fe', '26', ' железо '])('находит элемент по названию, символу или номеру: %s', query => {
    expect(findChemicalElements(query)).toEqual([{ symbol: 'Fe', name: 'Железо', atomicNumber: 26 }]);
  });

  it('находит кобальт без изменения регистра символа и принимает привычное название йода', () => {
    expect(findChemicalElements('CO')[0].symbol).toBe('Co');
    expect(findChemicalElements('йод')[0].symbol).toBe('I');
    expect(findChemicalElements('нет такого элемента')).toEqual([]);
  });
});
