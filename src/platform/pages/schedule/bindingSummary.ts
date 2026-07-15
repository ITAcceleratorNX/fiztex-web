import type { GradeClassGroup, TemplateBinding } from '@/lib/scheduleSettingsTypes';

/**
 * «5А, 5Б, 5В» → «параллель 5» when every class of that grade is bound.
 */
export function summarizeBindings(
  bindings: TemplateBinding[],
  gradeGroups: GradeClassGroup[],
): string {
  if (bindings.length === 0) return '—';

  const byGrade = new Map<string, TemplateBinding[]>();
  for (const binding of bindings) {
    const list = byGrade.get(binding.grade) ?? [];
    list.push(binding);
    byGrade.set(binding.grade, list);
  }

  const parts: string[] = [];
  const seenGrades = new Set<string>();

  for (const group of gradeGroups) {
    const bound = byGrade.get(group.grade);
    if (!bound || bound.length === 0) continue;
    seenGrades.add(group.grade);
    const allBound =
      group.classes.length > 0 &&
      group.classes.every((schoolClass) => bound.some((b) => b.classId === schoolClass.id));
    if (allBound) {
      parts.push(`параллель ${group.grade}`);
    } else {
      parts.push(
        ...[...bound]
          .map((b) => b.className)
          .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true })),
      );
    }
  }

  for (const [grade, bound] of byGrade) {
    if (seenGrades.has(grade)) continue;
    parts.push(
      ...[...bound]
        .map((b) => b.className)
        .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true })),
    );
  }

  return parts.join(', ');
}

export function formatPeriodRange(
  periods: Array<{ startTime: string; endTime: string; lessonNumber: number }>,
): string {
  if (periods.length === 0) return '—';
  const sorted = [...periods].sort((a, b) => a.lessonNumber - b.lessonNumber);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const start = first.startTime.slice(0, 5);
  const end = last.endTime.slice(0, 5);
  return `${start}–${end}`;
}
