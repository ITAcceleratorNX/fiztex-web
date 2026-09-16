import { describe, expect, it } from 'vitest';
import type { FeedbackSheet, FeedbackSheetRow, FeedbackStudentRow } from '@/lib/monthlyFeedbackApi';
import { formatDayMonthYear } from './format';
import {
  applySavedEntry,
  classOptions,
  closeHint,
  completionChanged,
  monthKey,
  monthLabel,
  monthOptions,
  nextStudentToFill,
  sheetClassLabel,
  splitColumns,
  studentName,
  studentStatus,
  subjectOptions,
} from './monthlyFeedbackModel';

function student(id: number, overrides: Partial<FeedbackStudentRow> = {}): FeedbackStudentRow {
  return { studentProfileId: id, lastName: `Фамилия${id}`, firstName: 'Имя', inRoster: true, filled: false, ...overrides };
}

const SHEETS: FeedbackSheetRow[] = [
  { classId: 12, className: '7 «А»', subjectId: 3, subjectName: 'Физика', scope: 'CLASS', status: 'DRAFT' },
  { classId: 9, className: '10 «Б»', subjectId: 3, subjectName: 'Физика', scope: 'CLASS', status: 'PUBLISHED' },
  {
    classId: 12,
    className: '7 «А»',
    subjectId: 5,
    subjectName: 'Английский язык',
    scope: 'SUBGROUPS',
    subgroupNames: ['A'],
    status: 'NOT_STARTED',
  },
];

describe('месяцы', () => {
  it('ключ и подпись месяца', () => {
    expect(monthKey(new Date(2026, 8, 30))).toBe('2026-09');
    expect(monthLabel('2026-09')).toBe('Сентябрь 2026');
    expect(monthLabel('2026-05')).toBe('Май 2026');
    expect(monthLabel('чушь')).toBe('чушь');
  });

  it('объединяет активный год, историю и текущий месяц без повторов, от нового к старому', () => {
    expect(
      monthOptions(
        [{ month: '2026-09' }, { month: '2026-10' }],
        ['2026-05', '2026-09'],
        '2026-10',
      ),
    ).toEqual(['2026-10', '2026-09', '2026-05']);
  });

  it('текущий месяц есть даже без листов и истории', () => {
    expect(monthOptions(undefined, undefined, '2026-09')).toEqual(['2026-09']);
  });

  it('дата публикации полностью', () => {
    expect(formatDayMonthYear('2026-09-13T10:00:00')).toBe('13 сентября 2026');
    expect(formatDayMonthYear(null)).toBe('—');
  });
});

describe('фильтры', () => {
  it('предметы месяца без повторов, по алфавиту', () => {
    expect(subjectOptions(SHEETS)).toEqual([
      { value: '5', label: 'Английский язык' },
      { value: '3', label: 'Физика' },
    ]);
  });

  it('классы только выбранного предмета, номер класса — числом', () => {
    expect(classOptions(SHEETS, 3)).toEqual([
      { value: '12', label: '7 «А»' },
      { value: '9', label: '10 «Б»' },
    ]);
    expect(classOptions(SHEETS, null)).toEqual([]);
  });

  it('у листа подгрупп в подписи класса — его подгруппы', () => {
    expect(sheetClassLabel(SHEETS[2])).toBe('7 «А» · A');
    expect(sheetClassLabel(SHEETS[0])).toBe('7 «А»');
  });

  it('подсказка закрытия периода считает опубликованные листы', () => {
    expect(closeHint(SHEETS)).toBe('Опубликовано 1 из 3');
  });
});

describe('строки учеников', () => {
  it('статус: заполнено, не заполнено, выбыл', () => {
    expect(studentStatus(student(1, { filled: true }))).toBe('filled');
    expect(studentStatus(student(2))).toBe('missing');
    expect(studentStatus(student(3, { inRoster: false, filled: false }))).toBe('left');
  });

  it('ФИО без пустого отчества', () => {
    expect(studentName({ lastName: 'Абенов', firstName: 'Арман', middleName: undefined })).toBe('Абенов Арман');
  });

  it('следующий — первый незаполненный после текущего, по кругу, без ушедших', () => {
    const list = [
      student(1),
      student(2, { filled: true }),
      student(3, { inRoster: false }),
      student(4),
      student(5, { filled: true }),
    ];
    expect(nextStudentToFill(list, 1)?.studentProfileId).toBe(4);
    expect(nextStudentToFill(list, 4)?.studentProfileId).toBe(1);
    expect(nextStudentToFill([student(1), student(2, { filled: true })], 1)).toBeNull();
  });

  it('две колонки: левая длиннее при нечётном числе', () => {
    expect(splitColumns([1, 2, 3, 4, 5])).toEqual([[1, 2, 3], [4, 5]]);
  });
});

describe('кэш листа после автосохранения', () => {
  const sheet: FeedbackSheet = {
    editable: true,
    canPublish: false,
    progress: { filled: 1, total: 2, missing: 1 },
    students: [student(1, { filled: true, entry: { id: 7, text: 'а', version: 1 } }), student(2)],
  };

  it('меняет строку и прогресс', () => {
    const next = applySavedEntry(sheet, 2, {
      entry: { id: 8, text: 'б', version: 0 },
      progress: { filled: 2, total: 2, missing: 0 },
    });
    expect(next?.students?.[1]).toMatchObject({ filled: true, entry: { id: 8 } });
    expect(next?.progress).toEqual({ filled: 2, total: 2, missing: 0 });
    expect(next?.students?.[0]).toBe(sheet.students?.[0]);
  });

  it('пустой текст удаляет запись — строка снова не заполнена', () => {
    const next = applySavedEntry(sheet, 1, { entry: undefined, progress: { filled: 0, total: 2, missing: 2 } });
    expect(next?.students?.[0]).toMatchObject({ filled: false, entry: undefined });
  });

  it('готовность к публикации меняется только на переходе через «все заполнены»', () => {
    expect(completionChanged({ missing: 1 }, { missing: 0 })).toBe(true);
    expect(completionChanged({ missing: 0 }, { missing: 1 })).toBe(true);
    expect(completionChanged({ missing: 3 }, { missing: 2 })).toBe(false);
  });
});
