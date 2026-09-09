/**
 * Сопоставление разобранного файла со справочниками школы.
 *
 * Файл знает свои имена: класс «5ә», предмет «қазақ тілі», учитель «ИЛ». База знает
 * свои: класс с id, предмет «Казахский язык», учитель «Искакова Лаура». Сопоставление
 * здесь и только здесь — разбор (`parseScheduleWorkbook`) остаётся про формат, а экран
 * про показ.
 *
 * Правило раздела: **непонятое не додумываем**. Учитель по инициалам «КА» может быть
 * и Каримовой, и Кадыровым; выбрать наугад — значит поставить в опубликованное
 * расписание чужого человека. Такие ячейки становятся проблемами с вариантами, а не
 * догадкой, и урок из них не создаётся, пока администратор не решит сам.
 */

import type { Weekday } from '@/lib/scheduleSettingsTypes';
import type {
  ConstructorContextGroupSet,
  CreateScheduleLessonInput,
  LessonPeriodSlot,
} from '@/platform/services/schedules';
import type { ParsedLesson } from './parseScheduleWorkbook';
import { matchSubjectKeyByName, normalizeSubjectText, subjectDefinition } from './subjectDictionary';

export interface CatalogClass {
  id: number;
  name: string;
}

export interface CatalogSubject {
  id: number;
  name: string;
}

export interface CatalogTeacher {
  id: number;
  fullName: string;
  subjectIds: number[];
}

export interface SchoolCatalogs {
  classes: CatalogClass[];
  subjects: CatalogSubject[];
  teachers: CatalogTeacher[];
}

/** Что известно про конкретный класс: у каждого свой звонок и свои подгруппы. */
export interface ClassContext {
  bellTemplateId: number | null;
  bellTemplateName: string | null;
  periods: LessonPeriodSlot[];
  groupSets: ConstructorContextGroupSet[];
}

/**
 * Ручные решения администратора. Ключи — то, что написано в файле, поэтому выбор
 * переживает повторную загрузку того же файла.
 */
export interface ImportOverrides {
  /** Имя класса из файла → id класса. */
  classes: Record<string, number>;
  /** Ключ предмета (или его текст, если словарь не узнал) → id предмета. */
  subjects: Record<string, number>;
  /** Инициалы → id учителя. */
  teachers: Record<string, number>;
  /** `класс|метка группы` → id подгруппы. */
  subgroups: Record<string, number>;
  /** Ключ предмета → учитель для уроков, где в файле учитель не указан. */
  subjectTeachers: Record<string, number>;
}

export const EMPTY_OVERRIDES: ImportOverrides = {
  classes: {},
  subjects: {},
  teachers: {},
  subgroups: {},
  subjectTeachers: {},
};

export type ProblemCode =
  | 'CLASS_NOT_FOUND'
  | 'SUBJECT_NOT_FOUND'
  | 'SUBJECT_AMBIGUOUS'
  | 'TEACHER_MISSING'
  | 'TEACHER_NOT_FOUND'
  | 'TEACHER_AMBIGUOUS'
  | 'SUBGROUP_NOT_FOUND'
  | 'SUBGROUP_AMBIGUOUS'
  | 'NO_BELL_TEMPLATE'
  | 'PERIOD_NOT_FOUND'
  | 'TIME_MISMATCH'
  | 'TEACHER_SUBJECT_MISMATCH';

export type ProblemSeverity = 'error' | 'warning';

/**
 * Проблема — про одно значение, а не про одну ячейку: «учитель ИЛ не найден» в 32
 * уроках это одна строка отчёта с 32 примерами, иначе таблица не читается.
 */
export interface ImportProblem {
  code: ProblemCode;
  severity: ProblemSeverity;
  /** Что именно не сошлось: имя класса, инициалы, номер урока. */
  value: string;
  message: string;
  /** Класс, если проблема касается одного класса. */
  className: string | null;
  lessonCount: number;
  /** Первые несколько адресов ячеек — чтобы найти место в файле. */
  examples: string[];
  /** Варианты для ручного выбора, если решение за администратором. */
  candidates?: Array<{ id: number; label: string }>;
  /** Какой словарь правит эту проблему: ключ для `ImportOverrides`. */
  fix?: { kind: keyof ImportOverrides; key: string };
}

