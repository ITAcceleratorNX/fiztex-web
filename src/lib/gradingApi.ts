import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type GradingPolicy = Schema<'GradingPolicyView'>;
export type GradingPolicyContent = Schema<'GradingPolicyContentRequest'>;
export type GradingPolicyTemplate = Schema<'GradingPolicyTemplateView'>;
export type GradingPolicyHistoryEntry = Schema<'GradingPolicyHistoryView'>;
export type ActiveGradingPolicy = Schema<'ActiveGradingPolicyView'>;
export type PolicyComponent = Schema<'PolicyComponentDto'>;
export type PolicyWorkType = Schema<'PolicyWorkTypeDto'>;
export type PolicyBand = Schema<'PolicyBandDto'>;
export type PolicySummary = Schema<'PolicySummaryView'>;
export type PeriodResult = Schema<'PeriodResultSummaryView'>;
export type ComponentSummary = Schema<'ComponentSummaryView'>;
export type PeriodBreakdown = Schema<'PeriodBreakdownView'>;
export type BreakdownWork = Schema<'WorkView'>;

export type AssessmentComponent = NonNullable<PolicyComponent['code']>;
export type WorkScoring = NonNullable<PolicyWorkType['scoring']>;
export type TemplateCode = NonNullable<GradingPolicyTemplate['code']>;

/** Отказы политики, на которые у экрана есть свой ответ (grading-policy-contract §3). */
export const GRADING_POLICY_ERRORS = {
  invalid: 'GRADING_POLICY_INVALID',
  notDraft: 'GRADING_POLICY_NOT_DRAFT',
  gradesOutsideScope: 'GRADING_POLICY_GRADES_OUTSIDE_SCOPE',
} as const;

/**
 * Политика оценивания (GRADES-003): веса ФО/СОР/СОЧ, типы работ, пороги «процент → оценка».
 *
 * <p>Правит администратор (`/api/admin/grading-policies`), читают все — действующая
 * политика отдаётся вне `/api/admin`, потому что админский адрес под учительским токеном
 * отвечает 401 и разлогинивает.
 */
export const gradingPolicyApi = {
  active(academicYearId: number, signal?: AbortSignal): Promise<ActiveGradingPolicy> {
    return request<ActiveGradingPolicy>(`/grading/policy${pageQuery({ academicYearId })}`, { signal });
  },

  list(academicYearId: number, signal?: AbortSignal): Promise<GradingPolicy[]> {
    return request<GradingPolicy[]>(`/admin/grading-policies${pageQuery({ academicYearId })}`, { signal });
  },

  templates(signal?: AbortSignal): Promise<GradingPolicyTemplate[]> {
    return request<GradingPolicyTemplate[]>('/admin/grading-policies/templates', { signal });
  },

  /** Ровно один источник: шаблон из источников или копия существующей версии. */
  create(body: {
    academicYearId: number;
    template?: TemplateCode;
    copyFromPolicyId?: number;
    name?: string;
  }): Promise<GradingPolicy> {
    return request<GradingPolicy>('/admin/grading-policies', { method: 'POST', body });
  },

  /** Содержимое черновика целиком; `expectedVersion` ловит чужую правку (409). */
  update(policyId: number, body: GradingPolicyContent): Promise<GradingPolicy> {
    return request<GradingPolicy>(`/admin/grading-policies/${policyId}`, { method: 'PUT', body });
  },

  remove(policyId: number): Promise<void> {
    return request<void>(`/admin/grading-policies/${policyId}`, { method: 'DELETE' });
  },

  activate(policyId: number): Promise<GradingPolicy> {
    return request<GradingPolicy>(`/admin/grading-policies/${policyId}/activate`, { method: 'POST' });
  },

  history(policyId: number, signal?: AbortSignal): Promise<GradingPolicyHistoryEntry[]> {
    return request<GradingPolicyHistoryEntry[]>(`/admin/grading-policies/${policyId}/history`, { signal });
  },
};

/**
 * Расшифровка процента периода (grading-policy-contract §6): работы, формула с числами,
 * порог и итог учителя. Формула приходит строкой — собирать её на клиенте не нужно.
 */
export const breakdownApi = {
  forStudent(
    query: { studentProfileId: number; subjectId: number; academicPeriodId: number },
    signal?: AbortSignal,
  ): Promise<PeriodBreakdown> {
    return request<PeriodBreakdown>(
      `/final-grades/students/${query.studentProfileId}/breakdown${pageQuery({
        subjectId: query.subjectId,
        academicPeriodId: query.academicPeriodId,
      })}`,
      { signal },
    );
  },
};
