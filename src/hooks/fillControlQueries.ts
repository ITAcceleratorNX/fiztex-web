import { useQuery } from '@tanstack/react-query';
import { fillControlApi, type FillControlQuery } from '@/lib/fillControlApi';

export const fillControlKeys = {
  all: ['fill-control'] as const,
  lessons: (query: FillControlQuery) => [...fillControlKeys.all, 'lessons', query] as const,
  summary: (query: FillControlQuery) => [...fillControlKeys.all, 'summary', query] as const,
  filters: (yearId: number | null, classId: number | null) =>
    [...fillControlKeys.all, 'filters', yearId, classId] as const,
};

export function useFillControlLessons(query: FillControlQuery) {
  return useQuery({
    queryKey: fillControlKeys.lessons(query),
    queryFn: ({ signal }) => fillControlApi.lessons(query, signal),
    placeholderData: (previous) => previous,
    // Список обязан отражать только что сохранённый урок, поэтому кэшу не доверяем.
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useFillControlSummary(query: FillControlQuery) {
  return useQuery({
    queryKey: fillControlKeys.summary(query),
    queryFn: ({ signal }) => fillControlApi.summary(query, signal),
    placeholderData: (previous) => previous,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** `classId` сужает предметы и учителей до класса: фильтр не предлагает то, чего в нём нет. */
export function useFillControlFilters(yearId: number | null, classId: number | null = null) {
  return useQuery({
    queryKey: fillControlKeys.filters(yearId, classId),
    queryFn: ({ signal }) => fillControlApi.filters(yearId, classId, signal),
  });
}
