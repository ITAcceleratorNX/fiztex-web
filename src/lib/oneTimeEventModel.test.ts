import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import {
  emptyForm,
  mapOneTimeEventError,
  mondayOf,
  overlapsOf,
  toRequest,
  validateForm,
  weekDates,
  weekLabel,
} from './oneTimeEventModel';
import type { OneTimeEventOnSchedule } from './oneTimeEventsApi';

describe('validateForm', () => {
  it('требует окончание позже начала', () => {
    const form = { ...emptyForm('2026-10-12'), title: 'Линейка', startTime: '10:00', endTime: '10:00' };
    expect(validateForm(form).endTime).toBe('Окончание должно быть позже начала');
    expect(validateForm({ ...form, endTime: '10:30' })).toEqual({});
  });

  it('проверяет поля своей аудитории', () => {
    const base = { ...emptyForm('2026-10-12'), title: 'Х', startTime: '10:00', endTime: '11:00' };
    expect(validateForm({ ...base, audience: 'GRADE' }).audience).toBe('Выберите параллель');
    expect(validateForm({ ...base, audience: 'CLASSES' }).audience).toBe('Выберите хотя бы один класс');
    expect(validateForm({ ...base, audience: 'SCHOOL' })).toEqual({});
  });
});

describe('toRequest', () => {
  it('отправляет только поля выбранной аудитории', () => {
    const form = {
      ...emptyForm('2026-10-12'),
      title: '  Собрание ',
      startTime: '08:00',
      endTime: '09:15',
      audience: 'GRADE' as const,
      grade: '7',
      classIds: ['3'],
      comment: '   ',
    };
    expect(toRequest(form)).toEqual({
      title: 'Собрание',
      date: '2026-10-12',
      startTime: '08:00',
      endTime: '09:15',
      audience: 'GRADE',
      grade: '7',
      classIds: undefined,
      comment: undefined,
    });
  });
});

describe('mapOneTimeEventError', () => {
  it('раскладывает Bean Validation по полям', () => {
    const error = new ApiError(400, 'Проверьте заполнение формы', undefined, [
      { field: 'timeRangeValid', message: 'Время окончания должно быть позже времени начала' },
    ]);
    expect(mapOneTimeEventError(error)).toEqual({
      fields: { endTime: 'Время окончания должно быть позже времени начала' },
    });
  });

  it('узнаёт фразы сервиса и оставляет прочее форме', () => {
    expect(mapOneTimeEventError(new ApiError(400, 'Выберите хотя бы один класс')).fields.audience)
      .toBe('Выберите хотя бы один класс');
    expect(mapOneTimeEventError(new ApiError(409, 'Отменённое событие изменить нельзя')))
      .toEqual({ fields: {}, form: 'Отменённое событие изменить нельзя' });
  });
});

describe('неделя', () => {
  it('находит понедельник и даты дней', () => {
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(weekDates('2026-09-28').SUNDAY).toBe('2026-10-04');
    expect(weekLabel('2026-09-28')).toContain('–');
  });
});

describe('overlapsOf', () => {
  const event: OneTimeEventOnSchedule = {
    id: 1,
    title: 'Классный час',
    date: '2026-10-12',
    startTime: '08:00:00',
    endTime: '09:15:00',
    overlaps: [
      { lessonId: 10, coverage: 'FULL', overlapStart: '08:00:00', overlapEnd: '08:45:00' },
      { lessonId: 11, coverage: 'PARTIAL', overlapStart: '09:00:00', overlapEnd: '09:15:00' },
    ],
  };

  it('берёт перекрытие слота только в дату события', () => {
    expect(overlapsOf([event], 11, '2026-10-12')).toEqual([
      { event, coverage: 'PARTIAL', overlapStart: '09:00', overlapEnd: '09:15' },
    ]);
    expect(overlapsOf([event], 11, '2026-10-19')).toEqual([]);
    expect(overlapsOf([event], 12, '2026-10-12')).toEqual([]);
  });
});
