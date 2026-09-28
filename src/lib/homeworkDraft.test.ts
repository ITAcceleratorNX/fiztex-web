import { describe, expect, it } from 'vitest';
import { homeworkFormReturnTo } from './homeworkDraft';

describe('homework group return target', () => {
  it.each(['/homework/new', '/homework/new?lessonId=5', '/homework/8/edit'])('сохраняет форму %s', (url) => {
    expect(homeworkFormReturnTo(url)).toBe(url);
  });
  it.each(['https://evil.test/homework/new', '//evil.test/homework/new', '/\\evil.test/homework/new', '/homework/8', 'javascript:alert(1)'])('отбрасывает %s', (url) => {
    expect(homeworkFormReturnTo(url)).toBeNull();
  });
  it('исключает лишние параметры, hash и некорректный ID', () => {
    expect(homeworkFormReturnTo('/homework/new?lessonId=5&returnTo=https://evil.test#hidden')).toBe('/homework/new?lessonId=5');
    expect(homeworkFormReturnTo('/homework/new?lessonId=-1')).toBe('/homework/new');
  });
});
