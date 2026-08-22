import { describe, expect, it } from 'vitest';
import { navSectionsForRole } from '@/components/layout/navConfig';
import {
  isRouteAllowedForRole,
  landingRouteForRole,
  loginRedirectTarget,
  safeRedirectTarget,
} from './routes';

describe('маршрутизация по роли', () => {
  it('учителя встречает его раздел, админа — дашборд', () => {
    expect(landingRouteForRole('TEACHER')).toBe('/homework');
    expect(landingRouteForRole('ADMIN')).toBe('/dashboard');
    expect(landingRouteForRole(undefined)).toBe('/dashboard');
  });

  it('учителю доступен только раздел ДЗ', () => {
    expect(isRouteAllowedForRole('/homework', 'TEACHER')).toBe(true);
    expect(isRouteAllowedForRole('/homework/12', 'TEACHER')).toBe(true);
    expect(isRouteAllowedForRole('/dashboard', 'TEACHER')).toBe(false);
    expect(isRouteAllowedForRole('/admin/classes', 'TEACHER')).toBe(false);
    // Конкретный урок — ролевой экран: карточка, посещаемость и ДЗ урока учителю нужны,
    // а вот конструктор расписания и его настройки остаются админскими.
    expect(isRouteAllowedForRole('/lesson-schedule/lessons/12', 'TEACHER')).toBe(true);
    expect(isRouteAllowedForRole('/lesson-schedule/lessons/12/homework', 'TEACHER')).toBe(true);
    expect(isRouteAllowedForRole('/lesson-schedule/lessons/12/attendance', 'TEACHER')).toBe(true);
    expect(isRouteAllowedForRole('/lesson-schedule', 'TEACHER')).toBe(false);
    expect(isRouteAllowedForRole('/lesson-schedule/bell-templates', 'TEACHER')).toBe(false);
    // Админа не ограничиваем: у него работают все разделы.
    expect(isRouteAllowedForRole('/dashboard', 'ADMIN')).toBe(true);
  });

  /**
   * Регрессия на петлю входа: страница, выбросившая учителя по 401, оседала в
   * `state.from`, и следующий вход возвращал ровно туда же — выйти было нельзя.
   */
  it('не возвращает учителя на страницу, которая его выбросила', () => {
    expect(loginRedirectTarget('/dashboard', 'TEACHER')).toBe('/homework');
    expect(loginRedirectTarget('/admin/classes', 'TEACHER')).toBe('/homework');
    // Свой раздел — уважаем: человек шёл именно туда.
    expect(loginRedirectTarget('/homework', 'TEACHER')).toBe('/homework');
    // Урок учителю доступен, значит и возврат на него после входа обязан работать.
    expect(loginRedirectTarget('/lesson-schedule/lessons/12', 'TEACHER'))
      .toBe('/lesson-schedule/lessons/12');
    // Админа `from` по-прежнему возвращает куда шёл.
    expect(loginRedirectTarget('/admin/classes', 'ADMIN')).toBe('/admin/classes');
    expect(loginRedirectTarget(undefined, 'ADMIN')).toBe('/dashboard');
  });

  it('внешний адрес в from не превращает вход в открытый редирект', () => {
    expect(safeRedirectTarget('//evil.example')).toBe('/dashboard');
    expect(loginRedirectTarget('//evil.example', 'ADMIN')).toBe('/dashboard');
    expect(loginRedirectTarget('//evil.example', 'TEACHER')).toBe('/homework');
  });

  it('в меню учителя только его разделы, у админа их нет', () => {
    // Своё расписание и ДЗ — единственные экраны, которые работают под учителем:
    // остальные читают `/api/admin/*` и рвут ему сессию.
    const teacher = navSectionsForRole('TEACHER').flatMap((s) => s.items.map((i) => i.to));
    expect(teacher).toEqual(['/my-schedule', '/homework']);

    const admin = navSectionsForRole('ADMIN').flatMap((s) => s.items.map((i) => i.to));
    expect(admin).not.toContain('/homework');
    expect(admin).not.toContain('/my-schedule');
    expect(admin).toContain('/dashboard');
  });

  it('учителю открыто своё расписание, но не админский конструктор', () => {
    expect(isRouteAllowedForRole('/my-schedule', 'TEACHER')).toBe(true);
    expect(isRouteAllowedForRole('/lesson-schedule', 'TEACHER')).toBe(false);
    expect(isRouteAllowedForRole('/lesson-schedule/lessons/7', 'TEACHER')).toBe(true);
  });
});
