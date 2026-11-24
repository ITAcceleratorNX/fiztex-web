import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keys } from '@/hooks/queries';
import { request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import type { AbsenceDayGroup, AbsenceReasonCode } from '@/lib/absenceReasonModel';

type Day = Schema<'AbsenceDayDetailView'>;
type Page = Schema<'AbsenceDayPageView'>;

/**
 * Причины отсутствий в «Моём классе» (ABSENCE-REASON-001, контракт
 * `fiztex-back/docs/absence-reasons-contract.md`). Права, состояния и счётчики считает сервер;
 * команды присылают версию дня, которую видел классный руководитель, — решение не ложится поверх
 * ответа родителя, пришедшего тем временем.
 */

export interface AbsenceListFilters {
  periodId: number | null;
  studentProfileId: number | null;
  group: AbsenceDayGroup | 'ALL';
  page: number;
}

const PAGE_SIZE = 20;

export function useMyClassAbsenceDays(classId: number | null, filters: AbsenceListFilters) {
  const params = {
    periodId: filters.periodId,
    studentProfileId: filters.studentProfileId,
    group: filters.group === 'ALL' ? null : filters.group,
    page: filters.page,
  };
  return useQuery({
    queryKey: classId == null || filters.periodId == null
      ? ['my-class', 'absence-days', 'none']
      : keys.myClassAbsenceList(classId, params),
    enabled: classId != null && filters.periodId != null,
    queryFn: ({ signal }) => request<Page>(`/my-class/classes/${classId}/absence-days${query({
      ...params, size: PAGE_SIZE,
    })}`, { signal }),
    // Листание и смена фильтра не должны мигать пустым списком: прежняя страница держится, пока
    // грузится новая.
    placeholderData: (previous) => previous,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * Число дней «Требуют действия» за период — бейдж на переключателе «Причины отсутствий» (К1).
 * Тот же список с одной строкой: сервер отдаёт счётчики групп при любой странице.
 */
export function useMyClassAbsenceCounts(classId: number | null, periodId: number | null) {
  return useQuery({
    queryKey: classId == null || periodId == null
      ? ['my-class', 'absence-days', 'counts', 'none']
      : keys.myClassAbsenceList(classId, { periodId, counts: 1 }),
    enabled: classId != null && periodId != null,
    queryFn: ({ signal }) => request<Page>(
      `/my-class/classes/${classId}/absence-days${query({ periodId, size: 1 })}`, { signal },
    ),
    select: (page) => page.counts,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Весь состав класса — варианты фильтра «Ученик». Список короткий, страницы склеиваются. */
export function useMyClassStudentOptions(classId: number | null) {
  return useQuery({
    queryKey: classId == null ? ['my-class', 'students', 'all', 'none'] : [...keys.myClassRoster(classId), 'all'],
    enabled: classId != null,
    queryFn: async ({ signal }) => {
      const items: Array<Schema<'MyClassStudentView'>> = [];
      for (let page = 0; ; page++) {
        const result = await request<Schema<'MyClassRosterView'>>(
          `/my-class/classes/${classId}/students?page=${page}&size=100`, { signal },
        );
        items.push(...(result.items ?? []));
        if (!result.hasMore) return items;
      }
    },
    staleTime: 60_000,
  });
}

export function useMyClassAbsenceDay(classId: number | null, studentProfileId: number | null, date: string | null) {
  return useQuery({
    queryKey: classId == null || studentProfileId == null || date == null
      ? ['my-class', 'absence-days', 'day', 'none']
      : keys.myClassAbsenceDay(classId, studentProfileId, date),
    enabled: classId != null && studentProfileId != null && date != null,
    queryFn: ({ signal }) => request<Day>(
      `/my-class/classes/${classId}/students/${studentProfileId}/absence-days/${date}`, { signal },
    ),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export type AbsenceDayCommand =
  | { kind: 'ask'; message?: string }
  | { kind: 'set'; reason: AbsenceReasonCode; comment?: string }
  | { kind: 'confirm'; responseId: number }
  | { kind: 'reject'; responseId: number; comment?: string };

/**
 * Команды по дню. Ответ — день целиком с новой версией: он кладётся в кэш напрямую, а список,
 * его счётчики и листы пропущенных уроков (там причина видна предметнику) перечитываются.
 */
export function useAbsenceDayCommand(classId: number, studentProfileId: number, date: string) {
  const client = useQueryClient();
  const root = `/my-class/classes/${classId}/students/${studentProfileId}/absence-days/${date}`;
  return useMutation({
    mutationFn: ({ command, version }: { command: AbsenceDayCommand; version: number | null }) => {
      const expectedVersion = version ?? undefined;
      switch (command.kind) {
        case 'ask':
          return request<Day>(`${root}/requests`, { method: 'POST', body: { expectedVersion, message: command.message } });
        case 'set':
          return request<Day>(`${root}/reason`, {
            method: 'PUT', body: { expectedVersion, reason: command.reason, comment: command.comment },
          });
        case 'confirm':
          return request<Day>(`${root}/responses/${command.responseId}/confirm`, {
            method: 'POST', body: { expectedVersion },
          });
        case 'reject':
          return request<Day>(`${root}/responses/${command.responseId}/reject`, {
            method: 'POST', body: { expectedVersion, comment: command.comment },
          });
      }
    },
    onSuccess: (day) => {
      client.setQueryData(keys.myClassAbsenceDay(classId, studentProfileId, date), day);
      void client.invalidateQueries({ queryKey: keys.myClassAbsenceDays(classId), refetchType: 'active' });
      for (const lesson of day.absentLessons ?? []) {
        if (lesson.lessonId == null) continue;
        void client.invalidateQueries({ queryKey: keys.attendanceSheet(lesson.lessonId) });
      }
    },
  });
}

/** История урока: как менялась причина дня у тех, кто на нём отсутствовал (макет П3). */
export function useAttendanceDayReasonHistory(lessonId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.attendanceDayReasonHistory(lessonId ?? 0),
    queryFn: ({ signal }) => request<Array<Schema<'AttendanceDayReasonEventView'>>>(
      `/lessons/${lessonId}/attendance/day-reason-history`, { signal },
    ),
    enabled: lessonId != null && enabled,
  });
}

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value != null && value !== '') search.set(name, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
