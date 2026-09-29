import { describe, expect, it } from 'vitest';
import { surveyCardPath, surveyListReturnTo } from './surveyListNavigation';

describe('returnTo списка опросов', () => {
  it('сохраняет только текущий статус и страницу соответствующего списка', () => {
    const list = '/psychologist/tests?status=COMPLETED&page=4';
    const card = surveyCardPath(list, '/psychologist/tests/17');
    expect(card).toBe('/psychologist/tests/17?returnTo=%2Fpsychologist%2Ftests%3Fstatus%3DCOMPLETED%26page%3D4');
    expect(surveyListReturnTo(new URL(card, 'http://local').search, 'psychology')).toBe(list);
  });

  it.each(['https://example.com', '//example.com', '/surveys/1', '/psychologist/tests/5', '/admin'])('rejects unsafe list path %s', (target) => {
    expect(surveyListReturnTo(`?${new URLSearchParams({ returnTo: target })}`, 'school')).toBe('/surveys');
  });

  it('drops unknown parameters and invalid status or page', () => {
    const query = `?${new URLSearchParams({ returnTo: '/surveys?status=EVIL&page=-3&redirect=https://example.com' })}`;
    expect(surveyListReturnTo(query, 'school')).toBe('/surveys');
  });
});
