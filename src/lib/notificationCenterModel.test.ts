import { describe, expect, it } from 'vitest';
import { centerLink, pendingActions, pendingTotal } from './notificationCenterModel';
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
