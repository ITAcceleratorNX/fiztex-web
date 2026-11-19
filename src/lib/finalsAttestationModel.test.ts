import { describe, expect, it } from 'vitest';
import type { ClassFinalGradeRow, ClassFinalGrades } from './gradebookApi';
import {
  attestationNote,
  deviationDialog,
  finalsBanner,
  finalsTabLabel,
  matchesRecommendation,
  optionOfPeriod,
  trendOf,
} from './finalsAttestationModel';

const half = {
  number: 1,
  opening: { id: 1, name: '1', type: 'QUARTER' as const, startDate: '2026-09-01' },
  closing: { id: 2, name: '2', type: 'QUARTER' as const, startDate: '2026-11-02' },
};

function finals(patch: Partial<ClassFinalGrades>, rows: Partial<ClassFinalGradeRow>[] = []): ClassFinalGrades {
  return { assessmentMode: 'NUMERIC', rows: rows as ClassFinalGradeRow[], ...patch } as ClassFinalGrades;
}

describe('finalsAttestationModel', () => {
  it('вкладка и вариант фильтра у полугодия (Б1)', () => {
    const option = { periodicity: 'HALF_YEAR' as const, name: '1 полугодие', periods: [{ id: 1 }, { id: 2 }] };
    expect(finalsTabLabel(option)).toBe('Итоги полугодия');
    expect(finalsTabLabel(null)).toBe('Итоги четверти');
    expect(optionOfPeriod([option], 2)).toBe(option);
    expect(optionOfPeriod([option], 3)).toBeNull();
  });

  it('пояснение предмета: полугодие, зачёт, без СОЧ (Б1, У3)', () => {
    const numeric = finals({ attestation: { configured: true, periodicity: 'HALF_YEAR', sochProvided: true, halfYear: half } });
    expect(attestationNote(numeric, 'Информатика')).toBe(
      'Информатика аттестуется по полугодиям: итог 1 полугодия ставится один раз, в конце 2 четверти, по 10-балльной шкале. Итога за 1 четверть нет.');
    const passFail = finals({ assessmentMode: 'PASS_FAIL', attestation: { configured: true, periodicity: 'HALF_YEAR', sochProvided: false, halfYear: half } });
    expect(attestationNote(passFail, 'Физическая культура')).toContain('СОЧ по предмету не предусмотрен');
    expect(attestationNote(finals({}), 'Математика')).toBeNull();
  });

  it('баннер: промежуточная четверть, критерии не подключены, нет оценок (Б1, Б2, У6, У3)', () => {
    const opening = { configured: true, periodicity: 'HALF_YEAR' as const, finalAllowed: false, halfYear: half };
    expect(finalsBanner(finals({ attestation: opening }, [{ result: { status: 'NO_WORKS' } }]))?.text)
      .toBe('Оценок за 1 четверть пока нет. Проценты появятся, когда на уроках будут выставлены оценки.');
    expect(finalsBanner(finals({ attestation: opening }, [{ result: { percent: 70 } }]))?.text)
      .toBe('Идёт 1 четверть: проценты текущие и ещё изменятся. Итог 1 полугодия выставляется с начала 2 четверти, с 02.11.');
    const criteria = { recommendation: { available: false, unavailableReason: 'CRITERIA_NOT_APPROVED' } };
    expect(finalsBanner(finals({ assessmentMode: 'PASS_FAIL' }, [criteria, criteria]))?.tone).toBe('warning');
    expect(finalsBanner(finals({ assessmentMode: 'PASS_FAIL' }, [{ ...criteria, finalGrade: { id: 1 } }]))).toBeNull();
    const insufficient = { recommendation: { available: false, unavailableReason: 'INSUFFICIENT_DATA' } };
    expect(finalsBanner(finals({}, [insufficient, { recommendation: { available: true, value: 7 } }]))?.text)
      .toBe('Рекомендации нет у 1 ученика: недостаточно оценок за четверть. Итог можно выбрать вручную с основанием.');
  });

  it('основание нужно, когда выбор не совпал с рекомендацией или её нет (У4, У6)', () => {
    const recommended = { available: true, value: 7, resultKind: 'NUMERIC' as const };
    expect(matchesRecommendation(recommended, 'NUMERIC', 7)).toBe(true);
    expect(matchesRecommendation(recommended, 'NUMERIC', 8)).toBe(false);
    expect(matchesRecommendation({ available: false }, 'PASS', null)).toBe(false);
    const row = { studentName: 'Ахметов Нурсултан', recommendation: { available: true, resultKind: 'FAIL' as const } };
    expect(deviationDialog(row as ClassFinalGradeRow, 'PASS', null)).toEqual({
      title: 'Итог отличается от рекомендации',
      subtitle: 'Ахметов Нурсултан · рекомендация «Незачёт», выбран «Зачёт»',
    });
    expect(deviationDialog({ studentName: 'Айгерим' } as ClassFinalGradeRow, 'PASS', null).title).toBe('Итог без рекомендации');
  });

  it('стрелка второй четверти — сравнение присланных процентов', () => {
    expect(trendOf(79, 83)).toBe('up');
    expect(trendOf(66, 62)).toBe('down');
    expect(trendOf(60, 60)).toBeNull();
    expect(trendOf(null, 60)).toBeNull();
  });
});
