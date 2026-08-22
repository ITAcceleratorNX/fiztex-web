import { describe, expect, it } from 'vitest';
import type { Homework } from '@/lib/homeworkApi';
import { dueLabel } from './homeworkModel';

const hw = (over: Partial<Homework>): Homework => ({ id: 1, title: 'ДЗ', ...over }) as Homework;

describe('dueLabel', () => {
  it('«без срока» — это выбор, а не пустая дата', () => {
    expect(dueLabel(hw({ dueType: 'NONE' }))).toBe('Без срока');
  });

  it('черновик «до следующего урока» не притворяется бессрочным', () => {
    // Момент подставит бэкенд при публикации, до неё даты нет — но срок выбран.
    expect(dueLabel(hw({ dueType: 'NEXT_LESSON' }))).toBe('До следующего урока');
  });

  it('после публикации у «следующего урока» появляется дата и остаётся пояснение', () => {
    const label = dueLabel(hw({ dueType: 'NEXT_LESSON', dueAt: '2026-10-20T15:00:00Z' }));
    expect(label).toContain('(следующий урок)');
    expect(label).not.toBe('(следующий урок)');
  });

  it('в узкой колонке остаётся только дата', () => {
    const label = dueLabel(hw({ dueType: 'NEXT_LESSON', dueAt: '2026-10-20T15:00:00Z' }), { short: true });
    expect(label).not.toContain('следующий урок');
    expect(label).toMatch(/20/);
  });
});
