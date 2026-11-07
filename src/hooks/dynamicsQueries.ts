import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import type { DynamicsPeriod } from '@/lib/dynamicsModel';

/**
 * Динамика оценок классного руководителя — `/api/my-class/classes/{classId}/…grade-dynamics`.
 * Права и выбор прошлого периода решает сервер; ключ запроса содержит класс, ученика и
 * период, поэтому ответ одного выбора никогда не показывается под другим.
 */
export function useClassGradeDynamics(classId: number | null, period: DynamicsPeriod) {
  return useQuery({
    queryKey: ['grade-dynamics', 'class', classId, period],
    enabled: classId != null,
    queryFn: ({ signal }) => request<Schema<'ClassGradeDynamicsView'>>(
      `/my-class/classes/${classId}/grade-dynamics${pageQuery({ period })}`, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * При листании учеников в шторке прежний ответ держится, пока грузится следующий
 * (`keepPreviousData`): без этого панель на каждое нажатие ‹ › схлопывалась до спиннера и
 * раскрывалась обратно. Правило выше не нарушается — шторка подписывает такой ответ его
 * учеником (`isPlaceholderData`), а не тем, кого уже выбрали.
 */
export function useStudentGradeDynamics(classId: number | null, studentId: number | null, period: DynamicsPeriod) {
  return useQuery({
    queryKey: ['grade-dynamics', 'class', classId, 'student', studentId, period],
    enabled: classId != null && studentId != null,
    queryFn: ({ signal }) => request<Schema<'StudentGradeDynamicsView'>>(
      `/my-class/classes/${classId}/students/${studentId}/grade-dynamics${pageQuery({ period })}`, { signal }),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}

export function useStudentSubjectDynamics(
  classId: number | null,
  studentId: number | null,
  subjectId: number | null,
  period: DynamicsPeriod,
) {
  return useQuery({
    queryKey: ['grade-dynamics', 'class', classId, 'student', studentId, 'subject', subjectId, period],
    enabled: classId != null && studentId != null && subjectId != null,
    queryFn: ({ signal }) => request<Schema<'SubjectGradeDynamicsView'>>(
      `/my-class/classes/${classId}/students/${studentId}/grade-dynamics/subjects/${subjectId}${pageQuery({ period })}`,
      { signal }),
    staleTime: 0,
  });
}
