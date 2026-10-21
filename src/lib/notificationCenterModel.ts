import { ROUTES } from '@/lib/routes';
import { scheduleHref } from '@/lib/scheduleNavigation';
import type { CenterItem } from '@/lib/notificationCenterApi';

/**
 * Куда ведёт строка ленты и что лежит в карточке «Незавершённые действия».
 *
 * Маршрут — словарь контракта уведомлений (`route` + `params`), общий с пушем и мобилкой, а не `kind`: новый вид
 * уведомления со знакомым маршрутом новой версии экрана не требует. Здесь словарь переводится в адреса панели.
 * Незнакомый маршрут или неполные параметры — строка без перехода, а не переход «куда-нибудь».
 */

type Params = Record<string, unknown>;

/** Карточка «Незавершённые действия»: она разворачивается списком, а не уводит со страницы. */
export const PENDING_ACTIONS_KIND = 'TEACHER_PENDING_ACTIONS';

function id(params: Params, key: string): number | null {
  const value = params[key];
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * @param role роль читающего: «расписание» учителю — его неделя, администрации — конструктор на нужном периоде
 */
export function centerLink(route: string | undefined, params: Params | undefined, role?: string): string | null {
  const p = params ?? {};
  switch (route) {
    case 'lesson': {
      const lessonId = id(p, 'lessonId');
      return lessonId ? `/lesson-schedule/lessons/${lessonId}` : null;
    }
    case 'attendance': {
      const lessonId = id(p, 'lessonId');
      return lessonId ? `/lesson-schedule/lessons/${lessonId}/attendance` : null;
    }
    case 'lesson-grades': {
      const lessonId = id(p, 'lessonId');
      return lessonId ? `/lesson-schedule/lessons/${lessonId}/grades` : null;
    }
    case 'homework-card': {
      const homeworkId = id(p, 'homeworkId');
      return homeworkId ? `/homework/${homeworkId}` : null;
    }
    case 'feedback': {
      const query = new URLSearchParams();
      if (typeof p.month === 'string') query.set('month', p.month);
      const subjectId = id(p, 'subjectId');
      const classId = id(p, 'classId');
      if (subjectId) query.set('subject', String(subjectId));
      if (classId) query.set('class', String(classId));
      const search = query.toString();
      return search ? `${ROUTES.feedback}?${search}` : ROUTES.feedback;
    }
    case 'schedule': {
      if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return ROUTES.mySchedule;
      const periodId = id(p, 'periodId');
      return scheduleHref({ year: null, periodId: periodId ? String(periodId) : null, classId: null, scheduleId: null });
    }
    case 'survey-results': {
      const surveyId = id(p, 'surveyId');
      return surveyId ? `/surveys/${surveyId}?tab=results` : null;
    }
    case 'homework':
      return '/homework';
    case 'grades':
      return ROUTES.journal;
    default:
      return null;
  }
}

/**
 * Тип строки для значка (ТЗ Admin §6: Warning и Info). Вид — только для картинки: куда вести, решает маршрут.
 * У остальных видов типа нет — значок им не нужен.
 */
export type CenterTone = 'warning' | 'info';

const TONES: Record<string, CenterTone> = {
  ADMIN_SCHEDULE_UNPUBLISHED: 'warning',
  ADMIN_SURVEY_CLOSED: 'info',
};

export function centerTone(kind: string | undefined): CenterTone | null {
  return (kind && TONES[kind]) || null;
}

/** Роли панели, у которых есть лента: учитель (ТЗ Teacher) и администрация (ТЗ Admin). */
export function hasNotificationCenter(role: string | undefined): boolean {
  return role === 'TEACHER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export interface PendingAction {
  type: string;
  label: string;
  href: string | null;
}

/** Действия карточки «Незавершённые действия» с адресами панели; битые строки пропускаются. */
export function pendingActions(item: CenterItem): PendingAction[] {
  const raw = (item.params as Params | undefined)?.actions;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const action = entry as Params;
    if (typeof action.label !== 'string') return [];
    return [{
      type: typeof action.type === 'string' ? action.type : '',
      label: action.label,
      href: centerLink(typeof action.route === 'string' ? action.route : undefined, action.params as Params),
    }];
  });
}

/** Сколько действий в карточке всего — перечислены не все. */
export function pendingTotal(item: CenterItem): number {
  const raw = (item.params as Params | undefined)?.groups;
  if (!Array.isArray(raw)) return 0;
  return raw.reduce((sum: number, group) => {
    const count = (group as Params | null)?.count;
    return sum + (typeof count === 'number' ? count : 0);
  }, 0);
}
