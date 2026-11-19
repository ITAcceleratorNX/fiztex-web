import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  attendanceCaption,
  attendanceHref,
  backTarget,
  problemFromParam,
  workCaption,
  workHref,
  workTitle,
} from './fillControlModel';

describe('fillControlModel', () => {
  it('посещаемость: «Не отмечена» без отметок и «Не отмечено: N из M» при частичном заполнении', () => {
    expect(attendanceCaption({ status: 'NOT_FILLED', expected: 10, filled: 0, missing: 10 })).toEqual({
      text: 'Не отмечена',
      tone: 'danger',
    });
    expect(attendanceCaption({ status: 'PARTIAL', expected: 10, filled: 7, missing: 3 })).toEqual({
      text: 'Не отмечено: 3 из 10',
      tone: 'warning',
    });
  });

  it('работа: «н/в» засчитан заполненным, поэтому «Результаты не внесены» — только когда нет ни баллов, ни статусов', () => {
    expect(workCaption({ status: 'NOT_FILLED', expected: 10, scored: 0, notTaken: 0, missing: 10 }).text).toBe(
      'Результаты не внесены',
    );
    expect(workCaption({ status: 'PARTIAL', expected: 10, scored: 0, notTaken: 2, missing: 8 }).text).toBe(
      'Не заполнено: 8 из 10',
    );
  });

  it('названия работ: у СОР номер, у СОЧ без номера', () => {
    expect(workTitle({ kind: 'SOR', number: 1 })).toBe('СОР 1');
    expect(workTitle({ kind: 'SOCH', number: undefined })).toBe('СОЧ');
  });

  it('глагол ссылки зависит от права сервера: без canEdit — только «Открыть»', () => {
    expect(actionLabel('ATTENDANCE', true)).toBe('Отметить');
    expect(actionLabel('ASSESSMENT', true)).toBe('Внести баллы');
    expect(actionLabel('ATTENDANCE', false)).toBe('Открыть');
    expect(actionLabel('ASSESSMENT', undefined)).toBe('Открыть');
  });

  it('адреса: посещаемость урока и журнал класса, суженный до предмета и четверти', () => {
    expect(attendanceHref(52)).toBe('/lesson-schedule/lessons/52/attendance');
    expect(workHref({ classId: 3, subjectId: 4, subgroupId: 5, academicPeriodId: 6 })).toBe(
      '/grades?classId=3&subjectId=4&subgroupId=5&periodId=6',
    );
    expect(workHref({ classId: 3, subjectId: 4 })).toBe('/grades?classId=3&subjectId=4');
  });

  it('«назад» читается только из корректного состояния перехода', () => {
    expect(backTarget({ fillControlBack: { to: '/attendance?tab=unfilled&fcPage=2', label: '← К незаполненным' } })).toEqual({
      to: '/attendance?tab=unfilled&fcPage=2',
      label: '← К незаполненным',
    });
    expect(backTarget(null)).toBeNull();
    expect(backTarget({ fillControlBack: { to: 5 } })).toBeNull();
  });

  it('фильтр типа: незнакомое значение — «Всё»', () => {
    expect(problemFromParam('ATTENDANCE')).toBe('ATTENDANCE');
    expect(problemFromParam('ASSESSMENT')).toBe('ASSESSMENT');
    expect(problemFromParam('junk')).toBe('ALL');
    expect(problemFromParam(null)).toBe('ALL');
  });
});
