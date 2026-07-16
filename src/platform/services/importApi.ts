import { pageQuery, request, requestMultipart } from '@/lib/api';
import type { Page } from '@/lib/types';
import type {
  ImportDuplicateStrategy,
  ImportRun,
  ImportRunDetail,
  ImportRunError,
  ImportRunStatus,
  ImportType,
  ImportTypeInfo,
} from '../types';

interface ImportTypeDto {
  type: ImportType;
  label: string;
  fields: { key: string; label: string; required: boolean }[];
}

interface ImportRunDto {
  id: number;
  importType: ImportType;
  importTypeLabel: string;
  status: ImportRunStatus;
  fileName: string;
  uploadedBy: { id: number; fullName: string; email: string | null } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  totalRows: number | null;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
}

interface ImportRunDetailDto extends ImportRunDto {
  columnNames: string[];
  mapping: Record<string, string> | null;
  duplicateStrategy: ImportDuplicateStrategy | null;
  errorMessage: string | null;
  updatedAt: string | null;
}

interface ImportRunErrorDto {
  rowNumber: number;
  field: string | null;
  errorCode: string;
  message: string;
  rawRow: string | null;
}

interface ImportRunAcceptedDto {
  id: number;
  status: ImportRunStatus;
}

function mapRun(dto: ImportRunDto): ImportRun {
  return { ...dto };
}

function mapDetail(dto: ImportRunDetailDto): ImportRunDetail {
  return {
    ...mapRun(dto),
    columnNames: dto.columnNames ?? [],
    mapping: dto.mapping,
    duplicateStrategy: dto.duplicateStrategy,
    errorMessage: dto.errorMessage,
    updatedAt: dto.updatedAt,
  };
}

export async function listImportTypes(): Promise<ImportTypeInfo[]> {
  const list = await request<ImportTypeDto[]>('/admin/import/types');
  return list.map((t) => ({
    type: t.type,
    label: t.label,
    fields: t.fields ?? [],
  }));
}

export async function listImportRuns(params: {
  type?: ImportType;
  status?: ImportRunStatus;
} = {}): Promise<ImportRun[]> {
  const page = await request<Page<ImportRunDto>>(
    `/admin/import/runs${pageQuery({
      type: params.type,
      status: params.status,
      page: 0,
      size: 20,
    })}`,
  );
  return page.content.map(mapRun);
}

export async function uploadImportRun(
  importType: ImportType,
  file: File,
): Promise<{ id: number; status: ImportRunStatus }> {
  const form = new FormData();
  form.append('importType', importType);
  form.append('file', file);
  const res = await requestMultipart<ImportRunAcceptedDto>('/admin/import/runs', form);
  return { id: res.id, status: res.status };
}

export async function getImportRun(id: number): Promise<ImportRunDetail> {
  const dto = await request<ImportRunDetailDto>(`/admin/import/runs/${id}`);
  return mapDetail(dto);
}

export async function listImportErrors(id: number): Promise<ImportRunError[]> {
  const page = await request<Page<ImportRunErrorDto>>(
    `/admin/import/runs/${id}/errors${pageQuery({ page: 0, size: 100 })}`,
  );
  return page.content.map((e) => ({ ...e }));
}

export async function commitImportRun(
  id: number,
  mapping: Record<string, string>,
  duplicateStrategy: ImportDuplicateStrategy,
): Promise<{ id: number; status: ImportRunStatus }> {
  const res = await request<ImportRunAcceptedDto>(`/admin/import/runs/${id}/commit`, {
    method: 'POST',
    body: { mapping, duplicateStrategy },
  });
  return { id: res.id, status: res.status };
}

const TERMINAL: ImportRunStatus[] = [
  'PREVIEW_READY',
  'ANALYSIS_FAILED',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
];

export function isImportTerminal(status: ImportRunStatus): boolean {
  return TERMINAL.includes(status);
}

export function isImportAnalyzing(status: ImportRunStatus): boolean {
  return status === 'UPLOADED' || status === 'ANALYZING';
}

export function isImportProcessing(status: ImportRunStatus): boolean {
  return status === 'QUEUED' || status === 'RUNNING';
}

export async function pollImportRun(
  id: number,
  until: (run: ImportRunDetail) => boolean,
  opts: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<ImportRunDetail> {
  const intervalMs = opts.intervalMs ?? 1000;
  const maxAttempts = opts.maxAttempts ?? 60;
  let last = await getImportRun(id);
  for (let i = 0; i < maxAttempts; i++) {
    if (until(last)) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
    last = await getImportRun(id);
  }
  return last;
}
