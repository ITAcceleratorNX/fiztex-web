import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { psychTestsApi, type AssignPsychTestRequest } from '@/lib/psychTestsApi';

/**
 * React Query хуки назначения психотестов — отдельным файлом по той же причине, что и
 * `surveyQueries.ts`: раздел цельный и общих ключей с остальным приложением у него нет.
 */
export const psychTestKeys = {
  classes: ['psych-tests', 'classes'] as const,
  assignments: (testId: number) => ['psych-tests', testId, 'assignments'] as const,
  results: (assignmentId: number, classId?: number) =>
    ['psych-tests', 'results', assignmentId, classId ?? 'ALL'] as const,
};

export function usePsychTestClasses(enabled: boolean) {
  return useQuery({
    queryKey: psychTestKeys.classes,
    queryFn: ({ signal }) => psychTestsApi.classes(signal),
    enabled,
  });
}

export function usePsychTestAssignments(testId: number | null) {
  return useQuery({
    queryKey: psychTestKeys.assignments(testId ?? 0),
    queryFn: ({ signal }) => psychTestsApi.assignments(testId as number, signal),
    enabled: testId != null,
  });
}

export function useAssignPsychTest(testId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignPsychTestRequest) => psychTestsApi.assign(testId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: psychTestKeys.assignments(testId) });
    },
  });
}

/**
 * Закрытие приёма меняет и строку назначения, и шапку результатов — перечитываются оба
 * списка, а не досчитывается ответ на месте.
 */
export function useClosePsychTestAssignment(testId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: number) => psychTestsApi.close(assignmentId),
    onSuccess: (_data, assignmentId) => {
      qc.invalidateQueries({ queryKey: psychTestKeys.assignments(testId) });
      qc.invalidateQueries({ queryKey: ['psych-tests', 'results', assignmentId] });
    },
  });
}

export function usePsychTestResults(assignmentId: number | null, classId?: number) {
  return useQuery({
    queryKey: psychTestKeys.results(assignmentId ?? 0, classId),
    queryFn: ({ signal }) => psychTestsApi.results(assignmentId as number, classId, signal),
    enabled: assignmentId != null,
  });
}
