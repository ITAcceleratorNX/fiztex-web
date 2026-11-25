import { request, requestBlob, uploadMultipart } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

/**
 * Достижения учителя — раздел «Достижения» рабочего пространства.
 * Контракт — `fiztex-back/docs/teacher-achievements-contract.md`.
 */
export type TeacherAchievement = Schema<'TeacherAchievementView'>;
export type AchievementClass = Schema<'AchievementClassView'>;
export type AchievementAudienceOptions = Schema<'AchievementAudienceOptionsView'>;
export type AchievementCategory = NonNullable<TeacherAchievement['category']>;
export type AchievementVisibility = NonNullable<TeacherAchievement['visibility']>;
export type UpdateAchievementRequest = Schema<'UpdateTeacherAchievementRequest'>;
export type UpdateVisibilityRequest = Schema<'UpdateAchievementVisibilityRequest'>;

export const ACHIEVEMENT_ERRORS = {
  notFound: 'ACHIEVEMENT_NOT_FOUND',
  classNotAllowed: 'ACHIEVEMENT_CLASS_NOT_ALLOWED',
  audienceRequired: 'ACHIEVEMENT_AUDIENCE_REQUIRED',
} as const;

const BASE = '/teacher/achievements';

export type UploadProgress = (fraction: number) => void;

export const achievementsApi = {
  list: (signal?: AbortSignal) => request<TeacherAchievement[]>(BASE, { signal }),
  audienceOptions: (signal?: AbortSignal) =>
    request<AchievementAudienceOptions>(`${BASE}/audience-options`, { signal }),
  create: (file: File, fields: UpdateAchievementRequest, onProgress?: UploadProgress) => {
    const form = new FormData();
    form.append('file', file);
    for (const [key, value] of Object.entries(fields)) {
      if (value != null && value !== '') form.append(key, String(value));
    }
    return uploadMultipart<TeacherAchievement>(BASE, form, { onProgress });
  },
  update: (id: number, fields: UpdateAchievementRequest) =>
    request<TeacherAchievement>(`${BASE}/${id}`, { method: 'PUT', body: fields }),
  replaceFile: (id: number, file: File, onProgress?: UploadProgress) => {
    const form = new FormData();
    form.append('file', file);
    return uploadMultipart<TeacherAchievement>(`${BASE}/${id}/file`, form, { method: 'PUT', onProgress });
  },
  updateVisibility: (id: number, body: UpdateVisibilityRequest) =>
    request<TeacherAchievement>(`${BASE}/${id}/visibility`, { method: 'PUT', body }),
  remove: (id: number) => request<void>(`${BASE}/${id}`, { method: 'DELETE' }),
  content: (id: number) => requestBlob(`${BASE}/${id}/content`),
};
