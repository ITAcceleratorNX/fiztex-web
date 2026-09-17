import type { MyProfile, MyProfileAssignment, MyProfileChild } from '@/lib/profileApi';

/**
 * Правила экрана «Мой профиль» одним местом.
 *
 * Профиль — единственный экран, который одинаково открывают все роли, и заполненные
 * части у них разные. Что именно показывать, решается не по роли, а по тому, что
 * пришло: администратор без классов и учитель без назначений выглядят одинаково —
 * блока просто нет. Роль осталась бы вторым источником правды, и первый же учитель
 * без нагрузки получил бы пустую таблицу вместо отсутствующего блока.
 */

/** Кем родитель приходится ребёнку. Подписи те же, что в административной карточке. */
export const RELATION_LABELS: Record<string, string> = {
  MOTHER: 'Мама',
  FATHER: 'Папа',
  GUARDIAN: 'Опекун',
  OTHER: 'Родственник',
};

export function relationLabel(relation: string | null | undefined): string {
  return RELATION_LABELS[relation ?? ''] ?? 'Родитель';
}

export interface TeachingRow {
  subjectId: number;
  subjectName: string;
  classNames: string[];
}

/**
 * Нагрузка учителя — по предметам, а не строкой на каждую пару.
 *
 * Бэкенд отдаёт назначения плоским списком, и у учителя одного предмета на шесть
 * классов это шесть одинаковых строк, где меняется только класс. Свою нагрузку
 * читают как «что я веду и у кого», поэтому предмет — строка, классы — её содержимое.
 *
 * Порядок классов естественный (`5А, 5Б, 10А`), а не лексикографический: иначе
 * десятые классы встают между первым и вторым.
 */
export function teachingRows(assignments: MyProfileAssignment[] | undefined): TeachingRow[] {
  const bySubject = new Map<number, TeachingRow>();

  for (const assignment of assignments ?? []) {
    const subjectId = assignment.subjectId;
    const subjectName = assignment.subjectName;
    const className = assignment.className;
    if (subjectId == null || !subjectName || !className) continue;

    const row = bySubject.get(subjectId)
      ?? { subjectId, subjectName, classNames: [] };
    if (!row.classNames.includes(className)) row.classNames.push(className);
    bySubject.set(subjectId, row);
  }

  return [...bySubject.values()]
    .map((row) => ({
      ...row,
      classNames: row.classNames.sort((a, b) => a.localeCompare(b, 'ru', { numeric: true })),
    }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'ru'));
}

export interface ProfileFact {
  label: string;
  value: string;
}

/**
 * Строки «в двух словах»: чем человек занят в школе.
 *
 * Нагрузки учителя здесь нет намеренно — её показывает таблица `teachingRows`, и
 * показывает точнее: «Математика — 5А, 5Б, 6А» против двух строк «Классы» и
 * «Предметы», которые у учителя одного предмета говорят ровно то же самое дважды.
 *
 * Пусто — нормальное состояние: у администратора школьной карточки нет вовсе, и
 * придумывать ему строку («ведёт всю школу») значило бы писать неправду.
 */
export function profileFacts(profile: MyProfile | undefined): ProfileFact[] {
  if (!profile) return [];
  const facts: ProfileFact[] = [];

  if (profile.student?.className) {
    facts.push({ label: 'Класс', value: profile.student.className });
  }
  if (profile.student?.academicYearName) {
    facts.push({ label: 'Учебный год', value: profile.student.academicYearName });
  }

  return facts;
}

/** Контакты. Телефон — он же логин, и это стоит сказать прямо. */
export function contactRows(profile: MyProfile | undefined): ProfileFact[] {
  if (!profile) return [];
  const rows: ProfileFact[] = [];
  if (profile.phone) rows.push({ label: 'Телефон', value: profile.phone });
  if (profile.email) rows.push({ label: 'Почта', value: profile.email });
  return rows;
}

export function childLabel(child: MyProfileChild): string {
  const name = child.fullName
    ?? [child.lastName, child.firstName, child.middleName].filter(Boolean).join(' ');
  return name || 'Ребёнок';
}
