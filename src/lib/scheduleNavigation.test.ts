import { describe, expect, it } from 'vitest';
import { hasInvalidScheduleContext, readScheduleContext, scheduleHref, scheduleReturnTo, scheduleSettingsHref } from './scheduleNavigation';

const CONTEXT = { year: '2', periodId: '12', classId: '4', scheduleId: '42' };
const SOURCE = '/lesson-schedule?year=2&periodId=12&classId=4&scheduleId=42';

describe('schedule navigation links', () => {
  it.each(['bell-templates', 'calendar', 'teachers', 'subgroups', 'import'])('сохраняет исходный контекст через %s', (section) => {
    const target = new URL(scheduleSettingsHref(`/lesson-schedule/${section}`, CONTEXT), 'https://fiztex.test');
    expect(readScheduleContext(target.searchParams)).toEqual(CONTEXT);
    expect(scheduleReturnTo(target.searchParams)).toBe(SOURCE);
    // Changing the settings' own year/class must not replace the origin.
    target.searchParams.set('year', '3');
    target.searchParams.set('classId', '99');
    expect(scheduleReturnTo(target.searchParams)).toBe(SOURCE);
  });

  it.each(['https://evil.test/lesson-schedule', '//evil.test/lesson-schedule', '/\\evil.test/lesson-schedule', '/admin/users', 'javascript:alert(1)'])('не допускает возврат на %s', (returnTo) => {
    expect(scheduleReturnTo(new URLSearchParams({ returnTo, year: '2' }))).toBe('/lesson-schedule?year=2');
  });

  it('очищает неизвестные параметры, hash и вложенный returnTo', () => {
    const params = new URLSearchParams({ returnTo: `${SOURCE}&editing=true&returnTo=https://evil.test#private` });
    expect(scheduleReturnTo(params)).toBe(SOURCE);
  });

  it('различает невыбранный фильтр и значение по умолчанию', () => {
    const context = readScheduleContext(new URLSearchParams('year=2&periodId=&classId='));
    expect(context).toEqual({ year: '2', periodId: '', classId: '', scheduleId: null });
    expect(scheduleHref(context)).toBe('/lesson-schedule?year=2&periodId=&classId=');
  });

  it.each(['-1', '1.5', 'Infinity', '1e2', '9007199254740992', 'bad'])('отбрасывает некорректный ID %s', (classId) => {
    const params = new URLSearchParams({ year: '2', classId });
    expect(hasInvalidScheduleContext(params)).toBe(true);
    expect(readScheduleContext(params).classId).toBeNull();
  });
});
