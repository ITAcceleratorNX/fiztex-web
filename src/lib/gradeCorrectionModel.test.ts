import { describe, expect, it } from 'vitest';
import type { GradeCorrection, GradeCorrectionHistoryEvent } from '@/lib/gradeCorrectionsApi';
import {
  correctionBadge,
  describeCorrectionEvent,
  gradeValueKey,
  rowCorrection,
  shortDate,
  temporaryGradeLabel,
} from './gradeCorrectionModel';

function correction(overrides: Partial<GradeCorrection>): GradeCorrection {
  return { id: 1, studentProfileId: 5, status: 'REQUIRED', overdue: false, deadline: '2026-10-21', ...overrides };
}

// OpenAPI treats JsonNode as opaque; these fixtures exercise its actual JSON content.
function historySnapshot(value: Record<string, unknown>): GradeCorrectionHistoryEvent['after'] {
  return value as unknown as GradeCorrectionHistoryEvent['after'];
}

describe('gradeCorrectionModel', () => {
  it('у строки — открытое исправление, а без него последнее завершённое', () => {
    const list = [
      correction({ id: 1, status: 'COMPLETED' }),
      correction({ id: 2, status: 'CANCELLED' }),
      correction({ id: 3, status: 'COMPLETED' }),
    ];
    expect(rowCorrection(list, 5)).toEqual({ open: null, completed: list[2] });

    const withOpen = [...list, correction({ id: 4, status: 'OVERDUE', overdue: true })];
    expect(rowCorrection(withOpen, 5).open?.id).toBe(4);
    expect(rowCorrection(withOpen, 5).completed).toBeNull();
    expect(rowCorrection(withOpen, 6)).toEqual({ open: null, completed: null });
  });

  it('бейдж говорит статусом сервера, а не сравнением дат', () => {
    expect(correctionBadge(correction({}))).toEqual({
      tone: 'warning',
      text: 'Требуется исправление · до 21 окт',
    });
    expect(correctionBadge(correction({ status: 'OVERDUE', overdue: true }))).toEqual({
      tone: 'danger',
      text: 'Срок истёк · было до 21 окт',
    });
  });

  it('временная оценка — в той же записи, что и обычная', () => {
    expect(temporaryGradeLabel({ scaleCode: '4+' })).toBe('4+');
    expect(temporaryGradeLabel({ score: 8, maxScore: 10 })).toBe('8');
    expect(temporaryGradeLabel({ score: 15, maxScore: 20 })).toBe('15/20');
    expect(temporaryGradeLabel(null)).toBeNull();
    expect(gradeValueKey({ score: 8 })).toBe(gradeValueKey({ score: 8.0 }));
  });

  it('события истории читаются словами макета', () => {
    expect(
      describeCorrectionEvent({
        action: 'DEADLINE_CHANGED',
        before: historySnapshot({ deadline: '2026-10-21' }),
        after: historySnapshot({ deadline: '2026-10-28' }),
      }),
    ).toBe('Срок продлён до 28 окт');
    expect(describeCorrectionEvent({ action: 'TEMPORARY_GRADE_CHANGED', after: historySnapshot({ temporaryScore: 8 }) })).toBe(
      'Выставлена временная оценка: 8',
    );
    expect(describeCorrectionEvent({ action: 'EXPIRED', after: {} })).toBe('Срок истёк');
    expect(shortDate('2026-01-05')).toBe('5 янв');
  });
});
