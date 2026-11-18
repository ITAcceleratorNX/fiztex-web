import { pageQuery, request } from './api';
import type { Schema } from './apiSchemas';

/**
 * «Итоговая аттестация по предметам»: настройки администрации и периоды аттестации для журнала.
 * Контракт — `fiztex-back/docs/subject-attestation-contract.md`.
 *
 * Сервер решает всё, что связано с правилами: с какого периода можно начать, что пересекается,
 * какие итоги помешают, где у класса полугодие. Клиент отправляет выбор и показывает ответ.
 */
export type AttestationSetting = Schema<'AttestationSettingView'>;
export type AttestationSettingRequest = Schema<'AttestationSettingRequest'>;
export type AttestationPreview = Schema<'AttestationPreviewView'>;
export type AttestationHistoryEvent = Schema<'AttestationHistoryView'>;
export type EffectiveFromOption = Schema<'EffectiveFromOptionView'>;
export type AttestationPeriods = Schema<'AttestationPeriodsView'>;
export type AttestationPeriodOption = Schema<'AttestationPeriodOptionView'>;
export type AttestationResultFormat = NonNullable<AttestationSettingRequest['resultFormat']>;
export type AttestationPeriodicity = NonNullable<AttestationSettingRequest['periodicity']>;

/** Коды отказов, у которых на экране своё действие. */
export const ATTESTATION_ERRORS = {
  overlap: 'ATTESTATION_SETTING_OVERLAP',
  finalsExist: 'ATTESTATION_FINALS_EXIST',
  effectiveFromInvalid: 'ATTESTATION_EFFECTIVE_FROM_INVALID',
  noFuturePeriod: 'ATTESTATION_NO_FUTURE_PERIOD',
  halfYearUnsupported: 'ATTESTATION_HALF_YEAR_UNSUPPORTED',
} as const;

export const attestationSettingsApi = {
  /** Версии года; без `subjectId` — все предметы (колонка «Аттестация» списка предметов). */
  list(academicYearId: number, subjectId?: number | null, signal?: AbortSignal): Promise<AttestationSetting[]> {
    return request(`/admin/attestation-settings${pageQuery({ academicYearId, subjectId: subjectId ?? undefined })}`, { signal });
  },
  history(academicYearId: number, subjectId: number, signal?: AbortSignal): Promise<AttestationHistoryEvent[]> {
    return request(`/admin/attestation-settings/history${pageQuery({ academicYearId, subjectId })}`, { signal });
  },
  /** Что сделает сохранение — без записи: дата вступления, варианты начала, пересечения, итоги. */
  preview(body: AttestationSettingRequest, signal?: AbortSignal): Promise<AttestationPreview> {
    return request('/admin/attestation-settings/preview', { method: 'POST', body, signal });
  },
  save(body: AttestationSettingRequest): Promise<AttestationSetting> {
    return request('/admin/attestation-settings', { method: 'POST', body });
  },
  /** Отмена ещё не вступившей версии. */
  cancel(settingId: number): Promise<void> {
    return request(`/admin/attestation-settings/${settingId}`, { method: 'DELETE' });
  },
  /** Четверти или полугодия класса по предмету — фильтр «Период» экрана итогов (учитель и администрация). */
  periods(classId: number, subjectId: number, signal?: AbortSignal): Promise<AttestationPeriods> {
    return request(`/attestation-settings/periods${pageQuery({ classId, subjectId })}`, { signal });
  },
};
