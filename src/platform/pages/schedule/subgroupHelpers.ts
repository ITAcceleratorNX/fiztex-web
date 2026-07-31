/**
 * Pure helpers for subgroups UI — sort/group roster, auto-split preview sizes.
 * Split sizes mirror SubgroupAutoSplitter (ceil on earlier groups).
 */

import type {
  StudentAlreadyInSetSubgroup,
  Subgroup,
  SubgroupInUse,
} from '@/lib/schedule2bTypes';

export type NameParts = {
  lastName: string;
  firstName: string;
  middleName: string | null;
};

/** «Иванов Алексей Петрович» → «Иванов А.» — подпись строки в макете 2015:12127. */
export function studentShortName(person: NameParts): string {
  const initial = person.firstName.trim().charAt(0);
  return initial ? `${person.lastName} ${initial}.` : person.lastName;
}

/** «ИА» — инициалы для аватара (2015:12126). */
export function studentInitials(person: NameParts): string {
  const last = person.lastName.trim().charAt(0);
  const first = person.firstName.trim().charAt(0);
  return `${last}${first}`.toLocaleUpperCase('ru');
}

/**
 * Пастельные подложки аватаров из макета: blue-50, emerald-50, purple-100,
 * red-50, orange-50 (2015:12125 и далее). В макете они просто чередуются;
 * здесь привязаны к id, чтобы ученик не менял цвет между экранами.
 */
export const AVATAR_TONES = [
  'bg-blue-50',
  'bg-emerald-50',
  'bg-purple-100',
  'bg-red-50',
  'bg-orange-50',
] as const;

export function avatarTone(studentId: number): string {
  return AVATAR_TONES[Math.abs(studentId) % AVATAR_TONES.length]!;
}

export function studentSortKey(person: NameParts): string {
  return [person.lastName, person.firstName, person.middleName ?? '']
    .map((p) => p.trim())
    .join(' ')
    .toLocaleLowerCase('ru');
}

export function compareStudentsByName(a: NameParts, b: NameParts): number {
  const byName = studentSortKey(a).localeCompare(studentSortKey(b), 'ru', {
    sensitivity: 'accent',
  });
  if (byName !== 0) return byName;
  return 0;
}

export function sortStudentsByName<T extends NameParts>(students: T[]): T[] {
  return [...students].sort(compareStudentsByName);
}

/** Same sizes as backend SubgroupAutoSplitter.split(..., groupCount). */
export function autoSplitSizes(studentCount: number, groupCount = 2): number[] {
  if (groupCount < 1) throw new Error('groupCount must be >= 1');
  if (studentCount <= 0) return Array.from({ length: groupCount }, () => 0);
  const base = Math.floor(studentCount / groupCount);
  const remainder = studentCount % groupCount;
  return Array.from({ length: groupCount }, (_, g) => base + (g < remainder ? 1 : 0));
}

export function defaultAutoSplitNames(groupCount = 2): string[] {
  return Array.from({ length: groupCount }, (_, i) => `Группа ${i + 1}`);
}

export function parseStudentAlreadyInSetDetails(
  details: unknown,
): StudentAlreadyInSetSubgroup[] {
  if (!Array.isArray(details)) return [];
  return details
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const studentId = Number(r.studentId);
      const subgroupId = Number(r.subgroupId);
      const subgroupName = typeof r.subgroupName === 'string' ? r.subgroupName : '';
      if (!Number.isFinite(studentId) || !Number.isFinite(subgroupId)) return null;
      return { studentId, subgroupId, subgroupName };
    })
    .filter((x): x is StudentAlreadyInSetSubgroup => x != null);
}

export function parseSubgroupsInUseDetails(details: unknown): SubgroupInUse[] {
  if (!Array.isArray(details)) return [];
  return details
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const subgroupId = Number(r.subgroupId);
      const name = typeof r.name === 'string' ? r.name : typeof r.subgroupName === 'string' ? r.subgroupName : '';
      const lessonCount = Number(r.lessonCount);
      if (!Number.isFinite(subgroupId) || !Number.isFinite(lessonCount)) return null;
      return { subgroupId, name, lessonCount };
    })
    .filter((x): x is SubgroupInUse => x != null);
}

export function activeSubgroups(subgroups: Subgroup[]): Subgroup[] {
  return subgroups
    .filter((s) => s.status === 'ACTIVE')
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

/** Состав набора: id подгруппы → id учеников. */
export type Membership = Record<number, number[]>;

export function membershipFromSubgroups(subgroups: Subgroup[]): Membership {
  const result: Membership = {};
  for (const subgroup of subgroups) {
    result[subgroup.id] = (subgroup.students ?? []).map((s) => s.studentId);
  }
  return result;
}

export type MembershipDiff = {
  removals: { subgroupId: number; studentId: number }[];
  additions: { subgroupId: number; studentIds: number[] }[];
};

/**
 * Разница «что на сервере» → «что в черновике». Удаления идут первыми:
 * иначе перенос ученика упрётся в STUDENT_ALREADY_IN_SET_SUBGROUP, потому что
 * он ещё числится в прежней подгруппе набора.
 */
export function diffMembership(server: Membership, draft: Membership): MembershipDiff {
  const removals: MembershipDiff['removals'] = [];
  const additions: MembershipDiff['additions'] = [];

  for (const key of Object.keys(draft)) {
    const subgroupId = Number(key);
    const before = new Set(server[subgroupId] ?? []);
    const after = new Set(draft[subgroupId] ?? []);

    for (const studentId of before) {
      if (!after.has(studentId)) removals.push({ subgroupId, studentId });
    }
    const toAdd = [...after].filter((studentId) => !before.has(studentId));
    if (toAdd.length > 0) additions.push({ subgroupId, studentIds: toAdd });
  }

  return { removals, additions };
}

export function membershipEquals(a: Membership, b: Membership): boolean {
  const diff = diffMembership(a, b);
  return diff.removals.length === 0 && diff.additions.length === 0;
}

/** Ученики, попавшие сразу в несколько подгрупп набора. */
export function duplicateStudentIds(membership: Membership): number[] {
  const seen = new Map<number, number>();
  for (const ids of Object.values(membership)) {
    for (const studentId of new Set(ids)) {
      seen.set(studentId, (seen.get(studentId) ?? 0) + 1);
    }
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([studentId]) => studentId);
}