export interface PlannedLesson extends CreateScheduleLessonInput {
  /** Исходная строка файла — показываем в предпросмотре рядом с результатом. */
  source: ParsedLesson;
  subjectName: string;
  teacherName: string;
  subgroupName: string | null;
}

export interface ClassImportPlan {
  className: string;
  classId: number | null;
  bellTemplateId: number | null;
  bellTemplateName: string | null;
  lessons: PlannedLesson[];
  /** Уроки файла, которые не удалось собрать: столько строк требует правки. */
  blockedCount: number;
  problems: ImportProblem[];
  /** План готов к записи: все уроки класса собрались. */
  ready: boolean;
}

export interface ResolvedImport {
  plans: ClassImportPlan[];
  problems: ImportProblem[];
  totals: {
    lessons: number;
    ready: number;
    blocked: number;
    classesReady: number;
    classesBlocked: number;
  };
}

/** Латиница в именах классов встречается вперемешку с кириллицей: «8F1» и «8С». */
const CONFUSABLE_LATIN_TO_CYRILLIC: Record<string, string> = {
  a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м',
  o: 'о', p: 'р', t: 'т', x: 'х', y: 'у',
};

function normalizeClassName(name: string): string {
  return name.toLowerCase().replace(/[\s.]/g, '');
}

function foldConfusables(name: string): string {
  return normalizeClassName(name)
    .split('')
    .map((char) => CONFUSABLE_LATIN_TO_CYRILLIC[char] ?? char)
    .join('');
}

/** Инициалы учителя: «Искакова Лаура Маратовна» → «ИЛ» и «ИЛМ». */
export function teacherInitialVariants(fullName: string): string[] {
  const words = fullName.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const letters = words.map((word) => word[0].toUpperCase());
  const variants = new Set<string>();
  if (letters.length >= 2) variants.add(letters[0] + letters[1]);
  if (letters.length >= 3) variants.add(letters[0] + letters[1] + letters[2]);
  return [...variants];
}

function firstDigits(text: string): string | null {
  return /\d+/.exec(text)?.[0] ?? null;
}

function cellAddress(lesson: ParsedLesson): string {
  const cell = lesson.cells[0];
  return cell ? `${cell.sheet} · строка ${cell.row}` : '';
}

interface ProblemAccumulator {
  add(problem: Omit<ImportProblem, 'lessonCount' | 'examples'>, lesson: ParsedLesson): void;
  list(): ImportProblem[];
}

