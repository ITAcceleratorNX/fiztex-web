import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import type { AiReport, AiReportOwner, AiReportType } from '@/lib/aiReportModel';

/**
 * AI-отчётность (`fiztex-back/docs/ai-student-reports-contract.md`). Два адреса: учитель — свои
 * отчёты под `/teacher/ai-reports` в обеих ролях (роль — поле `owner` отчёта), администрация —
 * только чтение утверждённого под `/admin/ai-reports`.
 */
export type AiReportReader = 'teacher' | 'admin';

const base = (reader: AiReportReader) => (reader === 'admin' ? '/admin/ai-reports' : '/teacher/ai-reports');

export interface AiReportListFilter {
  academicYearId?: number | null;
  owner?: AiReportOwner | null;
  type?: AiReportType | null;
  classId?: number | null;
  subjectId?: number | null;
  studentProfileId?: number | null;
  authorTeacherProfileId?: number | null;
  from?: string | null;
  to?: string | null;
  state?: string | null;
  page?: number;
  size?: number;
}

const clean = (filter: AiReportListFilter) =>
  Object.fromEntries(Object.entries(filter).filter(([, value]) => value != null && value !== '')) as Record<string, string | number>;

export function useAiReportContext(academicYearId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['ai-reports', 'context', academicYearId],
    enabled,
    queryFn: ({ signal }) => request<Schema<'AiReportContextView'>>(
      `/teacher/ai-reports/context${pageQuery({ academicYearId: academicYearId ?? undefined })}`, { signal }),
    staleTime: 60_000,
  });
}

/** Ученики класса, по которым можно сформировать отчёт в этой роли. */
export function useAiReportStudents(owner: AiReportOwner | null, academicYearId: number | null, classId: number | null,
  subjectId: number | null) {
  return useQuery({
    queryKey: ['ai-reports', 'students', owner, academicYearId, classId, subjectId],
    enabled: owner != null && academicYearId != null && classId != null && (owner === 'HOMEROOM' || subjectId != null),
    queryFn: ({ signal }) => request<Schema<'AiReportContextStudent'>[]>(`/teacher/ai-reports/context/students${pageQuery({
      owner: owner!, academicYearId: academicYearId!, classId: classId!,
      subjectId: owner === 'HOMEROOM' ? undefined : subjectId ?? undefined,
    })}`, { signal }),
    staleTime: 60_000,
  });
}

export function useAiReports(reader: AiReportReader, filter: AiReportListFilter | null) {
  return useQuery({
    queryKey: ['ai-reports', reader, 'list', filter],
    enabled: filter != null,
    queryFn: ({ signal }) => request<Schema<'AiReportPage'>>(`${base(reader)}${pageQuery(clean(filter!))}`, { signal }),
    staleTime: 0,
    // Строка «Формируется» сама становится черновиком: задача идёт на сервере.
    refetchInterval: (query) => (query.state.data?.items ?? []).some((item) => item.state === 'GENERATING') ? 5_000 : false,
  });
}

export function useAiReport(reader: AiReportReader, reportId: number | null) {
  return useQuery({
    queryKey: ['ai-reports', reader, 'detail', reportId],
    enabled: reportId != null,
    queryFn: ({ signal }) => request<AiReport>(`${base(reader)}/${reportId}`, { signal }),
    staleTime: 0,
    retry: (count, error) => count < 2 && !isClientError(error),
  });
}

export function useAiReportVersion(reader: AiReportReader, reportId: number | null, versionId: number | null) {
  return useQuery({
    queryKey: ['ai-reports', reader, 'version', reportId, versionId],
    enabled: reportId != null && versionId != null,
    queryFn: ({ signal }) => request<Schema<'AiReportVersionView'>>(`${base(reader)}/${reportId}/versions/${versionId}`, { signal }),
    staleTime: 60_000,
  });
}

