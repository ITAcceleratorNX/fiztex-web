import { describe, expect, it } from 'vitest';
import type { KtpContent } from './ktpApi';
import { ktpIssueContext, ktpIssueDescription, ktpIssueTopic, optionalKtpIssueGroups, type KtpIssue } from './ktpIssues';

const content: KtpContent = { periods: [{ order: 1, title: 'I четверть', sections: [{ order: 2, title: 'Клеточная биология', topics: [
  { order: 9, sourceNumber: '12', title: 'Строение клетки' },
  { order: 1, sourceNumber: '3', title: 'Экосистемы' },
] }] }] };
const optional: KtpIssue = { code: 'OPTIONAL_FIELD_MISSING', severity: 'WARNING', fieldPath: 'topics[1].notes', actual: ' ', message: 'Необязательное поле не заполнено; его можно дополнить вручную' };

describe('KTP issue presentation', () => {
  it('uses API topic order, not the array index, and displays the document number and title', () => {
    expect(ktpIssueTopic(optional, content)?.topic.title).toBe('Экосистемы');
    expect(ktpIssueContext(optional, content)).toBe('Тема № 3 «Экосистемы»');
    expect(ktpIssueDescription(optional)).toEqual({ message: 'Не заполнено поле «Примечания». Его можно оставить пустым или дополнить вручную.', values: '' });
  });
  it('groups optional fields without swallowing warnings that need a decision', () => {
    const groups = optionalKtpIssueGroups([optional, { ...optional, fieldPath: 'topics[9].notes' },
      { ...optional, fieldPath: 'topics[9].learningObjectives' }, { code: 'TOTAL_HOURS_MISMATCH', severity: 'WARNING' }]);
    expect(groups.map(group => [group.label, group.issues.length])).toEqual([['Примечания', 2], ['Цели обучения', 1]]);
  });
  it('does not render missing or null comparison values, including string sentinels', () => {
    for (const issue of [JSON.parse('{"actual":" ","expected":null}'), { actual: 'null', expected: 'undefined' }]) {
      expect(ktpIssueDescription({ code: 'HEADER_YEAR_MISMATCH', message: 'Проверьте учебный год', ...issue }).values).toBe('');
    }
    expect(ktpIssueDescription({ code: 'HEADER_YEAR_MISMATCH', actual: '2025/2026' }).values).toBe('В файле: 2025/2026');
  });
  it('labels calculated and declared hours and resolves periods and sections by order', () => {
    const issue = { code: 'TOTAL_HOURS_MISMATCH', fieldPath: 'periods[1].sections[2].declaredHours', actual: '7', expected: '8', source: { tableNumber: 1, rowNumber: 5 } };
    const sameSource: KtpContent = { periods: [{ order: 1, title: 'I четверть', sections: [{ order: 2, title: 'Клеточная биология', topics: [{ order: 1, title: 'Первая тема раздела', source: issue.source }] }] }] };
    expect(ktpIssueContext(issue, sameSource)).toBe('I четверть · Клеточная биология');
    expect(ktpIssueTopic(issue, sameSource)).toBeUndefined();
    expect(ktpIssueDescription(issue).values).toBe('По темам: 7 ч · В документе: 8 ч');
  });
  it('keeps unmapped diagnostics readable without inventing a topic to edit', () => {
    const issue = { fieldPath: 'unrecognized.path', source: { sheetName: 'План', rowNumber: 15 } };
    expect(ktpIssueContext(issue, content)).toBe('Лист «План» · Строка 15');
    expect(ktpIssueTopic(issue, content)).toBeUndefined();
    const duplicate = { periods: [{ sections: [{ topics: [{ order: 1 }, { order: 1 }] }] }] };
    expect(ktpIssueTopic(optional, duplicate)).toBeUndefined();
  });
});
