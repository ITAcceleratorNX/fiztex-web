import { useQuery } from '@tanstack/react-query';
import {
  attendanceAdminApi,
  type AdminJournalFilters,
  type UnfilledLessonFilters,
} from '@/lib/attendanceAdminApi';

export const attendanceAdminKeys = {
  all: ['attendance-admin'] as const,
  journal: (filters: AdminJournalFilters) => [...attendanceAdminKeys.all, 'journal', filters] as const,
  unfilled: (filters: UnfilledLessonFilters) =>
    [...attendanceAdminKeys.all, 'unfilled', filters] as const,
};

/**
 * Журнал школы за месяц. Без класса запрос не уходит — таблицы «ученики × уроки»
 * без него не существует, и спрашивать её значит получить понятный отказ вместо данных.
 */
export function useAdminAttendanceJournal(filters: AdminJournalFilters | null) {
  return useQuery({
    queryKey: attendanceAdminKeys.journal(filters ?? { classId: 0 }),
    queryFn: ({ signal }) => attendanceAdminApi.journal(filters!, signal),
    enabled: filters != null && filters.classId > 0,
    // Фильтры переключают часто, а таблица тяжёлая: пусть предыдущая остаётся
    // на экране, пока едет следующая.
    placeholderData: (previous) => previous,
  });
}

export function useUnfilledLessons(filters: UnfilledLessonFilters) {
  return useQuery({
    queryKey: attendanceAdminKeys.unfilled(filters),
    queryFn: ({ signal }) => attendanceAdminApi.unfilled(filters, signal),
    placeholderData: (previous) => previous,
  });
}
