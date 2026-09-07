import { describe, expect, it } from 'vitest';
import {
  isScoreDraftDirty,
  mergeScoreDrafts,
  scoreDraftFrom,
  scoreFromDraft,
} from './homeworkAnswerReviewModel';

function answer(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    maxScore: 2,
    finalScore: null,
    teacherComment: null,
    ...overrides,
  };
}

describe('homeworkAnswerReviewModel', () => {
  it('не считает 1.50 и 1.5 разными несохранёнными решениями', () => {
    const server = answer({ finalScore: 1.5 });
    expect(isScoreDraftDirty({ score: '1.50', comment: '' }, server)).toBe(false);
  });

  it('сохраняет несохранённый черновик, когда refetch принёс подсказку ИИ', () => {
    const server = answer({ aiSuggestedScore: 1.5 });
    const drafts = mergeScoreDrafts([server], { 10: { score: '2', comment: 'Проверю ещё раз' } });
    expect(drafts[10]).toEqual({ score: '2', comment: 'Проверю ещё раз' });
  });

  it('для чистого поля берёт обновлённое решение с сервера', () => {
    const server = answer({ finalScore: 1, teacherComment: 'Сохранено' });
    const drafts = mergeScoreDrafts([server], { 10: scoreDraftFrom(server) });
    expect(drafts[10]).toEqual({ score: '1', comment: 'Сохранено' });
  });

  it('не даёт отправить пустой или выходящий за максимум балл', () => {
    expect(scoreFromDraft({ score: '', comment: '' }, 2)).toBeNull();
    expect(scoreFromDraft({ score: '2.01', comment: '' }, 2)).toBeNull();
    expect(scoreFromDraft({ score: '1.25', comment: '' }, 2)).toBe(1.25);
  });
});
