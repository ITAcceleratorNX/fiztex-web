import { describe, expect, it } from 'vitest';
import type { LessonHistoryEntry } from '@/lib/lessonsApi';
import { describeHistoryActor, describeHistoryEntry } from './lessonHistory';

function entry(actionType: LessonHistoryEntry['actionType'], payload: unknown = {}, extra: Partial<LessonHistoryEntry> = {}): LessonHistoryEntry {
  return { actionType, payload: JSON.stringify(payload), ...extra };
}

describe('понятная история урока', () => {
  it.each([
    ['SCHEDULE_SLOT_REMOVED', 'Урок отменён автоматически: занятие убрано из расписания'],
    ['CALENDAR_NO_LESSONS', 'Урок отменён автоматически: по календарю занятий нет'],
    ['MANUAL', 'Урок отменён администратором'],
  ] as const)('переводит %s без дублирования кода в старых записях', (reason, expected) => {
    expect(describeHistoryEntry(entry('CANCELLED', { reason }, { reason }))).toBe(expected);
    expect(describeHistoryEntry(entry('CANCELLED', { reason }))).toBe(expected);
  });

  it('показывает отдельный комментарий администратора и сохраняет старые текстовые причины', () => {
    expect(describeHistoryEntry(entry('CANCELLED', { reason: 'MANUAL', comment: 'Учитель заболел' }, { reason: 'MANUAL' })))
      .toBe('Урок отменён администратором — Учитель заболел');
    expect(describeHistoryEntry(entry('CANCELLED', { reason: 'Учитель заболел' }, { reason: 'MANUAL' })))
      .toBe('Урок отменён администратором — Учитель заболел');
  });

  it('не выдаёт неизвестные причины или действия за текст пользователя', () => {
    expect(describeHistoryEntry(entry('CANCELLED', { reason: 'SOME_NEW_REASON' }))).toBe('Урок отменён');
    expect(describeHistoryEntry({ actionType: 'FUTURE_ACTION', reason: 'FUTURE_REASON', payload: '{"reason":"FUTURE_REASON"}' } as unknown as LessonHistoryEntry))
      .toBe('Изменение урока');
  });

  it('не показывает идентификаторы вместо отсутствующих названий предметов', () => {
    expect(describeHistoryEntry(entry('ADMIN_UPDATED', { before: { subjectId: 1 }, after: { subjectId: 2 } })))
      .toBe('Изменено — предмет');
    expect(describeHistoryEntry(entry('ADMIN_UPDATED', { before: { subjectId: 1, subjectName: 'Физика' }, after: { subjectId: 2, subjectName: 'Математика' } })))
      .toBe('Изменено — предмет: Математика (было Физика)');
  });

  const actions = {
    CREATED: 'Урок добавлен в расписание',
    SUPERSEDED: 'Урок заменён новой версией расписания',
    CANCELLED: 'Урок отменён',
    RESTORED: 'Урок восстановлен',
    ADMIN_UPDATED: 'Урок изменён администратором',
    SUBSTITUTE_ASSIGNED: 'Назначена замена учителя',
    SUBSTITUTE_REVOKED: 'Замена снята',
    GRADE_PERMISSION_GRANTED: 'Замещающему учителю разрешено выставлять и изменять оценки',
    GRADE_PERMISSION_REVOKED: 'У замещающего учителя отозвано право выставлять и изменять оценки',
    COMMENT_CREATED: 'Добавлен комментарий для учеников',
    COMMENT_UPDATED: 'Изменён комментарий для учеников',
    COMMENT_DELETED: 'Удалён комментарий для учеников',
    TOPIC_UPDATED: 'Тема урока очищена',
    PREPARATION_APPLIED: 'Применена заготовка урока',
    PREPARATION_COPIED: 'Подготовка перенесена с другого урока',
    HOMEWORK_CREATED: 'Выдано домашнее задание урока',
    HOMEWORK_UPDATED: 'Изменено домашнее задание урока',
    HOMEWORK_DELETED: 'Снято домашнее задание урока',
    HOMEWORK_ASSIGNMENT_DRAFTED: 'Создан черновик ДЗ',
    HOMEWORK_ASSIGNMENT_PUBLISHED: 'ДЗ опубликовано',
    HOMEWORK_ASSIGNMENT_UPDATED: 'ДЗ изменено',
    HOMEWORK_MARKED_NOT_ASSIGNED: 'Отмечено «ДЗ не задано»',
    HOMEWORK_NOT_ASSIGNED_CLEARED: 'Отметка «ДЗ не задано» снята',
    TEXTBOOK_SELECTED: 'Выбран учебник',
    TEXTBOOK_CLEARED: 'Снят выбор учебника',
    MATERIAL_ADDED: 'К уроку добавлен материал',
    MATERIAL_UPDATED: 'Материал урока изменён',
    MATERIAL_REMOVED: 'Материал убран из урока',
  } satisfies Record<NonNullable<LessonHistoryEntry['actionType']>, string>;

  it.each(Object.entries(actions))('описывает действие %s без служебного кода', (action, expected) => {
    expect(describeHistoryEntry(entry(action as LessonHistoryEntry['actionType']))).toBe(expected);
  });

  it('объясняет видимость материалов и сохраняет названия файлов', () => {
    expect(describeHistoryEntry(entry('MATERIAL_ADDED', { kind: 'FILE', fileName: 'Задачи.pdf' }))).toBe('К уроку добавлен материал: Задачи.pdf');
    expect(describeHistoryEntry(entry('MATERIAL_UPDATED', { kind: 'WORKSPACE_MATERIAL', visibleToStudents: true }))).toBe('Материал доступен ученикам');
    expect(describeHistoryEntry(entry('MATERIAL_UPDATED', { visibleToStudents: false, fileName: 'Ответы.pdf' }))).toBe('Материал скрыт от учеников: Ответы.pdf');
  });

  it('объясняет автоматическое снятие отметки о домашнем задании', () => {
    expect(describeHistoryEntry(entry('HOMEWORK_NOT_ASSIGNED_CLEARED', { reason: 'HOMEWORK_PUBLISHED' })))
      .toBe('Отметка «ДЗ не задано» снята: по уроку опубликовано задание');
  });

  it.each(['{broken', 'null', '[]', '42', '{"reason":{},"comment":[],"title":5,"sourceLessonDate":"2026-99-99","sourceClassName":{}}'])('безопасно читает старый или некорректный снимок %s', payload => {
    for (const actionType of Object.keys(actions)) {
      expect(() => describeHistoryEntry({ actionType: actionType as LessonHistoryEntry['actionType'], payload })).not.toThrow();
    }
  });

  it('переводит роли автора и безопасно обрабатывает неизвестные значения', () => {
    expect(describeHistoryActor({ actorType: 'SYSTEM' })).toBe('Система');
    expect(describeHistoryActor({ actorType: 'ADMIN', actorName: 'Сергей' })).toBe('Администратор (Сергей)');
    expect(describeHistoryActor({ actorType: 'TEACHER' })).toBe('Учитель');
    expect(describeHistoryActor({ actorType: 'FUTURE_ROLE' } as unknown as LessonHistoryEntry)).toBe('Пользователь');
  });
});
