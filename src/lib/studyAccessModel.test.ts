import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import type { StudyAccessGrant, StudyAccessOptions } from './studyAccessApi';
import {
  FORM_ERROR,
  emptyGrantForm,
  grantForm,
  grantRequest,
  reissueForm,
  remainingLabel,
  revokeMessage,
  schoolScopeNotice,
  scopeLabel,
  serverGrantErrors,
  teacherShortName,
  validateGrantForm,
  validityLabel,
  withScopeType,
  withYear,
} from './studyAccessModel';

const grant: StudyAccessGrant = {
  id: 7,
  revision: 2,
  state: 'ACTIVE',
  sections: ['ATTENDANCE', 'GRADES'],
  academicYear: { id: 3, name: '2026/2027', current: true, status: 'ACTIVE' },
  scope: { type: 'CLASSES', classes: [{ id: 11, name: '8А' }, { id: 12, name: '8Б' }], parallels: [] },
  validUntil: '2027-05-31',
  retainedElsewhere: 'NONE',
};

const options: StudyAccessOptions = {
  defaultYearId: 3,
  years: [{ id: 3, name: '2026/2027', current: true, classCount: 12, studentCount: 284 }],
};

describe('подписи', () => {
  it('область: классы, параллели по возрастанию, вся школа', () => {
    expect(scopeLabel(grant.scope)).toBe('8А, 8Б');
    expect(scopeLabel({ type: 'PARALLELS', parallels: ['11', '9', '10'] })).toBe('Параллели 9, 10, 11');
    expect(scopeLabel({ type: 'PARALLELS', parallels: ['5'] })).toBe('Параллель 5');
    expect(scopeLabel({ type: 'SCHOOL' })).toBe('Вся школа');
  });

  it('срок и остаток как в макете', () => {
    expect(validityLabel('2027-05-31')).toBe('до 31.05.2027');
    expect(validityLabel(null)).toBe('Бессрочно');
    expect(remainingLabel(38)).toBe('ещё 38 дн.');
    expect(remainingLabel(189)).toBe('ещё 6 мес.');
    expect(remainingLabel(0)).toBe('последний день');
    expect(remainingLabel(null)).toBeNull();
  });

  it('предупреждение «Вся школа» — цифры сервера', () => {
    expect(schoolScopeNotice(options.years![0])).toBe(
      'Все классы школы за выбранный год — 12 классов, 284 ученика. Новые классы этого года попадут в доступ автоматически.',
    );
  });

  it('короткое имя учителя', () => {
    expect(teacherShortName('Сапарова Айгерим Кайратовна')).toBe('Сапарова А.К.');
  });
});

describe('подтверждение отзыва', () => {
  it('называет разделы и область записи', () => {
    const message = revokeMessage(grant, 'Сапарова Айгерим Кайратовна');
    expect(message.lead).toBe('Сапарова А.К. перестанет видеть ');
    expect(message.subject).toBe('оценки и посещаемость 8А, 8Б');
    expect(message.tail).toContain('Запись об отзыве сохранится в карточке.');
  });

  it('прошлый год и параллели — с годом и в родительном падеже', () => {
    const message = revokeMessage({
      ...grant,
      sections: ['ANALYTICS'],
      academicYear: { id: 2, name: '2025/2026', current: false },
      scope: { type: 'PARALLELS', parallels: ['9', '10'] },
    }, 'Сапарова Айгерим Кайратовна');
    expect(message.subject).toBe('учебную аналитику параллелей 9, 10 за 2025/2026');
  });

  it('не обещает потерю того, что открыто другим правом', () => {
    expect(revokeMessage({ ...grant, retainedElsewhere: 'FULL' }, 'Сапарова Айгерим Кайратовна').lead)
      .toBe('Эта запись будет отозвана, но Сапарова А.К. продолжит видеть ');
    expect(revokeMessage({ ...grant, retainedElsewhere: 'PARTIAL' }, 'Сапарова Айгерим Кайратовна').tail)
      .toMatch(/^, кроме того, что открыто другими действующими правами\./);
  });
});

describe('форма', () => {
  it('заполняется выбранным правом и отправляет только поля своего режима', () => {
    const form = grantForm(grant);
    expect(form).toMatchObject({ sections: ['GRADES', 'ATTENDANCE'], classIds: [11, 12], term: 'UNTIL', validUntil: '2027-05-31' });
    expect(grantRequest(withScopeType(form, 'SCHOOL'))).toEqual({
      sections: ['GRADES', 'ATTENDANCE'],
      academicYearId: 3,
      scope: { type: 'SCHOOL', classIds: [], parallels: [] },
      validUntil: '2027-05-31',
    });
  });

  it('смена года и режима сбрасывает выбранные классы', () => {
    const form = grantForm(grant);
    expect(withYear(form, 2).classIds).toEqual([]);
    expect(withYear(form, 3)).toBe(form);
    expect(withScopeType(form, 'PARALLELS')).toMatchObject({ classIds: [], parallels: [] });
  });

  it('бессрочный срок уходит пустым', () => {
    expect(grantRequest({ ...grantForm(grant), term: 'OPEN' }).validUntil).toBeNull();
  });

  it('«Выдать снова» не переносит прошедший срок', () => {
    expect(reissueForm({ ...grant, validUntil: '2026-10-31' }, options, '2026-11-25').validUntil).toBe('');
    expect(reissueForm(grant, options, '2026-11-25').validUntil).toBe('2027-05-31');
  });

  it('проверка — словами сервера (А14)', () => {
    const errors = validateGrantForm({ ...emptyGrantForm(3), validUntil: '2026-11-01' }, '2026-11-25');
    expect(errors).toEqual({
      sections: 'Выберите хотя бы один раздел',
      scope: 'Выберите хотя бы один класс',
      validUntil: 'Дата уже прошла — выберите дату позже сегодняшней',
      form: FORM_ERROR,
    });
    expect(validateGrantForm({ ...grantForm(grant), validUntil: '2026-11-25' }, '2026-11-25').validUntil)
      .toBe('Выберите дату позже сегодняшней');
  });

  it('оставленный при изменении срок не перепроверяется', () => {
    const kept = { ...grantForm(grant), validUntil: '2026-11-20' };
    expect(validateGrantForm(kept, '2026-11-25', '2026-11-20')).toEqual({});
  });

  it('отказ сервера раскладывается по полям', () => {
    const error = new ApiError(400, FORM_ERROR, 'STUDY_ACCESS_INVALID', [
      { field: 'scope.classIds', message: 'Класс 7А относится к другому учебному году — выдайте для него отдельное право' },
      { field: 'expectedRevision', message: 'Ревизия не может быть отрицательной' },
    ]);
    expect(serverGrantErrors(error)).toEqual({
      form: 'Ревизия не может быть отрицательной',
      scope: 'Класс 7А относится к другому учебному году — выдайте для него отдельное право',
    });
    expect(serverGrantErrors(new ApiError(0, 'нет связи'))).toBeNull();
  });
});
