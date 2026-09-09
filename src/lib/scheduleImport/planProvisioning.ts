/**
 * Что из файла можно завести в школе до импорта.
 *
 * Расписание ссылается на сущности, которых в базе может не быть: класс, предмет,
 * шаблон звонков, подгруппы. Часть из них файл описывает полностью, и заводить их
 * руками по одной — та же работа, которую только что сделал разбор.
 *
 * Граница проходит по данным, а не по удобству. **Класс, предмет, звонки и подгруппы
 * файл называет целиком**: «5ә» — это параллель 5 и литера «ә», «07.45 - 08.25» на
 * седьмой строке — это первый урок первой смены. **Учителя файл не называет вовсе** —
 * от него остались две буквы, а карточке нужны фамилия, имя и уникальный телефон.
 * Поэтому учителей здесь нет ни в каком виде: неизвестные инициалы остаются строкой
 * отчёта, где выбирают из тех, кто в школе уже есть.
 */

import type {
  CatalogClass,
  CatalogSubject,
  ClassContext,
  SchoolCatalogs,
} from './resolveScheduleImport';
import type { ParsedLesson } from './parseScheduleWorkbook';
import { matchSubjectKeyByName, normalizeSubjectText, subjectDefinition } from './subjectDictionary';

export interface MissingClass {
  /** Имя как в файле — оно же станет именем класса. */
  name: string;
  grade: string;
  letter: string;
  lessonCount: number;
}

export interface MissingSubject {
  /** Ключ словаря или `text:…` для незнакомого написания — им же правится `overrides`. */
  key: string;
  name: string;
  lessonCount: number;
}

export interface MissingBellTemplatePeriod {
  lessonNumber: number;
  startTime: string;
  endTime: string;
}

export interface MissingBellTemplate {
  key: string;
  name: string;
  periods: MissingBellTemplatePeriod[];
  /** Классы файла, которые пойдут по этому звонку. */
  classNames: string[];
}

export interface MissingSubgroups {
  className: string;
  /** Метки групп из шапки файла: «1», «2». */
  labels: string[];
}

export interface ProvisioningPlan {
  classes: MissingClass[];
  subjects: MissingSubject[];
  bellTemplates: MissingBellTemplate[];
  subgroups: MissingSubgroups[];
}

export function isProvisioningPlanEmpty(plan: ProvisioningPlan): boolean {
  return (
    plan.classes.length === 0 &&
    plan.subjects.length === 0 &&
    plan.bellTemplates.length === 0 &&
    plan.subgroups.length === 0
  );
}

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

/** «5ә» → параллель 5, литера «ә»; «8F1» → 8 и «F1». Бэкенд хранит их отдельно. */
export function splitClassName(name: string): { grade: string; letter: string } | null {
  const match = /^\s*(\d{1,2})\s*[-—]?\s*(\S.*?)\s*$/.exec(name);
  if (!match) return null;
  return { grade: match[1], letter: match[2] };
}

function subjectKeyOf(lesson: ParsedLesson): string {
  return lesson.subjectKey ?? `text:${normalizeSubjectText(lesson.subjectText)}`;
}

function findClass(classes: CatalogClass[], name: string): CatalogClass | null {
  const byName = new Map<string, CatalogClass>();
  for (const item of classes) {
    byName.set(normalizeClassName(item.name), item);
    const folded = foldConfusables(item.name);
    if (!byName.has(folded)) byName.set(folded, item);
  }
  return byName.get(normalizeClassName(name)) ?? byName.get(foldConfusables(name)) ?? null;
}

function hasSubject(subjects: CatalogSubject[], lesson: ParsedLesson): boolean {
  if (lesson.subjectKey) {
    if (subjects.some((item) => matchSubjectKeyByName(item.name) === lesson.subjectKey)) return true;
  }
  const normalized = normalizeSubjectText(lesson.subjectText);
  return subjects.some((item) => normalizeSubjectText(item.name) === normalized);
}

/** Подпись набора звонков: по ней классы группируются в один шаблон. */
function bellSignature(periods: MissingBellTemplatePeriod[]): string {
  return periods.map((p) => `${p.lessonNumber}@${p.startTime}-${p.endTime}`).join(',');
}

/**
 * Имя шаблона — по границам учебного дня («Звонки 07:45–13:15»).
 *
 * В файле две смены с одинаковой нумерацией уроков, и «Шаблон из файла» их не
 * различил бы. Имена шаблонов уникальны внутри года — время в имени и делает их
 * разными, не спрашивая ничего у администратора.
 */
