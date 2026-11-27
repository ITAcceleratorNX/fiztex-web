import { describe, expect, it } from 'vitest';
import type { AccessJournalEventType } from '@/lib/accessJournalApi';
import { detailsSummary, eventLabel, subjectRoleLabel } from './accessJournalModel';

describe('подписи журнала доступа', () => {
  it('переводит тип события в глагол', () => {
    expect(eventLabel('REQUEST_APPROVED_CREATED').label).toBe('Заявка одобрена — создан профиль');
    expect(eventLabel('STUDENT_PIN_RESET').tone).toBe('amber');
  });

  it('не прячет строку с незнакомым типом', () => {
    expect(eventLabel('SOMETHING_NEW' as AccessJournalEventType))
      .toEqual({ label: 'SOMETHING_NEW', tone: 'gray' });
  });

  it('роль субъекта необязательна', () => {
    expect(subjectRoleLabel('PARENT')).toBe('Родитель');
    expect(subjectRoleLabel(undefined)).toBeNull();
  });
});

describe('подробности строки', () => {
  it('разбирает поля заявки', () => {
    expect(detailsSummary({ role: 'STUDENT', className: '5А', hasPhone: false } as never))
      .toEqual(['ученик', 'класс 5А', 'без телефона']);
  });

  it('молчит о том, что ничего не добавляет', () => {
    expect(detailsSummary({ passwordProvided: false } as never)).toEqual([]);
  });

  it('срок разрешения печатает датой, а не моментом', () => {
    expect(detailsSummary({ expiresAt: '2026-12-05T12:00:00Z', teacherProfileId: 31 } as never))
      .toEqual(['действует до 5 дек. 2026', 'учитель #31']);
  });

  it('незнакомый ключ печатает как есть', () => {
    expect(detailsSummary({ somethingNew: 42 } as never)).toEqual(['somethingNew: 42']);
  });

  it('пустые подробности — пустой список', () => {
    expect(detailsSummary(undefined)).toEqual([]);
  });
});

describe('права на учебные данные в журнале', () => {
  it('называет событие и раскладывает снимки «было / стало» словами', () => {
    expect(eventLabel('STUDY_ACCESS_CHANGED').label).toBe('Изменён просмотр учебных данных');
    expect(detailsSummary({
      school: 'Физтех',
      teacherName: 'Сапарова Айгерим Кайратовна',
      grantId: 7,
      versionId: 15,
      revision: 2,
      academicYear: '2026/2027',
      validUntil: null,
      previous: { sections: ['ATTENDANCE', 'GRADES'], scope: { type: 'CLASSES', classes: [{ id: 1, name: '8А' }] }, validUntil: '2027-05-31' },
      current: { sections: ['GRADES'], scope: { type: 'PARALLELS', parallels: ['10', '9'] }, validUntil: null },
      cause: 'ROLE_CHANGED',
    } as never)).toEqual([
      'право № 7',
      'учебный год 2026/2027',
      'бессрочно',
      'было: Оценки и Посещаемость · 8А · до 31.05.2027',
      'стало: Оценки · Параллели 9, 10 · бессрочно',
      'у учителя сменилась роль',
    ]);
  });
});

