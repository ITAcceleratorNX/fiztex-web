import { describe, expect, it } from 'vitest';
import { copyItems, copyResultMessage, existingSummary, lessonWhen } from './preparationCopyModel';

describe('preparationCopyModel', () => {
  it('называет только заполненное в источнике и помечает непереносимый учебник', () => {
    expect(copyItems({ textbookTransferable: false, source: {
      topic: 'Давление', hasSummary: false, hasComment: false, materialCount: 0,
      textbookId: 1, textbookTitle: 'Физика 7', pageFrom: 4,
    } })).toEqual([
      { label: 'Тема', value: 'Давление' },
      { label: 'Учебник', value: 'Физика 7, стр. 4 — не назначен этому классу на дату урока', skipped: true },
    ]);
  });

  it('перечисляет то, что уже лежит в цели', () => {
    expect(existingSummary({ hasSummary: true, materialCount: 5, textbookId: 2 }))
      .toBe('конспект, 5 материалов, учебник');
    expect(existingSummary(undefined)).toBe('');
  });

  it('описывает урок датой, номером и временем', () => {
    expect(lessonWhen({ date: '2026-10-12', lessonNumber: 3, startTime: '10:00:00', endTime: '10:45:00' }))
      .toBe('Понедельник, 12 октября · 3-й урок · 10:00–10:45');
  });

  it('повтор без изменений не выдаёт за перенос', () => {
    expect(copyResultMessage({ addedMaterials: 0 })).toMatch(/уже была в уроке/);
    expect(copyResultMessage({ commentCopied: true, addedMaterials: 1 })).toBe('Перенесено: комментарий, 1 материал.');
  });
});
