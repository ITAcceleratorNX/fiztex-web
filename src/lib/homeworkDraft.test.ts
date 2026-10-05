import { describe, expect, it } from 'vitest';
import { homeworkFormReturnTo } from './homeworkDraft';

describe('homework group return target', () => {
  it.each(['/homework/new', '/homework/new?lessonId=5', '/homework/new?classId=7&subjectId=3', '/homework/8/edit'])('сохраняет форму %s', (url) => {
    expect(homeworkFormReturnTo(url)).toBe(url);
  });
  it.each(['https://evil.test/homework/new', '//evil.test/homework/new', '/\\evil.test/homework/new', '/homework/8', 'javascript:alert(1)'])('отбрасывает %s', (url) => {
    expect(homeworkFormReturnTo(url)).toBeNull();
  });
  it('исключает лишние параметры, hash и некорректный ID', () => {
    expect(homeworkFormReturnTo('/homework/new?lessonId=5&returnTo=https://evil.test#hidden')).toBe('/homework/new?lessonId=5');
    expect(homeworkFormReturnTo('/homework/new?lessonId=-1')).toBe('/homework/new');
    expect(homeworkFormReturnTo('/homework/new?classId=7&subjectId=3&returnTo=https://evil.test#hidden'))
      .toBe('/homework/new?classId=7&subjectId=3');
    expect(homeworkFormReturnTo('/homework/new?classId=-1&subjectId=3')).toBe('/homework/new?subjectId=3');
  });

  it('после настройки группы возвращает в форму с источником рабочего пространства', () => {
    const returnTo = '/workspace/sections/HOMEWORK?page=2';
    const form = `/homework/8/edit?${new URLSearchParams({ returnTo })}`;
    expect(homeworkFormReturnTo(form)).toBe(form);
  });
});