function createProblems(): ProblemAccumulator {
  const byKey = new Map<string, ImportProblem>();
  return {
    add(problem, lesson) {
      const key = `${problem.code}|${problem.className ?? ''}|${problem.value}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.lessonCount++;
        if (existing.examples.length < 5) existing.examples.push(cellAddress(lesson));
        return;
      }
      byKey.set(key, { ...problem, lessonCount: 1, examples: [cellAddress(lesson)] });
    },
    list() {
      return [...byKey.values()].sort(
        (a, b) =>
          Number(b.severity === 'error') - Number(a.severity === 'error') ||
          b.lessonCount - a.lessonCount,
      );
    },
  };
}

function buildSubjectIndex(subjects: CatalogSubject[]) {
  const byKey = new Map<string, CatalogSubject[]>();
  const byName = new Map<string, CatalogSubject>();
  for (const subject of subjects) {
    byName.set(normalizeSubjectText(subject.name), subject);
    const key = matchSubjectKeyByName(subject.name);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(subject);
    byKey.set(key, list);
  }
  return { byKey, byName };
}

function buildTeacherIndex(teachers: CatalogTeacher[]) {
  const byInitials = new Map<string, CatalogTeacher[]>();
  for (const teacher of teachers) {
    for (const variant of teacherInitialVariants(teacher.fullName)) {
      const list = byInitials.get(variant) ?? [];
      list.push(teacher);
      byInitials.set(variant, list);
    }
  }
  return byInitials;
}

export function resolveScheduleImport(
  lessons: ParsedLesson[],
  catalogs: SchoolCatalogs,
  classContexts: Map<string, ClassContext>,
  overrides: ImportOverrides = EMPTY_OVERRIDES,
): ResolvedImport {
  const classesByName = new Map<string, CatalogClass>();
  for (const item of catalogs.classes) {
    classesByName.set(normalizeClassName(item.name), item);
    const folded = foldConfusables(item.name);
    if (!classesByName.has(folded)) classesByName.set(folded, item);
  }
  const subjectIndex = buildSubjectIndex(catalogs.subjects);
  const subjectById = new Map(catalogs.subjects.map((item) => [item.id, item]));
  const teacherIndex = buildTeacherIndex(catalogs.teachers);
  const teacherById = new Map(catalogs.teachers.map((item) => [item.id, item]));

  const byClass = new Map<string, ParsedLesson[]>();
  for (const lesson of lessons) {
    const list = byClass.get(lesson.className) ?? [];
    list.push(lesson);
    byClass.set(lesson.className, list);
  }

  const plans: ClassImportPlan[] = [];
  const allProblems: ImportProblem[] = [];

  for (const [className, classLessons] of byClass) {
    const problems = createProblems();
    const planned: PlannedLesson[] = [];
    let blocked = 0;

    const overrideClassId = overrides.classes[className];
    const matchedClass =
      (overrideClassId != null
        ? catalogs.classes.find((item) => item.id === overrideClassId)
        : undefined) ??
      classesByName.get(normalizeClassName(className)) ??
      classesByName.get(foldConfusables(className)) ??
      null;

    const context = matchedClass ? classContexts.get(className) ?? null : null;
    const periodByNumber = new Map((context?.periods ?? []).map((p) => [p.lessonNumber, p]));
    const subgroups = (context?.groupSets ?? []).flatMap((set) =>
      set.subgroups.map((subgroup) => ({ ...subgroup, groupSetName: set.name })),
    );

    for (const lesson of classLessons) {
      if (!matchedClass) {
        blocked++;
        problems.add(
          {
            code: 'CLASS_NOT_FOUND',
            severity: 'error',
            value: className,
            className,
            message: `Класса «${className}» нет в справочнике выбранного учебного года`,
            candidates: catalogs.classes.map((item) => ({ id: item.id, label: item.name })),
            fix: { kind: 'classes', key: className },
          },
          lesson,
        );
        continue;
      }

      // ── Предмет ────────────────────────────────────────────────────────────
      const subjectKey = lesson.subjectKey ?? `text:${normalizeSubjectText(lesson.subjectText)}`;
      const overrideSubjectId = overrides.subjects[subjectKey];
      let subject = overrideSubjectId != null ? subjectById.get(overrideSubjectId) ?? null : null;
      if (!subject && lesson.subjectKey) {
        const matches = subjectIndex.byKey.get(lesson.subjectKey) ?? [];
        if (matches.length === 1) subject = matches[0];
        else if (matches.length > 1) {
          blocked++;
          problems.add(
            {
              code: 'SUBJECT_AMBIGUOUS',
              severity: 'error',
              value: subjectDefinition(lesson.subjectKey)?.label ?? lesson.subjectText,
              className: null,
              message: `В справочнике несколько предметов «${subjectDefinition(lesson.subjectKey)?.label}» — выберите нужный`,
              candidates: matches.map((item) => ({ id: item.id, label: item.name })),
              fix: { kind: 'subjects', key: subjectKey },
            },
            lesson,
          );
          continue;
        }
      }
      if (!subject) subject = subjectIndex.byName.get(normalizeSubjectText(lesson.subjectText)) ?? null;
      if (!subject) {
        blocked++;
        problems.add(
          {
            code: 'SUBJECT_NOT_FOUND',
            severity: 'error',
            value: lesson.subjectText || lesson.raw,
            className: null,
            message: `Предмета «${lesson.subjectText || lesson.raw}» нет в справочнике школы`,
            candidates: catalogs.subjects.map((item) => ({ id: item.id, label: item.name })),
            fix: { kind: 'subjects', key: subjectKey },
          },
          lesson,
        );
        continue;
      }

      // ── Учитель ────────────────────────────────────────────────────────────
      let teacher: CatalogTeacher | null = null;
      if (!lesson.teacherInitials) {
        const fallbackId = overrides.subjectTeachers[subjectKey];
        teacher = fallbackId != null ? teacherById.get(fallbackId) ?? null : null;
        if (!teacher) {
          blocked++;
          problems.add(
            {
              code: 'TEACHER_MISSING',
              severity: 'error',
              value: subject.name,
              className: null,
              message: `В файле не указан учитель для «${subject.name}» — выберите, кого поставить`,
              candidates: catalogs.teachers
                .filter((item) => item.subjectIds.includes(subject!.id))
                .concat(catalogs.teachers.filter((item) => !item.subjectIds.includes(subject!.id)))
                .map((item) => ({ id: item.id, label: item.fullName })),
              fix: { kind: 'subjectTeachers', key: subjectKey },
            },
            lesson,
          );
          continue;
        }
      } else {
        const overrideTeacherId = overrides.teachers[lesson.teacherInitials];
        teacher = overrideTeacherId != null ? teacherById.get(overrideTeacherId) ?? null : null;
        if (!teacher) {
          const matches = teacherIndex.get(lesson.teacherInitials) ?? [];
          if (matches.length === 1) teacher = matches[0];
          else if (matches.length > 1) {
            // Предмет — единственная подсказка, которая есть в самом файле.
            const bySubject = matches.filter((item) => item.subjectIds.includes(subject.id));
            if (bySubject.length === 1) teacher = bySubject[0];
            else {
              blocked++;
              problems.add(
                {
                  code: 'TEACHER_AMBIGUOUS',
                  severity: 'error',
                  value: lesson.teacherInitials,
                  className: null,
                  message: `Инициалам «${lesson.teacherInitials}» отвечают несколько учителей`,
                  candidates: (bySubject.length > 0 ? bySubject : matches).map((item) => ({
                    id: item.id,
                    label: item.fullName,
                  })),
                  fix: { kind: 'teachers', key: lesson.teacherInitials },
                },
                lesson,
              );
              continue;
            }
          } else {
            blocked++;
            problems.add(
              {
                code: 'TEACHER_NOT_FOUND',
                severity: 'error',
                value: lesson.teacherInitials,
                className: null,
                message: `Учителя с инициалами «${lesson.teacherInitials}» нет среди учителей года`,
                candidates: catalogs.teachers.map((item) => ({ id: item.id, label: item.fullName })),
                fix: { kind: 'teachers', key: lesson.teacherInitials },
              },
              lesson,
            );
            continue;
          }
        }
      }

      if (!teacher.subjectIds.includes(subject.id)) {
        problems.add(
          {
            code: 'TEACHER_SUBJECT_MISMATCH',
            severity: 'warning',
            value: `${teacher.fullName} · ${subject.name}`,
            className: null,
            message: `${teacher.fullName} не закреплён за предметом «${subject.name}»`,
          },
          lesson,
        );
      }

      // ── Звонок ─────────────────────────────────────────────────────────────
      if (!context?.bellTemplateId || periodByNumber.size === 0) {
        blocked++;
        problems.add(
          {
            code: 'NO_BELL_TEMPLATE',
            severity: 'error',
            value: className,
            className,
            message: `К классу «${className}» не привязан шаблон звонков — расписание не к чему крепить`,
          },
          lesson,
        );
        continue;
      }
      const period = periodByNumber.get(lesson.lessonNumber);
      if (!period) {
        blocked++;
        problems.add(
          {
            code: 'PERIOD_NOT_FOUND',
            severity: 'error',
            value: String(lesson.lessonNumber),
            className,
            message: `В шаблоне «${context.bellTemplateName}» нет урока №${lesson.lessonNumber}`,
          },
          lesson,
        );
        continue;
      }
      if (lesson.time && period.startTime.slice(0, 5) !== lesson.time.start) {
        problems.add(
          {
            code: 'TIME_MISMATCH',
            severity: 'warning',
            value: `${lesson.lessonNumber} · ${lesson.time.start}`,
            className,
            message: `Урок №${lesson.lessonNumber} в файле начинается в ${lesson.time.start}, а по звонку — в ${period.startTime.slice(0, 5)}`,
          },
          lesson,
        );
      }

      // ── Подгруппа ──────────────────────────────────────────────────────────
      let subgroupId: number | null = null;
      let subgroupName: string | null = null;
      if (lesson.groupLabel) {
        const overrideKey = `${className}|${lesson.groupLabel}`;
        const overrideSubgroupId = overrides.subgroups[overrideKey];
        const matches = subgroups.filter(
          (item) => firstDigits(item.name) === lesson.groupLabel,
        );
        const chosen =
          (overrideSubgroupId != null
            ? subgroups.find((item) => item.id === overrideSubgroupId)
            : undefined) ?? (matches.length === 1 ? matches[0] : null);
        if (!chosen) {
          blocked++;
          problems.add(
            {
              code: matches.length > 1 ? 'SUBGROUP_AMBIGUOUS' : 'SUBGROUP_NOT_FOUND',
              severity: 'error',
              value: `${className} · группа ${lesson.groupLabel}`,
              className,
              message:
                matches.length > 1
                  ? `У «${className}» несколько подгрупп с номером ${lesson.groupLabel} — выберите нужную`
                  : `У «${className}» нет подгруппы с номером ${lesson.groupLabel}`,
              candidates: subgroups.map((item) => ({
                id: item.id,
                label: `${item.name} · ${item.groupSetName}`,
              })),
              fix: { kind: 'subgroups', key: overrideKey },
            },
            lesson,
          );
          continue;
        }
        subgroupId = chosen.id;
        subgroupName = chosen.name;
      }

      planned.push({
        weekday: lesson.weekday satisfies Weekday,
        lessonPeriodId: period.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        targetType: subgroupId ? 'SUBGROUP' : 'CLASS',
        subgroupId,
        room: lesson.room || null,
        source: lesson,
        subjectName: subject.name,
        teacherName: teacher.fullName,
        subgroupName,
      });
    }

    const classProblems = problems.list();
    allProblems.push(...classProblems);
    plans.push({
      className,
      classId: matchedClass?.id ?? null,
      bellTemplateId: context?.bellTemplateId ?? null,
      bellTemplateName: context?.bellTemplateName ?? null,
      lessons: planned,
      blockedCount: blocked,
      problems: classProblems,
      ready: blocked === 0 && planned.length > 0,
    });
  }

  plans.sort((a, b) => a.className.localeCompare(b.className, 'ru', { numeric: true }));

  // Одна и та же проблема приходит из разных классов — в общий список её кладём один раз.
  const merged = new Map<string, ImportProblem>();
  for (const problem of allProblems) {
    const key = `${problem.code}|${problem.className ?? ''}|${problem.value}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...problem, examples: [...problem.examples] });
      continue;
    }
    existing.lessonCount += problem.lessonCount;
    for (const example of problem.examples) {
      if (existing.examples.length < 5) existing.examples.push(example);
    }
  }

  return {
    plans,
    problems: [...merged.values()].sort(
      (a, b) =>
        Number(b.severity === 'error') - Number(a.severity === 'error') ||
        b.lessonCount - a.lessonCount,
    ),
    totals: {
      lessons: lessons.length,
      ready: plans.reduce((sum, plan) => sum + plan.lessons.length, 0),
      blocked: plans.reduce((sum, plan) => sum + plan.blockedCount, 0),
      classesReady: plans.filter((plan) => plan.ready).length,
      classesBlocked: plans.filter((plan) => !plan.ready).length,
    },
  };
}
