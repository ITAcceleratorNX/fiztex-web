import { describe, expect, it } from 'vitest';
import {
  finalScaleCaption,
  formatPercent,
  missingResultsSummary,
  positiveFinalValues,
  resultMissingCaption,
  resultStatusHint,
  weightsCaption,
  weightsSum,
} from './gradingModel';
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

  it('names the primary intermediate component without calculating percentages', () => {
    expect(weightsCaption([
      { code: 'FORMATIVE', weightPercent: 50 },
      { code: 'INTERMEDIATE', weightPercent: 50 },
    ])).toBe('ФО 50 · ПО 50');
    expect(resultStatusHint({ status: 'INCOMPLETE', missingComponents: ['INTERMEDIATE'] }))
      .toContain('Нет работ: ПО');
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

describe('пустой итог четверти (пилот 3.2)', () => {
  it('называет, чего не хватает, а ноль баллов оставляет нулём', () => {
    expect(resultMissingCaption({ status: 'NO_WORKS' })).toBe('Нет работ за четверть');
    expect(resultMissingCaption({ status: 'INCOMPLETE', missingComponents: ['SOR', 'SOCH'] })).toBe('Нет СОР, СОЧ');
    expect(resultMissingCaption({ status: 'CALCULATED', percent: 0, missingComponents: [] })).toBeNull();
    expect(resultMissingCaption(null)).toBeNull();
  });

  it('сводка считает только строки без итога и собирает недостающие работы', () => {
    expect(missingResultsSummary([
      { status: 'INCOMPLETE', missingComponents: ['SOCH'] },
      { status: 'NO_WORKS', missingComponents: ['SOR', 'SOCH'] },
      { status: 'CALCULATED', percent: 0 },
      null,
    ])).toEqual({ students: 2, components: ['СОЧ', 'СОР'] });
  });
});

describe('шкала итога (пилот 3.1)', () => {
  it('подписывает шкалу так, как её прислал сервер', () => {
    expect(finalScaleCaption([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe('1–10');
    expect(finalScaleCaption([5, 2, 4, 3])).toBe('2–5');
    expect(finalScaleCaption([2, 5, 8])).toBe('2, 5, 8');
    expect(finalScaleCaption([])).toBeNull();
  });

  it('ВНА снимается любым итогом выше нижнего порога, а не «с тройки»', () => {
    expect(positiveFinalValues([2, 3, 4, 5])).toEqual([3, 4, 5]);
    expect(positiveFinalValues([10, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
