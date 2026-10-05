import { describe, expect, it } from 'vitest';
import {
  homeworkCardFromWorkspace, homeworkCardReturnTo, homeworkListReturnTo,
  readHomeworkListState, withHomeworkReturnTo, writeHomeworkListState,
} from './homeworkListNavigation';

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

  it.each([
    '/workspace/sections/HOMEWORK?page=2',
    '/workspace/folders/17?page=3',
    '/workspace?type=HOMEWORK&q=проверочная&page=1',
  ])('сохраняет возврат в рабочее пространство: %s', (source) => {
    const location = new URL(source, 'https://fiztex.local');
    const returnTo = location.pathname + location.search;
    const cardUrl = homeworkCardFromWorkspace(42, location);
    const search = new URL(cardUrl, 'https://fiztex.local').search;
    expect(homeworkCardReturnTo(search)).toBe(returnTo);
    expect(withHomeworkReturnTo('/homework/42/edit', search)).toBe(`/homework/42/edit?${new URLSearchParams({ returnTo })}`);
    expect(withHomeworkReturnTo('/homework/42', search)).toBe(cardUrl);
  });

  it.each([
    'https://example.com/workspace', '//example.com/workspace', '/workspace\\evil',
    '/workspace/sections/TEXTBOOKS', '/workspace/folders/0', '/workspace/folders/999999999999999999999',
    '/workspace#other', '/admin',
  ])('не принимает произвольный источник карточки %s', (source) => {
    const search = `?${new URLSearchParams({ returnTo: source })}`;
    expect(homeworkCardReturnTo(search)).toBe('/homework');
  });
});
