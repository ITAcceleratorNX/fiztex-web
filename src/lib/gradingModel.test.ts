import { describe, expect, it } from 'vitest';
import { formatPercent, resultStatusHint, weightsCaption, weightsSum } from './gradingModel';
import { gradeValueLabel } from './gradesModel';

describe('formatPercent', () => {
  it('пишет запятую и прячет нулевые сотые', () => {
    expect(formatPercent(84.2)).toBe('84,20%');
    expect(formatPercent(90)).toBe('90%');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('gradeValueLabel', () => {
  it('показывает ту форму, которая заполнена', () => {
    expect(gradeValueLabel({ scaleCode: '4+' })).toBe('4+');
    expect(gradeValueLabel({ score: 7, maxScore: 10 })).toBe('7');
    expect(gradeValueLabel({ score: 15, maxScore: 20 })).toBe('15/20');
    expect(gradeValueLabel({ score: 15.5, maxScore: 20 })).toBe('15,5/20');
    expect(gradeValueLabel(null)).toBeNull();
  });
});

describe('weights', () => {
  it('подписывает и складывает веса компонентов', () => {
    const components = [
      { code: 'FORMATIVE' as const, title: 'ФО', weightPercent: 25 },
      { code: 'SOR' as const, title: 'СОР', weightPercent: 25 },
      { code: 'SOCH' as const, title: 'СОЧ', weightPercent: 50 },
    ];
    expect(weightsCaption(components)).toBe('ФО 25 · СОР 25 · СОЧ 50');
    expect(weightsSum(components)).toBe(100);
  });
});

describe('resultStatusHint', () => {
  it('объясняет отсутствие процента', () => {
    expect(resultStatusHint({ status: 'NO_WORKS' })).toMatch(/Нет учитываемых работ/);
    expect(resultStatusHint({ status: 'INCOMPLETE', missingComponents: ['SOCH'] })).toMatch(/СОЧ/);
    expect(resultStatusHint({ status: 'CALCULATED', missingComponents: ['SOCH'] })).toMatch(/пересчитаны/);
    expect(resultStatusHint({ status: 'CALCULATED', missingComponents: [] })).toBeNull();
  });
});
