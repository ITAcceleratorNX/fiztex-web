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