export function useAiReportHistory(reader: AiReportReader, reportId: number | null) {
  return useQuery({
    queryKey: ['ai-reports', reader, 'history', reportId],
    enabled: reportId != null,
    queryFn: ({ signal }) => request<Schema<'AiReportEventView'>[]>(`${base(reader)}/${reportId}/history`, { signal }),
    staleTime: 0,
  });
}

/**
 * Ход задачи генерации: опрос, пока она идёт. Время не обещаем (ТЗ §4) — шторку можно
 * закрыть, задача доживёт на сервере, а результат найдётся в истории.
 */
export function useAiReportJob(jobId: number | null) {
  return useQuery({
    queryKey: ['ai-reports', 'job', jobId],
    enabled: jobId != null,
    queryFn: ({ signal }) => request<Schema<'AiReportJobView'>>(`/teacher/ai-reports/generations/${jobId}`, { signal }),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'DONE' || status === 'FAILED' ? false : 2_500;
    },
    staleTime: 0,
  });
}

function isClientError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status != null && status >= 400 && status < 500;
}

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Команды отчёта. Каждая отвечает карточкой целиком — она и кладётся в кэш. */
export function useAiReportCommands(reportId: number | null) {
  const client = useQueryClient();
  const store = (detail: AiReport) => {
    client.setQueryData(['ai-reports', 'teacher', 'detail', detail.report?.id], detail);
    void client.invalidateQueries({ queryKey: ['ai-reports', 'teacher', 'list'] });
    void client.invalidateQueries({ queryKey: ['ai-reports', 'teacher', 'history', detail.report?.id] });
  };
  const path = `/teacher/ai-reports/${reportId}`;

  const saveText = useMutation({
    mutationFn: (body: Schema<'AiReportSaveTextRequest'>) => request<AiReport>(`${path}/text`, { method: 'PUT', body }),
    onSuccess: store,
  });
  const approve = useMutation({
    mutationFn: ({ versionId, revision }: { versionId: number; revision: number }) =>
      request<AiReport>(`${path}/versions/${versionId}/approve`, { method: 'POST', body: { revision } }),
    onSuccess: store,
  });
  const saveParent = useMutation({
    mutationFn: (body: Schema<'AiReportParentSummaryRequest'>) =>
      request<AiReport>(`${path}/parent-summary`, { method: 'PUT', body }),
    onSuccess: store,
  });
  const confirmParent = useMutation({
    mutationFn: (body: Schema<'AiReportConfirmParentSummaryRequest'>) =>
      request<AiReport>(`${path}/parent-summary/confirm`, { method: 'POST', body }),
    onSuccess: store,
  });
  const publish = useMutation({
    mutationFn: (parentSummaryId: number) =>
      request<AiReport>(`${path}/publication`, { method: 'POST', body: { parentSummaryId } }),
    onSuccess: store,
  });
  const unpublish = useMutation({
    mutationFn: () => request<AiReport>(`${path}/publication`, { method: 'DELETE' }),
    onSuccess: store,
  });
  const regenerate = useMutation({
    mutationFn: () => request<Schema<'AiReportJobView'>>(`${path}/generations`, {
      method: 'POST', headers: { 'Idempotency-Key': newKey() },
    }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['ai-reports', 'teacher', 'detail', reportId] });
      void client.invalidateQueries({ queryKey: ['ai-reports', 'teacher', 'list'] });
    },
  });
  return { saveText, approve, saveParent, confirmParent, publish, unpublish, regenerate };
}

/**
 * «Сформировать». Ключ идемпотентности живёт столько же, сколько форма с теми же полями:
 * повтор после обрыва сети вернёт ту же задачу, а не создаст вторую платную генерацию.
 */
export function useCreateAiReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: Schema<'AiReportCreateReportRequest'>; key: string }) =>
      request<Schema<'AiReportJobView'>>('/teacher/ai-reports', {
        method: 'POST', body, headers: { 'Idempotency-Key': key },
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['ai-reports', 'teacher', 'list'] }),
  });
}

export { newKey as newIdempotencyKey };
