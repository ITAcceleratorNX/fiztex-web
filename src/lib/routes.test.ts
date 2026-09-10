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
   * Раздел сотрудников ТЗ SERVICE-FE-004 §3 адресует одному Super Admin. Бэкенд его,
   * наоборот, открывает и обычному администратору, поэтому граница здесь продуктовая:
   * без неё пункт меню обещал бы Admin раздел, который ему не предназначен.
   */
  it('сотрудники — только Super Admin', () => {
    expect(isRouteAllowedForRole('/admin/employees', 'SUPER_ADMIN')).toBe(true);
    expect(isRouteAllowedForRole('/admin/employees', 'ADMIN')).toBe(false);
    expect(isRouteAllowedForRole('/admin/employees', 'TEACHER')).toBe(false);
    // Роль неизвестна (профиль из старой сессии) — тоже нет: показать раздел «на всякий
    // случай» хуже, чем попросить войти заново.
    expect(isRouteAllowedForRole('/admin/employees', undefined)).toBe(false);
    // Соседние админские разделы правилом не задеты.
    expect(isRouteAllowedForRole('/admin/users', 'ADMIN')).toBe(true);
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
    // Своё расписание, журнал, ДЗ и сервисные заявки — экраны, которые работают под
    // учителем: остальные читают `/api/admin/*` и рвут ему сессию. Заявки попадают сюда
    // не как учебный раздел, а потому что автор у них тот же (SERVICE-FE-001 §1), и
    // читают они `/api/service-requests/my`.
    const teacher = navSectionsForRole('TEACHER').flatMap((s) => s.items.map((i) => i.to));
    expect(teacher).toEqual([
      // «Текущий урок» стоит первым — это кнопка к работе, а не раздел (ТЗ Быстрый
      // доступ §1), и её позиция в списке такая же часть решения, как её наличие.
      '/current-lesson',
      '/my-schedule',
      '/my-availability',
      '/grades',
      '/homework',
      '/service',
    ]);

    const admin = navSectionsForRole('ADMIN').flatMap((s) => s.items.map((i) => i.to));
    expect(admin).not.toContain('/homework');
    expect(admin).not.toContain('/my-schedule');
    expect(admin).toContain('/dashboard');
  });

  it('«Сотрудники» появляются в «Пользователях» только у Super Admin', () => {
    const childrenFor = (role: string) =>
      navSectionsForRole(role)
        .flatMap((section) => section.items)
        .flatMap((item) => item.children ?? [])
        .map((child) => child.to);

    expect(childrenFor('SUPER_ADMIN')).toContain('/admin/employees');
    expect(childrenFor('ADMIN')).not.toContain('/admin/employees');
    // Общий список не мутируем: он один на всё приложение, и подмешанный пункт остался
    // бы в нём после первого же захода Super Admin.
    expect(childrenFor('ADMIN')).toEqual(['/students', '/parents', '/teachers']);
  });

  it('учителю открыто своё расписание, но не админский конструктор', () => {
    expect(isRouteAllowedForRole('/my-schedule', 'TEACHER')).toBe(true);
    // Пункт «Текущий урок» бесполезен, если прямой заход на него разворачивает роль:
    // он и есть прямой заход — по нему приходят из меню и из закладки.
    expect(isRouteAllowedForRole('/current-lesson', 'TEACHER')).toBe(true);
    expect(isRouteAllowedForRole('/lesson-schedule', 'TEACHER')).toBe(false);
    expect(isRouteAllowedForRole('/lesson-schedule/lessons/7', 'TEACHER')).toBe(true);
  });

  /**
   * Пункт меню, ведущий на разворот, хуже отсутствующего: заявки стояли в меню
   * учителя, но `Protected` возвращал его с `/service` на `/homework`. Своё рабочее
   * время — из той же породы ролевых экранов и попадает сюда сразу.
   */
  it('ролевые экраны учителя открываются, а не разворачиваются на главную', () => {
    expect(isRouteAllowedForRole('/my-availability', 'TEACHER')).toBe(true);
    expect(isRouteAllowedForRole('/service', 'TEACHER')).toBe(true);
    expect(isRouteAllowedForRole('/service/12', 'TEACHER')).toBe(true);
    expect(loginRedirectTarget('/my-availability', 'TEACHER')).toBe('/my-availability');
    // Занятость учителей в конструкторе — по-прежнему админский экран.
    expect(isRouteAllowedForRole('/lesson-schedule/teachers', 'TEACHER')).toBe(false);
  });
});
