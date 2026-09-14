import type { BadgeTone } from '@/components/ui/Badge';
import type { Schema } from '@/lib/apiSchemas';

export const KEY_ACTIONS: Record<string, { label: string; tone: BadgeTone }> = {
  UNIT_CREATED: { label: 'Создан', tone: 'green' },
  UNIT_RENAMED: { label: 'Переименован', tone: 'blue' },
  ISSUED: { label: 'Выдан', tone: 'blue' },
  RETURNED: { label: 'Возвращён', tone: 'green' },
  TRANSFERRED: { label: 'Передан', tone: 'purple' },
  PROBLEM_SET: { label: 'Проблема', tone: 'red' },
  PROBLEM_CHANGED: { label: 'Проблема изменена', tone: 'amber' },
  PROBLEM_CLEARED: { label: 'Проблема снята', tone: 'green' },
  UNIT_DELETED: { label: 'Удалён', tone: 'gray' },
};

export function keyAction(action: string | undefined) {
  if (!action) return { label: 'Событие', tone: 'gray' as const };
  return KEY_ACTIONS[action] ?? { label: action, tone: 'gray' as const };
}

export function eventEmployee(event: Schema<'KeyEventView'>): string {
  const before = event.holderBefore?.fullName;
  const after = event.holderAfter?.fullName;
  if (event.action === 'TRANSFERRED' && before && after) return `${before} → ${after}`;
  if (event.action === 'RETURNED') return before ?? '—';
  return after ?? before ?? '—';
}

export function keyProblemLabel(problem: Schema<'KeyProblemView'> | undefined): string | null {
  if (!problem) return null;
  const labels: Record<string, string> = {
    LOST: 'Утерян',
    DAMAGED: 'Повреждён',
    UNAVAILABLE: 'Недоступен',
  };
  return labels[problem.type ?? ''] ?? 'Есть проблема';
}

export type KeyEventGroup = {
  key: string;
  first: Schema<'KeyEventView'>;
  events: Schema<'KeyEventView'>[];
};

/** Batch commands write an event per unit; the journal presents them as one action. */
export function collapseKeyEvents(events: Schema<'KeyEventView'>[]): KeyEventGroup[] {
  const groups = new Map<string, KeyEventGroup>();
  events.forEach((event, index) => {
    const key = event.operationId || `event-${event.id ?? index}`;
    const group = groups.get(key);
    if (group) group.events.push(event);
    else groups.set(key, { key, first: event, events: [event] });
  });
  return [...groups.values()];
}

export function eventGroupName(group: KeyEventGroup): string {
  const names = [...new Set(group.events.map((event) => event.groupName).filter(Boolean))];
  if (names.length === 0) return '—';
  return names.length === 1 ? names[0]! : `${names.length} объекта`;
}

export function eventUnitLabel(group: KeyEventGroup): string {
  if (group.events.length === 1) {
    return group.first.unitLabel ?? group.first.unitLabelBefore ?? '—';
  }
  return `${group.events.length} ключей`;
}