function bellTemplateName(periods: MissingBellTemplatePeriod[]): string {
  const first = periods[0];
  const last = periods[periods.length - 1];
  return `Звонки ${first.startTime}–${last.endTime}`;
}

export function planProvisioning(
  lessons: ParsedLesson[],
  catalogs: SchoolCatalogs,
  classContexts: Map<string, ClassContext>,
): ProvisioningPlan {
  const byClass = new Map<string, ParsedLesson[]>();
  for (const lesson of lessons) {
    const list = byClass.get(lesson.className) ?? [];
    list.push(lesson);
    byClass.set(lesson.className, list);
  }

  // ── Классы ───────────────────────────────────────────────────────────────────
  const classes: MissingClass[] = [];
  for (const [className, classLessons] of byClass) {
    if (findClass(catalogs.classes, className)) continue;
    const parts = splitClassName(className);
    // Имя без параллели («Спецкурс») бэкенду не передать: grade и letter обязательны.
    if (!parts) continue;
    classes.push({ name: className, ...parts, lessonCount: classLessons.length });
  }

  // ── Предметы ─────────────────────────────────────────────────────────────────
  const subjectCounts = new Map<string, { name: string; count: number }>();
  for (const lesson of lessons) {
    if (hasSubject(catalogs.subjects, lesson)) continue;
    const key = subjectKeyOf(lesson);
    const name =
      (lesson.subjectKey ? subjectDefinition(lesson.subjectKey)?.label : null) ??
      lesson.subjectText;
    const entry = subjectCounts.get(key) ?? { name, count: 0 };
    entry.count++;
    subjectCounts.set(key, entry);
  }
  const subjects: MissingSubject[] = [...subjectCounts.entries()]
    .map(([key, entry]) => ({ key, name: entry.name, lessonCount: entry.count }))
    .sort((a, b) => b.lessonCount - a.lessonCount);

  // ── Шаблоны звонков ──────────────────────────────────────────────────────────
  const templatesBySignature = new Map<string, MissingBellTemplate>();
  for (const [className, classLessons] of byClass) {
    const context = classContexts.get(className);
    // Шаблон нужен и новому классу (контекста ещё нет), и старому без привязки.
    if (context?.bellTemplateId && context.periods.length > 0) continue;

    const periodByNumber = new Map<number, MissingBellTemplatePeriod>();
    for (const lesson of classLessons) {
      if (!lesson.time || periodByNumber.has(lesson.lessonNumber)) continue;
      periodByNumber.set(lesson.lessonNumber, {
        lessonNumber: lesson.lessonNumber,
        startTime: lesson.time.start,
        endTime: lesson.time.end,
      });
    }
    const periods = [...periodByNumber.values()].sort((a, b) => a.lessonNumber - b.lessonNumber);
    // Без времени в файле шаблон не собрать — такой класс останется с проблемой.
    if (periods.length === 0) continue;

    const signature = bellSignature(periods);
    const existing = templatesBySignature.get(signature);
    if (existing) {
      existing.classNames.push(className);
      continue;
    }
    templatesBySignature.set(signature, {
      key: signature,
      name: bellTemplateName(periods),
      periods,
      classNames: [className],
    });
  }
  const bellTemplates = [...templatesBySignature.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'ru'),
  );
  for (const template of bellTemplates) {
    template.classNames.sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
  }

  // ── Подгруппы ────────────────────────────────────────────────────────────────
  const subgroups: MissingSubgroups[] = [];
  for (const [className, classLessons] of byClass) {
    const labels = [...new Set(classLessons.map((l) => l.groupLabel).filter(Boolean))] as string[];
    if (labels.length === 0) continue;
    const existing = (classContexts.get(className)?.groupSets ?? []).flatMap((set) =>
      set.subgroups.map((subgroup) => /\d+/.exec(subgroup.name)?.[0] ?? ''),
    );
    const missing = labels.filter((label) => !existing.includes(label));
    if (missing.length === 0) continue;
    subgroups.push({ className, labels: missing.sort() });
  }
  subgroups.sort((a, b) => a.className.localeCompare(b.className, 'ru', { numeric: true }));

  return {
    classes: classes.sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true })),
    subjects,
    bellTemplates,
    subgroups,
  };
}
