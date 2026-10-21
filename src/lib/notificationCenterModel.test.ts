import { describe, expect, it } from 'vitest';
import {
  centerLink, centerTone, hasNotificationCenter, pendingActions, pendingTotal,
} from './notificationCenterModel';
import type { CenterItem } from './notificationCenterApi';

describe('centerLink — словарь маршрутов уведомлений в адреса панели', () => {
  it('урок, посещаемость и оценки урока', () => {
    expect(centerLink('lesson', { lessonId: 77 })).toBe('/lesson-schedule/lessons/77');
    expect(centerLink('attendance', { lessonId: 77 })).toBe('/lesson-schedule/lessons/77/attendance');
    expect(centerLink('lesson-grades', { lessonId: 77, correctionId: 12 })).toBe('/lesson-schedule/lessons/77/grades');
  });

  it('задание и лист отзывов месяца', () => {
    expect(centerLink('homework-card', { homeworkId: 812 })).toBe('/homework/812');
    expect(centerLink('feedback', { month: '2026-09', classId: 31, subjectId: 7 }))
      .toBe('/feedback?month=2026-09&subject=7&class=31');
  });

  it('расписание: учителю — его неделя, администрации — конструктор на нужном периоде', () => {
    expect(centerLink('schedule', {}, 'TEACHER')).toBe('/my-schedule');
    expect(centerLink('schedule', { periodId: 31 }, 'ADMIN')).toBe('/lesson-schedule?periodId=31');
    expect(centerLink('schedule', {}, 'SUPER_ADMIN')).toBe('/lesson-schedule');
  });

  it('результаты опроса — вкладка «Результаты» его карточки', () => {
    expect(centerLink('survey-results', { surveyId: 44 }, 'ADMIN')).toBe('/surveys/44?tab=results');
  });

  it('незнакомый маршрут и неполные параметры — без перехода, а не «куда-нибудь»', () => {
    expect(centerLink('survey-take', { surveyId: 1 })).toBeNull();
    expect(centerLink('lesson', {})).toBeNull();
    expect(centerLink('homework-card', { homeworkId: 'abc' })).toBeNull();
    expect(centerLink(undefined, undefined)).toBeNull();
  });
});

describe('pendingActions — карточка «Незавершённые действия»', () => {
  const card = {
    kind: 'TEACHER_PENDING_ACTIONS',
    params: {
      groups: [{ type: 'ATTENDANCE', count: 5 }, { type: 'TEST_REVIEW', count: 1 }],
      actions: [
        { type: 'ATTENDANCE', label: 'Посещаемость: Физика, 7А · 14.10', route: 'attendance', params: { lessonId: 77 } },
        { type: 'TEST_REVIEW', label: 'Тест «Квадратные уравнения»', route: 'homework-card', params: { homeworkId: 812 } },
        { type: 'BROKEN', route: 'attendance' },
      ],
    },
  } as unknown as CenterItem;

  it('действия ведут к своему объекту, строки без подписи пропускаются', () => {
    expect(pendingActions(card)).toEqual([
      { type: 'ATTENDANCE', label: 'Посещаемость: Физика, 7А · 14.10', href: '/lesson-schedule/lessons/77/attendance' },
      { type: 'TEST_REVIEW', label: 'Тест «Квадратные уравнения»', href: '/homework/812' },
    ]);
  });

  it('всего действий — по группам, а не по перечисленным', () => {
    expect(pendingTotal(card)).toBe(6);
    expect(pendingTotal({ params: {} } as CenterItem)).toBe(0);
  });
});

describe('тип строки и роли с лентой', () => {
  it('Warning — расписание, Info — опрос, у остальных видов значка нет', () => {
    expect(centerTone('ADMIN_SCHEDULE_UNPUBLISHED')).toBe('warning');
    expect(centerTone('ADMIN_SURVEY_CLOSED')).toBe('info');
    expect(centerTone('TEACHER_LESSON_SOON')).toBeNull();
  });

  it('лента у учителя и администрации', () => {
    expect(['TEACHER', 'ADMIN', 'SUPER_ADMIN'].every(hasNotificationCenter)).toBe(true);
    expect(hasNotificationCenter('PSYCHOLOGIST')).toBe(false);
    expect(hasNotificationCenter(undefined)).toBe(false);
  });
});
