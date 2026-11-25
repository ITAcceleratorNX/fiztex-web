import { describe, expect, it } from 'vitest';
import {
  absenceStatusBadge,
  commandErrorText,
  confirmedSignature,
  dayTitle,
  describeDayReasonEvent,
  groupCount,
  groupOf,
  historyLine,
  isStaleDayError,
  lessonsCount,
  listDate,
  listReason,
  pendingResponsesChip,
  studentShortName,
  teacherShortName,
  type AbsenceDay,
} from './absenceReasonModel';

describe('absenceReasonModel', () => {
  it('names day states with the words of the spec', () => {
    expect(absenceStatusBadge('NOT_SPECIFIED')).toEqual({ label: 'Не указана', tone: 'red' });
    expect(absenceStatusBadge('AWAITING_PARENT').label).toBe('Запрошена');
    expect(absenceStatusBadge('AWAITING_CONFIRMATION').label).toBe('На проверке');
    expect(absenceStatusBadge('CLARIFICATION_NEEDED').label).toBe('Уточнение');
    expect(absenceStatusBadge('CONFIRMED')).toEqual({ label: 'Подтверждена', tone: 'green' });
    expect(absenceStatusBadge(undefined).label).toBe('Не указана');
  });

  it('adds the answers chip next to the status instead of replacing it', () => {
    expect(pendingResponsesChip('AWAITING_CONFIRMATION', 1)).toBeNull();
    expect(pendingResponsesChip('AWAITING_CONFIRMATION', 2)).toBe('2 ответа');
    expect(pendingResponsesChip('CONFIRMED', 1)).toBe('1 ответ');
    expect(pendingResponsesChip('CONFIRMED', 0)).toBeNull();
  });

  it('reads the state filter from the address and defaults to «requires action»', () => {
    expect(groupOf(null)).toBe('ACTION_REQUIRED');
    expect(groupOf('CONFIRMED')).toBe('CONFIRMED');
    expect(groupOf('ALL')).toBe('ALL');
    expect(groupOf('broken')).toBe('ACTION_REQUIRED');
    const counts = { actionRequired: 4, awaitingParent: 2, confirmed: 4, all: 10 };
    expect(groupCount(counts, 'ALL')).toBe(10);
    expect(groupCount(counts, 'AWAITING_PARENT')).toBe(2);
    expect(groupCount(undefined, 'ALL')).toBeNull();
  });

  it('formats the school date without shifting through UTC', () => {
    expect(listDate('2026-11-17')).toBe('17.11.2026');
    expect(dayTitle('2026-11-17')).toBe('Вторник, 17 ноября');
    expect(lessonsCount(1)).toBe('1 урок');
    expect(lessonsCount(3)).toBe('3 урока');
    expect(lessonsCount(6)).toBe('6 уроков');
  });

  it('shortens teacher and student names the way the lists sign them', () => {
    expect(teacherShortName('Сапарова Айгуль Каримовна')).toBe('Сапарова А.К.');
    expect(teacherShortName('')).toBe('Классный руководитель');
    expect(studentShortName('Жумабаев Ерасыл')).toBe('Жумабаев Е.');
  });

  it('describes history impersonally, naming a parent by relation', () => {
    expect(historyLine({ action: 'REQUEST_SENT', actorRole: 'HOMEROOM_TEACHER', actorName: 'Сапарова Айгуль' }))
      .toEqual({ actor: 'Сапарова А.', action: 'Запрошена причина у родителя' });
    expect(historyLine({
      action: 'RESPONSE_SUBMITTED', actorRole: 'PARENT', actorName: 'Жумабаева Гульнара',
      actorRelationType: 'MOTHER', newReason: 'ILLNESS',
    })).toEqual({ actor: 'Жумабаева Гульнара (мама)', action: 'Указана причина «Болезнь»' });
    expect(historyLine({
      action: 'REASON_CHANGED', actorRole: 'HOMEROOM_TEACHER', actorName: 'Сапарова Айгуль Каримовна',
      oldReason: 'ILLNESS', newReason: 'FAMILY',
    }).action).toBe('Причина изменена: «Болезнь» → «Семейные обстоятельства»');
  });

  it('signs a confirmed parent answer with its author and the confirming teacher', () => {
    const day: AbsenceDay = {
      status: 'CONFIRMED',
      reason: {
        reason: 'ILLNESS', source: 'PARENT_RESPONSE', confirmedResponseId: 7,
        setByName: 'Сапарова Айгуль Каримовна', setAt: '2026-11-18T08:10:00Z',
      },
      responses: [{ responseId: 7, parentName: 'Жумабаева Гульнара', parentRelationType: 'MOTHER', status: 'CONFIRMED' }],
    };
    expect(confirmedSignature(day)).toMatch(/^Жумабаева Гульнара \(мама\) · подтверждено: Сапарова А\.К\. · 18\.11, \d\d:10$/);
    expect(confirmedSignature({ ...day, reason: { ...day.reason, source: 'HOMEROOM_TEACHER' } }))
      .toMatch(/^Сапарова А\.К\. · классный руководитель · 18\.11/);
  });

  it('shows the confirmed reason or a single pending answer in the list, a dash otherwise', () => {
    expect(listReason({ reason: 'FAMILY' }).text).toBe('Семейные обстоятельства');
    expect(listReason({ pendingResponseCount: 1, latestResponse: { status: 'PENDING', reason: 'ILLNESS' } }).text)
      .toBe('Болезнь');
    expect(listReason({ pendingResponseCount: 2, latestResponse: { status: 'PENDING', reason: 'ILLNESS' } }))
      .toEqual({ text: '—', muted: true });
  });

  it('describes a lesson history line about the day reason', () => {
    expect(describeDayReasonEvent({
      kind: 'CONFIRMED', newReason: 'ILLNESS', actorName: 'Сапарова Айгуль Каримовна', studentName: 'Жумабаев Ерасыл',
    })).toBe('Сапарова А.К. · Классный руководитель · Подтверждена причина «Болезнь» — Жумабаев Е.');
  });

  it('explains command failures and refreshes the card only when the server state moved on', () => {
    expect(commandErrorText('ABSENCE_REASON_VERSION_CONFLICT')).toMatch(/день изменился/);
    expect(commandErrorText(undefined)).toMatch(/введённое не потеряется/);
    expect(isStaleDayError('ABSENCE_REASON_VERSION_CONFLICT')).toBe(true);
    expect(isStaleDayError('ABSENCE_REASON_TEXT_TOO_LONG')).toBe(false);
  });
});
