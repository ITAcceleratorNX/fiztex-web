import { describe, expect, it } from 'vitest';
import { barMessage, collectChanges, draftKey, needsReason, scoreDraftProblem, type WorkSheet } from './journalScoresModel';

const sheet = (overrides: Partial<WorkSheet> = {}): WorkSheet => ({
  workId: 71, kind: 'SOR', maxScore: 20, canManage: true,
  students: new Map([[1, { score: 15, version: 2, inAudience: true }], [2, { score: null, version: null, inAudience: true }]]),
  ...overrides,
});

describe('ввод баллов в журнале', () => {
  it('допускает 0 и максимум, не допускает выше максимума, дробное и отрицательное', () => {
    expect(scoreDraftProblem('0', 20)).toBeNull();
    expect(scoreDraftProblem('20', 20)).toBeNull();
    expect(scoreDraftProblem('23', 20)).toBe('Не больше 20');
    expect(scoreDraftProblem('-1', 20)).toBe('Не меньше 0');
    expect(scoreDraftProblem('1.5', 20)).toBe('Только целое число');
    expect(scoreDraftProblem('abc', 20)).toBe('Только целое число');
  });

  it('пустое поле — не менять, а не ноль', () => {
    expect(scoreDraftProblem('  ', 20)).toBeNull();
    const { changes } = collectChanges(new Map([[draftKey(71, 2), '']]), new Map([[71, sheet()]]));
    expect(changes).toEqual([]);
  });

  it('собирает новые и исправленные баллы, совпавший с сохранённым игнорирует', () => {
    const drafts = new Map([[draftKey(71, 1), '17'], [draftKey(71, 2), '0']]);
    const { changes, invalid } = collectChanges(drafts, new Map([[71, sheet()]]));
    expect(invalid).toEqual([]);
    expect(changes).toEqual([
      { key: '71:1', workId: 71, kind: 'SOR', studentProfileId: 1, score: 17, before: 15, version: 2 },
      { key: '71:2', workId: 71, kind: 'SOR', studentProfileId: 2, score: 0, before: null, version: null },
    ]);
    expect(collectChanges(new Map([[draftKey(71, 1), '15']]), new Map([[71, sheet()]])).changes).toEqual([]);
  });

  it('ошибочный ввод блокирует сохранение', () => {
    const { changes, invalid } = collectChanges(new Map([[draftKey(71, 1), '23']]), new Map([[71, sheet()]]));
    expect(changes).toEqual([]);
    expect(invalid).toEqual(['71:1']);
    expect(barMessage(changes, invalid.length)).toBe('Исправьте ошибку, чтобы сохранить');
  });

  it('причина нужна только для исправления СОЧ', () => {
    const soch = sheet({ kind: 'SOCH' });
    const fix = collectChanges(new Map([[draftKey(71, 1), '17']]), new Map([[71, soch]])).changes;
    const first = collectChanges(new Map([[draftKey(71, 2), '10']]), new Map([[71, soch]])).changes;
    const sor = collectChanges(new Map([[draftKey(71, 1), '17']]), new Map([[71, sheet()]])).changes;
    expect(needsReason(fix)).toBe(true);
    expect(needsReason(first)).toBe(false);
    expect(needsReason(sor)).toBe(false);
  });

  it('подпись панели считает баллы и предупреждает об истории', () => {
    const base = { key: 'k', workId: 1, kind: 'SOR' as const, studentProfileId: 1, score: 1, before: null, version: null };
    expect(barMessage([], 0)).toBeNull();
    expect(barMessage([base, base, base], 0)).toBe('Изменено 3 балла · ещё не сохранены');
    expect(barMessage([{ ...base, before: 15 }], 0)).toBe('Изменён 1 балл · исправление попадёт в историю');
  });
});
