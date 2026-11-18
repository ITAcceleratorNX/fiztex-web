import { describe, expect, it } from 'vitest';
import type { AttestationPreview, AttestationSetting } from './attestationSettingsApi';
import {
  changeRows,
  classesCaption,
  fullDate,
  initialForm,
  periodBefore,
  periodGenitive,
  previewProblem,
  ruleDifference,
  ruleLine,
  subjectSummary,
  termCaption,
  toRequest,
} from './subjectAttestationModel';

const q = (id: number, name: string, startDate: string) => ({ id, name, startDate, endDate: startDate });
const Q1 = q(1, '1 четверть', '2026-09-01');
const Q2 = q(2, '2 четверть', '2026-11-02');
const Q3 = q(3, '3 четверть', '2027-01-12');
const Q4 = q(4, '4 четверть', '2027-04-01');

function setting(patch: Partial<AttestationSetting>): AttestationSetting {
  return { id: 1, parallel: '5', resultFormat: 'NUMERIC', periodicity: 'QUARTER', sochProvided: true,
    state: 'ACTIVE', effectiveFrom: Q1, classNames: ['5А', '5Б', '5В'], ...patch };
}

describe('subjectAttestationModel', () => {
  it('правило строкой и отличие от умолчания (А1, А2)', () => {
    const rule = { resultFormat: 'PASS_FAIL', periodicity: 'HALF_YEAR', sochProvided: false } as const;
    expect(ruleLine(rule)).toBe('Зачёт / Незачёт · полугодие · без СОЧ');
    expect(ruleDifference(rule)).toBe('Зачёт · Полугодие · Без СОЧ');
    expect(ruleDifference({ resultFormat: 'NUMERIC', periodicity: 'HALF_YEAR', sochProvided: true })).toBe('Полугодие');
  });

  it('соседние параллели с одним правилом склеиваются, умолчания нет в сводке', () => {
    const passFail = { resultFormat: 'PASS_FAIL', periodicity: 'HALF_YEAR', sochProvided: false } as const;
    const lines = subjectSummary([
      setting({ parallel: '6', ...passFail }),
      setting({ parallel: '5', ...passFail }),
      setting({ parallel: '7', ...passFail }),
      setting({ parallel: '9', ...passFail }),
      setting({ parallel: '10', ...passFail, state: 'SCHEDULED' }),
      setting({ parallel: undefined, classId: 3, className: '11А', periodicity: 'HALF_YEAR' }),
    ]);
    expect(lines).toEqual([
      { scope: '5–7 кл.', rule: 'Зачёт · Полугодие · Без СОЧ' },
      { scope: '9 кл.', rule: 'Зачёт · Полугодие · Без СОЧ' },
      { scope: '11А', rule: 'Полугодие' },
    ]);
  });

  it('классы — списком до четырёх, дальше числом', () => {
    expect(classesCaption(['5А', '5Б', '5В'])).toBe('5А, 5Б, 5В');
    expect(classesCaption(Array.from({ length: 12 }, (_, i) => `${i}`))).toBe('12 классов');
  });

  it('дата аудита читается и строкой, и массивом Jackson', () => {
    expect(fullDate('2027-01-12')).toBe('12.01.2027');
    expect(fullDate([2027, 1, 12])).toBe('12.01.2027');
    expect(fullDate(null)).toBe('');
  });

  it('срок версии словами (А2, А5)', () => {
    expect(periodGenitive('3 четверть')).toBe('3 четверти');
    expect(termCaption(setting({}))).toBe('с 1 четверти');
    expect(termCaption(setting({ effectiveTo: Q3 }), [Q1, Q2, Q3, Q4])).toBe('с 1 по 2 четверть');
    expect(termCaption(setting({ state: 'SCHEDULED', effectiveFrom: Q3 }))).toBe('с 3 четверти, 12.01.2027');
  });

  it('форма: умолчание ТЗ, область обязательна, начало — по выбору или сервером', () => {
    const form = initialForm(null, '5');
    expect(form).toMatchObject({ scope: 'PARALLEL', parallel: '5', resultFormat: 'NUMERIC', periodicity: 'QUARTER', sochProvided: true });
    expect(toRequest({ ...form, scope: 'CLASS' }, 1, 2)).toBeNull();
    expect(toRequest(form, 1, 2)).toEqual({ academicYearId: 1, subjectId: 2, parallel: '5', classId: undefined,
      resultFormat: 'NUMERIC', periodicity: 'QUARTER', sochProvided: true, effectiveFromPeriodId: undefined });
  });

  it('причина отказа: сначала поле периода, потом пересечение и итоги (А6–А8)', () => {
    const base: AttestationPreview = {
      effectiveFrom: Q2, earliestAllowed: Q3, canSave: false, conflicts: [], finalsInScope: 0,
      periods: [
        { period: Q1, available: false, unavailableReason: 'STARTED' },
        { period: Q2, available: false, unavailableReason: 'STARTED', message: 'уже начался' },
        { period: Q3, available: true },
      ],
    };
    expect(previewProblem(base)).toMatchObject({ kind: 'PERIOD', option: { period: { id: 2 } } });
    const atQ3 = { ...base, effectiveFrom: Q3 };
    expect(previewProblem({ ...atQ3, conflicts: [setting({})] })).toMatchObject({ kind: 'OVERLAP' });
    expect(previewProblem({ ...atQ3, finalsInScope: 3, finalsClassNames: ['5А', '5Б'] }))
      .toEqual({ kind: 'FINALS', count: 3, classNames: ['5А', '5Б'] });
    expect(previewProblem({ ...atQ3, canSave: true })).toBeNull();
    expect(periodBefore(atQ3, 3)).toBe('2 четверть');
  });

  it('окно подтверждения называет только то, что меняется (А4)', () => {
    const form = { ...initialForm(null, '5'), periodicity: 'HALF_YEAR' as const };
    const rows = changeRows(form, '5 параллель: 5А, 5Б, 5В', 'С 3 четверти, 12.01.2027',
      { resultFormat: 'PASS_FAIL', periodicity: 'HALF_YEAR', sochProvided: false });
    expect(rows.find((row) => row.key === 'format')).toMatchObject({ value: '10-балльная', was: 'Зачёт / Незачёт' });
    expect(rows.find((row) => row.key === 'period')?.was).toBeNull();
    expect(rows.find((row) => row.key === 'soch')).toMatchObject({ value: 'Предусмотрен', was: 'не предусмотрен' });
  });
});
