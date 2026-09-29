import { describe, expect, it } from 'vitest';
import { homeworkListReturnTo, readHomeworkListState, writeHomeworkListState } from './homeworkListNavigation';

describe('URL списка домашних заданий', () => {
  it('восстанавливает все фильтры и номер страницы после перезагрузки', () => {
    const query = new URLSearchParams('scope=HISTORY&page=3&classId=7&subjectId=4&status=COMPLETED&dueFrom=2026-09-01&dueTo=2026-09-30&pendingReviewOnly=true');
    const state = readHomeworkListState(query);
    expect(state).toEqual({ scope: 'HISTORY', page: 2, filters: {
      classId: 7, subjectId: 4, status: 'COMPLETED', dueFrom: '2026-09-01', dueTo: '2026-09-30', pendingReviewOnly: true,
    } });
    expect(writeHomeworkListState(state).toString()).toBe(query.toString());
  });

  it.each(['-1', '0', 'NaN', '1.5', '1e3', '9007199254740992'])('игнорирует повреждённые числа %s', (value) => {
    expect(readHomeworkListState(new URLSearchParams({ page: value, classId: value, subjectId: value })))
      .toMatchObject({ page: 0, filters: { classId: undefined, subjectId: undefined } });
  });

  it('отбрасывает невозможные даты и статус чужой вкладки', () => {
    expect(readHomeworkListState(new URLSearchParams('scope=BAD&status=COMPLETED&dueFrom=2026-02-30&dueTo=bad')))
      .toMatchObject({ scope: 'ACTUAL', filters: { status: undefined, dueFrom: undefined, dueTo: undefined } });
  });

  it.each(['https://example.com', '//example.com', '/homework/42', '/homework\\evil', '/homework#evil', '/admin'])('не принимает произвольный returnTo %s', (target) => {
    expect(homeworkListReturnTo(`?${new URLSearchParams({ returnTo: target })}`)).toBe('/homework');
  });

  it('возвращает только разрешённые параметры списка', () => {
    expect(homeworkListReturnTo(`?${new URLSearchParams({ returnTo: '/homework?page=2&classId=7&redirect=https://example.com' })}`))
      .toBe('/homework?page=2&classId=7');
  });
});
