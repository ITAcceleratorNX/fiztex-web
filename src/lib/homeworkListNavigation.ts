import { SCOPE_STATUSES, type HomeworkScope, type HomeworkStatus } from './homeworkApi';

export interface HomeworkFilterValues {
  classId?: number;
  subjectId?: number;
  status?: HomeworkStatus;
  dueFrom?: string;
  dueTo?: string;
  pendingReviewOnly: boolean;
}

export interface HomeworkListState {
  scope: HomeworkScope;
  filters: HomeworkFilterValues;
  /** Номер страницы API, начиная с нуля. В URL — с единицы. */
  page: number;
}

function positiveInteger(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function date(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value : undefined;
}

export function readHomeworkListState(params: URLSearchParams): HomeworkListState {
  const scope = params.get('scope') === 'HISTORY' ? 'HISTORY' : 'ACTUAL';
  const status = params.get('status') as HomeworkStatus | null;
  return {
    scope,
    page: Math.min(positiveInteger(params.get('page')) ?? 1, 2_147_483_647) - 1,
    filters: {
      classId: positiveInteger(params.get('classId')),
      subjectId: positiveInteger(params.get('subjectId')),
      status: status && SCOPE_STATUSES[scope].includes(status) ? status : undefined,
      dueFrom: date(params.get('dueFrom')),
      dueTo: date(params.get('dueTo')),
      pendingReviewOnly: params.get('pendingReviewOnly') === 'true',
    },
  };
}

export function writeHomeworkListState(state: HomeworkListState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.scope !== 'ACTUAL') params.set('scope', state.scope);
  if (state.page > 0) params.set('page', String(state.page + 1));
  for (const [key, value] of Object.entries(state.filters)) {
    if (value != null && value !== false && value !== '') params.set(key, String(value));
  }
  return params;
}

/** Возврат только в список ДЗ, без внешних адресов и произвольных параметров. */
export function homeworkListReturnTo(search: string): string {
  const target = new URLSearchParams(search).get('returnTo');
  if (!target || (target !== '/homework' && !target.startsWith('/homework?'))) return '/homework';
  const query = writeHomeworkListState(readHomeworkListState(new URLSearchParams(target.split('?')[1])));
  return `/homework${query.size ? `?${query}` : ''}`;
}
