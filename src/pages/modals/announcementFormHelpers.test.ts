import { describe, expect, it } from 'vitest';
import {
  EMPTY_ANNOUNCEMENT_FORM,
  fromDateTimeLocal,
  toAnnouncementRequest,
  toDateTimeLocal,
  validateAnnouncementForm,
} from './announcementFormHelpers';

describe('toDateTimeLocal', () => {
  it('обрезает секунды до формата datetime-local', () => {
    expect(toDateTimeLocal('2026-09-12T10:00:00')).toBe('2026-09-12T10:00');
  });

  it('не сдвигает время в зону браузера', () => {
    // Ключевое свойство: значение уже в школьном времени. Прогон через `Date`
    // сместил бы «10:00» у администратора из другого часового пояса.
    expect(toDateTimeLocal('2026-01-01T23:30:00')).toBe('2026-01-01T23:30');
    expect(toDateTimeLocal('2026-06-30T00:15:00')).toBe('2026-06-30T00:15');
  });

  it('пустое значение — дата не назначена', () => {
    expect(toDateTimeLocal(undefined)).toBe('');
    expect(toDateTimeLocal(null)).toBe('');
    expect(toDateTimeLocal('')).toBe('');
  });
});

describe('fromDateTimeLocal', () => {
  it('пустое поле отправляется как отсутствие даты, а не как пустая строка', () => {
    expect(fromDateTimeLocal('')).toBeUndefined();
    expect(fromDateTimeLocal('   ')).toBeUndefined();
  });

  it('заполненное поле уходит без изменений', () => {
    expect(fromDateTimeLocal('2026-09-12T10:00')).toBe('2026-09-12T10:00');
  });
});

describe('validateAnnouncementForm', () => {
  it('требует название и класс — как и бэкенд', () => {
    expect(validateAnnouncementForm(EMPTY_ANNOUNCEMENT_FORM)).toBe('Укажите название анонса');
    expect(
      validateAnnouncementForm({ ...EMPTY_ANNOUNCEMENT_FORM, title: '   ' }),
    ).toBe('Укажите название анонса');
    expect(
      validateAnnouncementForm({ ...EMPTY_ANNOUNCEMENT_FORM, title: 'Анонс' }),
    ).toBe('Выберите класс');
  });

  it('остальные поля необязательны', () => {
    expect(
      validateAnnouncementForm({
        ...EMPTY_ANNOUNCEMENT_FORM,
        title: 'Анонс',
        grade: '7 класс',
      }),
    ).toBeNull();
  });
});

describe('toAnnouncementRequest', () => {
  it('обрезает пробелы у обязательных полей и не назначает дату, если её не ввели', () => {
    const body = toAnnouncementRequest({
      ...EMPTY_ANNOUNCEMENT_FORM,
      title: '  Тестирование  ',
      grade: ' 7 класс ',
    });

    expect(body.title).toBe('Тестирование');
    expect(body.grade).toBe('7 класс');
    expect(body.eventAt).toBeUndefined();
  });

  it('переносит заполненные поля как есть', () => {
    const body = toAnnouncementRequest({
      title: 'Тестирование',
      grade: '7 класс',
      summary: 'Кратко',
      eventAt: '2026-09-12T10:00',
      location: 'Корпус А',
      preparation: 'Дроби',
      formatInfo: '60 минут',
      bringWithYou: 'Ручка',
      recommendations: 'Выспаться',
    });

    expect(body).toEqual({
      title: 'Тестирование',
      grade: '7 класс',
      summary: 'Кратко',
      eventAt: '2026-09-12T10:00',
      location: 'Корпус А',
      preparation: 'Дроби',
      formatInfo: '60 минут',
      bringWithYou: 'Ручка',
      recommendations: 'Выспаться',
    });
  });
});
