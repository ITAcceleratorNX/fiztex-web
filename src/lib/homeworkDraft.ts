import type { AnswerFormat, DueType, Homework, HomeworkGroup, RecipientType } from './homeworkApi';
import type { WorkspaceSearchItem } from './teacherWorkspaceApi';
import { withHomeworkReturnTo } from './homeworkListNavigation';

export interface HomeworkFormValues {
  title: string;
  description: string;
  dueType: DueType;
  dueAt: string;
  answerFormat: AnswerFormat;
  antiCheatEnabled: boolean;
  recipientType: RecipientType;
  tempGroupId?: number;
  subjectId?: number;
  classId?: number;
  pickedLessonId?: number;
  lessonChoiceMade: boolean;
  files: File[];
  workspaceItems: Pick<WorkspaceSearchItem, 'id' | 'title'>[];
}

export interface GroupSnapshot {
  id: number;
  name: string;
  count: number;
  students: { id: number; name: string }[];
}

export interface HomeworkFormDraft {
  values: HomeworkFormValues;
  baseline: HomeworkFormValues;
  initialized: boolean;
  group: GroupSnapshot | null;
  notice: string | null;
  error: string | null;
  createdId: number | null;
  saving: boolean;
}

export function emptyHomeworkValues(): HomeworkFormValues {
  return { title: '', description: '', dueType: 'EXACT', dueAt: '', answerFormat: 'WRITTEN',
    antiCheatEnabled: false, recipientType: 'CLASS', lessonChoiceMade: false, files: [], workspaceItems: [] };
}

export function homeworkValues(existing: Homework): HomeworkFormValues {
  return { ...emptyHomeworkValues(), title: existing.title ?? '', description: existing.description ?? '',
    dueType: existing.dueType ?? 'EXACT', dueAt: existing.dueAt ? toLocalInput(existing.dueAt) : '',
    answerFormat: existing.answerFormat ?? 'WRITTEN', antiCheatEnabled: existing.antiCheatEnabled ?? false,
    recipientType: existing.recipients?.type ?? 'CLASS', tempGroupId: existing.recipients?.tempGroupId };
}

export function hasHomeworkChanges(draft: HomeworkFormDraft): boolean {
  return draft.saving || draft.createdId != null || draft.values.files.length > 0
    || JSON.stringify(draft.values) !== JSON.stringify(draft.baseline);
}

export function groupSnapshot(group: HomeworkGroup): GroupSnapshot {
  return { id: group.id!, name: group.name ?? 'Без названия', count: group.studentCount ?? group.students?.length ?? 0,
    students: (group.students ?? []).filter((s) => s.studentProfileId != null && s.active !== false)
      .map((s) => ({ id: s.studentProfileId!, name: s.fullName ?? `Ученик №${s.studentProfileId}` }))
      .sort((a, b) => a.id - b.id) };
}

export function describeGroupChange(previous: GroupSnapshot, next: GroupSnapshot): string | null {
  const added = next.students.filter((s) => !previous.students.some((old) => old.id === s.id));
  const removed = previous.students.filter((s) => !next.students.some((current) => current.id === s.id));
  const changes = [
    previous.name !== next.name ? `Группа «${previous.name}» переименована в «${next.name}».` : '',
    added.length ? `Добавлены: ${added.map((s) => s.name).join(', ')}.` : '',
    removed.length ? `Исключены: ${removed.map((s) => s.name).join(', ')}.` : '',
    previous.count !== next.count ? `Получателей: ${previous.count} → ${next.count}.` : '',
  ].filter(Boolean);
  return changes.length ? `Изменились получатели группы «${next.name}». ${changes.join(' ')} Проверьте выбор перед сохранением.` : null;
}

/** Only the two homework form routes may be used by the dependent groups page. */
export function homeworkFormReturnTo(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  try {
    const url = new URL(raw, 'https://fiztex.invalid');
    if (url.origin !== 'https://fiztex.invalid') return null;
    if (/^\/homework\/[1-9]\d*\/edit$/.test(url.pathname)) {
      return withHomeworkReturnTo(url.pathname, url.search);
    }
    if (url.pathname !== '/homework/new') return null;
    const lessonValue = url.searchParams.get('lessonId');
    if (lessonValue != null) {
      const lessonId = positiveInteger(lessonValue);
      return lessonId != null ? `/homework/new?lessonId=${lessonId}` : '/homework/new';
    }
    const context = new URLSearchParams();
    const classId = positiveInteger(url.searchParams.get('classId'));
    const subjectId = positiveInteger(url.searchParams.get('subjectId'));
    if (classId != null) context.set('classId', String(classId));
    if (subjectId != null) context.set('subjectId', String(subjectId));
    return `/homework/new${context.size ? `?${context}` : ''}`;
  } catch { return null; }
}

function positiveInteger(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
