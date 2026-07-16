/**
 * Pure helpers for subgroups UI — sort/group roster, auto-split preview sizes.
 * Split sizes mirror SubgroupAutoSplitter (ceil on earlier groups).
 */

import type {
  DuplicateStudent,
  StudentAlreadyInSetSubgroup,
  Subgroup,
  SubgroupInUse,
  SubgroupStudent,
} from '@/lib/schedule2bTypes';

export type NameParts = {
  lastName: string;
  firstName: string;
  middleName: string | null;
};

export function studentFullName(person: NameParts): string {
  return [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');
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

export function subgroupNameById(subgroups: Subgroup[], id: number): string {
  return subgroups.find((s) => s.id === id)?.name ?? `Подгруппа #${id}`;
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

export function formatDuplicateLocations(
  duplicate: DuplicateStudent,
  subgroups: Subgroup[],
): string {
  const names = duplicate.subgroupIds.map((id) => subgroupNameById(subgroups, id));
  return names.join(', ');
}

export function activeSubgroups(subgroups: Subgroup[]): Subgroup[] {
  return subgroups
    .filter((s) => s.status === 'ACTIVE')
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function sortSubgroupStudents(subgroup: Subgroup): SubgroupStudent[] {
  return sortStudentsByName(subgroup.students ?? []);
}
