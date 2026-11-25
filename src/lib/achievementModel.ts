import type {
  AchievementCategory,
  AchievementVisibility,
  TeacherAchievement,
  UpdateAchievementRequest,
} from '@/lib/achievementsApi';

/**
 * Правила экрана «Достижения». Видимость считает сервер (`visibleToParents`, `classes[].active`) —
 * здесь только слова и проверка формы до отправки, чтобы не гонять файл ради пустого названия.
 */

export const ACHIEVEMENT_TITLE_MAX = 300;
export const ACHIEVEMENT_ORGANIZATION_MAX = 300;
export const ACHIEVEMENT_DESCRIPTION_MAX = 2000;
/** Предел сервера — тот же, что у файлов рабочего пространства. */
export const ACHIEVEMENT_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const ACHIEVEMENT_ACCEPT = 'application/pdf,.pdf';

/** Порядок и слова — как в ответе сервера (`categoryLabel`); список нужен форме до первого ответа. */
export const ACHIEVEMENT_CATEGORIES: ReadonlyArray<{ value: AchievementCategory; label: string }> = [
  { value: 'DIPLOMA', label: 'Диплом' },
  { value: 'CERTIFICATE', label: 'Сертификат' },
  { value: 'LETTER_OF_MERIT', label: 'Грамота' },
  { value: 'MEDAL', label: 'Медаль' },
  { value: 'QUALIFICATION', label: 'Повышение квалификации' },
  { value: 'OTHER', label: 'Другое' },
];

export interface AchievementForm {
  title: string;
  category: AchievementCategory | '';
  receivedOn: string;
  organization: string;
  description: string;
}

export const EMPTY_FORM: AchievementForm = {
  title: '',
  category: '',
  receivedOn: '',
  organization: '',
  description: '',
};

export function formFromAchievement(achievement: TeacherAchievement): AchievementForm {
  return {
    title: achievement.title ?? '',
    category: achievement.category ?? '',
    receivedOn: achievement.receivedOn ?? '',
    organization: achievement.organization ?? '',
    description: achievement.description ?? '',
  };
}

/** Пустое необязательное поле уходит `undefined`: сервер очищает его, а не пишет пустую строку. */
export function requestFromForm(form: AchievementForm): UpdateAchievementRequest {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    title: form.title.trim(),
    category: form.category || undefined,
    receivedOn: form.receivedOn || undefined,
    organization: optional(form.organization),
    description: optional(form.description),
  };
}

export interface FormErrors {
  title: string | null;
  file: string | null;
  receivedOn: string | null;
}

export function validateForm(
  form: AchievementForm,
  file: File | null,
  { fileRequired, today }: { fileRequired: boolean; today: string },
): FormErrors {
  return {
    title: !form.title.trim() ? 'Укажите название' : null,
    file: file ? pdfProblem(file) : fileRequired ? 'Выберите PDF-файл' : null,
    receivedOn: form.receivedOn && form.receivedOn > today ? 'Дата получения не может быть в будущем' : null,
  };
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.values(errors).some((value) => value != null);
}

/** Быстрая проверка до отправки; содержимое файла всё равно проверяет сервер. */
export function pdfProblem(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return 'Загрузите файл в формате PDF';
  if (file.size === 0) return 'Файл пустой';
  if (file.size > ACHIEVEMENT_FILE_MAX_BYTES) return 'Файл больше 50 МБ — выберите файл поменьше';
  return null;
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
}

export type VisibilityTone = 'gray' | 'green' | 'amber';

/**
 * Состояние доступа одной строкой. «Открыт, но никому» — отдельный случай: выбранные классы
 * учитель больше не ведёт, и родители документ уже не видят, хотя режим не закрыт.
 */
export function visibilitySummary(achievement: TeacherAchievement): { label: string; tone: VisibilityTone; detail: string | null } {
  const visibility = achievement.visibility ?? 'PRIVATE';
  if (visibility === 'PRIVATE') return { label: 'Только я', tone: 'gray', detail: null };
  if (!achievement.visibleToParents) {
    return {
      label: 'Не видно никому',
      tone: 'amber',
      detail: visibility === 'ALL_CLASSES'
        ? 'У вас нет действующих классов'
        : 'Вы больше не ведёте выбранные классы',
    };
  }
  const active = (achievement.classes ?? []).filter((item) => item.active).map((item) => item.name ?? '');
  if (visibility === 'ALL_CLASSES') {
    return { label: 'Все мои классы', tone: 'green', detail: active.join(', ') || null };
  }
  return { label: `Родители: ${active.join(', ')}`, tone: 'green', detail: null };
}

/** Классы из выбора, которые учитель больше не ведёт: их видно, но родители там документ не видят. */
export function inactiveSelectedClasses(achievement: TeacherAchievement): string[] {
  if (achievement.visibility === 'ALL_CLASSES') return [];
  return (achievement.classes ?? []).filter((item) => !item.active).map((item) => item.name ?? '');
}

export interface VisibilityDraft {
  visibility: AchievementVisibility;
  classIds: number[];
}

export function draftFromAchievement(achievement: TeacherAchievement): VisibilityDraft {
  return {
    visibility: achievement.visibility ?? 'PRIVATE',
    // В выборе остаются только классы, которые учитель ведёт: остальные сервер не примет.
    classIds: achievement.visibility === 'ALL_CLASSES'
      ? []
      : (achievement.classes ?? []).filter((item) => item.active && item.id != null).map((item) => item.id as number),
  };
}

export function visibilityDraftError(draft: VisibilityDraft, availableClassCount: number): string | null {
  if (draft.visibility === 'SELECTED_CLASSES' && draft.classIds.length === 0) return 'Выберите хотя бы один класс';
  if (draft.visibility !== 'PRIVATE' && availableClassCount === 0) {
    return 'У вас нет действующих классов — открыть документ некому';
  }
  return null;
}

export function sizeLabel(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
}
