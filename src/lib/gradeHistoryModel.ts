import { GRADE_TYPE_LABELS, gradeValueLabel } from './gradesModel';
import type { GradeType, GradeHistoryEvent } from './gradesApi';

function snapshot(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as { scaleCode?: string; score?: number; maxScore?: number; gradeType?: GradeType };
}

export function gradeHistoryDescription(event: GradeHistoryEvent): string {
  const before = snapshot(event.before);
  const after = snapshot(event.after);
  const oldValue = gradeValueLabel(before) ?? '—';
  const newValue = gradeValueLabel(after) ?? '—';
  if (event.action === 'CREATE') return `Выставлена оценка ${newValue}`;
  if (event.action === 'DELETE') return `Снята оценка ${oldValue}`;
  const typeChange = before?.gradeType !== after?.gradeType
    ? ` · Вид работы: ${before?.gradeType ? GRADE_TYPE_LABELS[before.gradeType] ?? before.gradeType : 'Без типа'} → ${after?.gradeType ? GRADE_TYPE_LABELS[after.gradeType] ?? after.gradeType : 'Без типа'}`
    : '';
  return `${oldValue} → ${newValue}${typeChange}`;
}

export function gradeHistoryActor(event: GradeHistoryEvent): string {
  const name = event.actorName?.trim() || (event.actorId != null ? `Пользователь #${event.actorId}` : 'Система');
  const role = event.actorCapacity === 'SUBSTITUTE_TEACHER' ? 'Замещающий учитель'
    : event.actorCapacity === 'MAIN_TEACHER' ? 'Основной учитель'
    : event.actorRole === 'TEACHER' ? 'Учитель'
    : event.actorRole === 'ADMIN' || event.actorRole === 'SUPER_ADMIN' ? 'Администратор' : null;
  return role ? `${name} · ${role}` : name;
}

export function gradeHistoryTime(value?: string): string {
  if (!value) return 'Время не указано';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Время не указано' : date.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
