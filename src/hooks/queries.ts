import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ApplicantRequest,
  SubjectRequest,
  TestRequest,
} from '@/lib/types';

export const keys = {
  subjects: ['subjects'] as const,
  tests: ['tests'] as const,
  test: (id: number) => ['tests', id] as const,
  applicants: ['applicants'] as const,
  reviews: ['reviews'] as const,
};

// ---- Subjects ----
export function useSubjects() {
  return useQuery({ queryKey: keys.subjects, queryFn: ({ signal }) => api.listSubjects(signal) });
}

export function useCreateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubjectRequest) => api.createSubject(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.subjects }),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SubjectRequest }) => api.updateSubject(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.subjects });
      qc.invalidateQueries({ queryKey: keys.tests });
    },
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteSubject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.subjects }),
  });
}

// ---- Tests ----
export function useTests() {
  return useQuery({ queryKey: keys.tests, queryFn: ({ signal }) => api.listTests(signal) });
}

export function useTest(id: number | null) {
  return useQuery({
    queryKey: id ? keys.test(id) : ['tests', 'none'],
    queryFn: ({ signal }) => api.getTest(id as number, signal),
    enabled: id != null,
  });
}

export function useCreateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TestRequest) => api.createTest(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tests });
      qc.invalidateQueries({ queryKey: keys.subjects });
    },
  });
}

export function useUpdateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: TestRequest }) => api.updateTest(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.tests });
      qc.invalidateQueries({ queryKey: keys.test(vars.id) });
    },
  });
}

export function useDeleteTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteTest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tests });
      qc.invalidateQueries({ queryKey: keys.subjects });
    },
  });
}

export function useAssignTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicantIds }: { id: number; applicantIds: number[] }) =>
      api.assignTest(id, applicantIds),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.tests });
      qc.invalidateQueries({ queryKey: keys.test(vars.id) });
      qc.invalidateQueries({ queryKey: keys.applicants });
    },
  });
}

// ---- Review (проверка ответов) ----
export function useReviews() {
  return useQuery({ queryKey: keys.reviews, queryFn: ({ signal }) => api.listReviews(signal) });
}

// ---- Applicants ----
export function useApplicants() {
  return useQuery({ queryKey: keys.applicants, queryFn: ({ signal }) => api.listApplicants(signal) });
}

export function useCreateApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApplicantRequest) => api.createApplicant(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.applicants }),
  });
}

export function useUpdateApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ApplicantRequest }) => api.updateApplicant(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.applicants }),
  });
}
