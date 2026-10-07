import type { Schema } from '@/lib/apiSchemas';
import { shortNames } from '@/lib/attendanceJournalModel';
import { GRADE_TYPE_LABELS } from '@/lib/gradesModel';
import type { GradeType } from '@/lib/gradesApi';
import { shortDate } from '@/lib/journalModel';

type Student = Schema<'MyClassStudentView'>;
type Grade = Schema<'MyClassGradeItemView'>;
type FinalGrade = Schema<'MyClassFinalGradeItemView'>;
type GradeResult = Schema<'MyClassGradeResultView'>;
type Period = Schema<'MyClassContextPeriodView'>;
type Subject = Schema<'MyClassSubjectView'>;

/**
 * Вкладка «Оценки» классного руководителя (Figma 2200:3502).
 *
 * <p>Сетку строит клиент, но ничего в ней не считает: оценки, итоги и средние приходят с
 * сервера готовыми, здесь они только раскладываются по клеткам. Колонки — источники
 * оценок (урок или задание), а не расписание: «Мой класс» читает оценки, и урок, по
 * которому никто ничего не получил, классному руководителю показывать нечем.
 */

export type ColumnKind = 'LESSON' | 'HOMEWORK' | 'SOR' | 'SOCH';

export interface JournalColumn {
  key: string;
  date: string;
  kind: ColumnKind;
}

export interface JournalRow {
  studentProfileId: number;
  fullName: string;
  shortName: string;
  cells: Map<string, Grade[]>;
  result: GradeResult | null;
  finals: FinalGrade[];
}

export interface MyClassJournal {
  columns: JournalColumn[];
  rows: JournalRow[];
}

const COLUMN_EVENT: Record<ColumnKind, string> = {
  LESSON: 'Урок',
  HOMEWORK: 'ДЗ',
  SOR: 'СОР',
  SOCH: 'СОЧ',
};

/** Нижняя строка шапки колонки — «Урок», «ДЗ», «СОР» или «СОЧ». */
export function columnEvent(kind: ColumnKind): string {
  return COLUMN_EVENT[kind];
}

export function isSummative(kind: ColumnKind): boolean {
  return kind === 'SOR' || kind === 'SOCH';
}

/**
 * Суммативная работа выделяет колонку целиком, как в макете: СОЧ сильнее СОР, потому что
 * на одном уроке их не смешивают, а если смешали — главное событие урока всё-таки СОЧ.
 */
function columnKind(grades: Grade[]): ColumnKind {
  if (grades.some((grade) => grade.gradeType === 'SUMMATIVE_TERM')) return 'SOCH';
  if (grades.some((grade) => grade.gradeType === 'SUMMATIVE_SECTION')) return 'SOR';
  return grades[0]?.sourceType === 'HOMEWORK' ? 'HOMEWORK' : 'LESSON';
}

function sourceKey(grade: Grade): string {
  return `${grade.sourceType}:${grade.sourceId}`;
}

function studentName(student: Student): string {
  return student.displayName?.trim()
    || [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

/**
 * Таблица «ученики × источники оценок». Строки — текущий состав в порядке сервера (по
 * фамилии), включая учеников без оценок: пустая строка тоже ответ. Оценки учеников, которых
 * уже нет в составе (перевод между запросами), в сетку не попадают — их покажет новый класс.
 */
export function buildMyClassJournal({
  students,
  grades,
  finals,
  results,
}: {
  students: Student[];
  grades: Grade[];
  finals: FinalGrade[];
  results: GradeResult[];
}): MyClassJournal {
  const studentIds = new Set(students.map((student) => student.studentProfileId));
  const current = grades.filter((grade) => studentIds.has(grade.studentProfileId));

  const bySource = new Map<string, Grade[]>();
  for (const grade of current) {
    const key = sourceKey(grade);
    bySource.set(key, [...(bySource.get(key) ?? []), grade]);
  }
  const columns = [...bySource].map(([key, items]) => ({
    key,
    date: items[0]?.sourceDate ?? '',
    kind: columnKind(items),
    sourceType: items[0]?.sourceType ?? 'LESSON',
    sourceId: items[0]?.sourceId ?? 0,
  }));
  columns.sort((a, b) => a.date.localeCompare(b.date)
    || a.sourceType.localeCompare(b.sourceType)
    || a.sourceId - b.sourceId);

  const resultsById = new Map(results.map((result) => [result.studentProfileId, result]));
  const names = students.map(studentName);
  const short = shortNames(names);
  const rows = students.map((student, index) => {
    const cells = new Map<string, Grade[]>();
    for (const grade of current) {
      if (grade.studentProfileId !== student.studentProfileId) continue;
      const key = sourceKey(grade);
      cells.set(key, [...(cells.get(key) ?? []), grade]);
    }
    // Внутри клетки — в порядке выставления: сервер отдаёт новые сверху.
    cells.forEach((items) => items.sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? '')
      || (a.gradeId ?? 0) - (b.gradeId ?? 0)));
    return {
      studentProfileId: student.studentProfileId as number,
      fullName: names[index],
      shortName: short[index],
      cells,
      result: resultsById.get(student.studentProfileId) ?? null,
      finals: finals.filter((final) => final.studentProfileId === student.studentProfileId),
    };
  });

  return {
    columns: columns.map(({ key, date, kind }) => ({ key, date, kind })),
    rows,
  };
}

/** Подпись под курсором: тип работы, дата и класс, если оценка получена до перевода. */
export function gradeTitle(grade: Grade, classId: number): string {
  const type = grade.gradeType ? GRADE_TYPE_LABELS[grade.gradeType as GradeType] : 'Оценка';
  const parts = [type, grade.sourceDate ? shortDate(grade.sourceDate) : null];
  if (grade.sourceClassId != null && grade.sourceClassId !== classId && grade.sourceClassName) {
    parts.push(`получена в классе ${grade.sourceClassName}`);
  }
  return parts.filter(Boolean).join(' · ');
}

const PERIOD_NOUN: Record<NonNullable<Period['type']>, string> = {
  QUARTER: 'четверть',
  TRIMESTER: 'триместр',
  SEMESTER: 'полугодие',
  CUSTOM: 'период',
};

/** «четверть» — так режим и итог называются по типу периода, а не всегда «четвертью». */
export function periodNoun(period: Period | undefined): string {
  return PERIOD_NOUN[period?.type ?? 'CUSTOM'] ?? 'период';
}

export function capitalize(text: string): string {
  return text ? text[0].toLocaleUpperCase('ru-RU') + text.slice(1) : text;
}

/** «1 четверть (01.09 – 27.10)» — границы в подписи, как в макете. */
export function periodLabel(period: Period): string {
  const range = period.startDate && period.endDate
    ? ` (${shortDate(period.startDate)} – ${shortDate(period.endDate)})`
    : '';
  return `${period.name ?? `Период ${period.id}`}${range}`;
}

/**
 * Предмет по умолчанию — первый, по которому за период уже есть оценки: открыть вкладку на
 * пустом предмете значило бы показать «оценок нет» классу, где они есть.
 */
export function defaultSubjectId(subjects: Subject[]): number | null {
  return (subjects.find((subject) => (subject.gradeCount ?? 0) > 0) ?? subjects[0])?.subjectId ?? null;
}
