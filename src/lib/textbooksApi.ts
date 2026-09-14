import { request, requestBlob, requestMultipart } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type Textbook = Schema<'TextbookView'>;
export type TextbookBinding = Schema<'TextbookBindingView'>;
export type BindingOptions = Schema<'BindingOptionsView'>;
export type BindingOptionsYear = Schema<'Year'>;
export type BindingOptionsPeriod = Schema<'PeriodOption'>;
export type BindingOptionsAssignment = Schema<'Assignment'>;
export type BindingBatch = Schema<'TextbookBindingBatchView'>;
export type CreateBindingsRequest = Schema<'CreateTextbookBindingsRequest'>;
export type DuplicateCheck = Schema<'DuplicateCheckView'>;
export type LessonTextbooks = Schema<'LessonTextbooksView'>;
export type LessonTextbook = Schema<'LessonTextbookView'>;
export type SelectLessonTextbookRequest = Schema<'SelectLessonTextbookRequest'>;

/** Коды отказов, на которые у экранов есть свой ответ (контракт §8). */
export const TEXTBOOK_ERRORS = {
  duplicate: 'TEXTBOOK_DUPLICATE',
  blocked: 'TEXTBOOK_BLOCKED',
  bindingAlreadyEnded: 'TEXTBOOK_BINDING_ALREADY_ENDED',
  bindingNotStarted: 'TEXTBOOK_BINDING_NOT_STARTED',
  bindingStarted: 'TEXTBOOK_BINDING_STARTED',
  notActiveForLesson: 'TEXTBOOK_NOT_ACTIVE_FOR_LESSON',
} as const;

/** Фильтры таблицы назначений. Пустое поле — «все». */
export type BindingFilters = {
  academicYearId: number;
  academicPeriodId?: number;
  subjectId?: number;
  classId?: number;
};

/**
 * Личная библиотека учителя (LIBRARY-BE-001, `docs/textbook-library-contract.md` §1–§4).
 *
 * Здесь только то, чем пользуются экраны: загрузка, проверка дубля и файл. Каталог
 * библиотеки, архив и переименование в макетах пока не нарисованы.
 */
export const teacherTextbooksApi = {
  /**
   * Загрузка файла в библиотеку. Сервер сам определяет формат по сигнатуре и ещё раз
   * проверяет дубль по содержимому: на повтор отвечает 409 `TEXTBOOK_DUPLICATE` с уже
   * загруженным учебником в `details`, если не передан `allowDuplicate`.
   */
  upload(input: { file: File; title: string; subjectId: number; allowDuplicate?: boolean }): Promise<Textbook> {
    const formData = new FormData();
    formData.append('file', input.file);
    formData.append('title', input.title);
    formData.append('subjectId', String(input.subjectId));
    if (input.allowDuplicate) formData.append('allowDuplicate', 'true');
    return requestMultipart<Textbook>('/teacher/textbooks', formData);
  },

  /** Предупреждение о дубле **до** загрузки: 100-мегабайтный скан незачем гнать, чтобы узнать, что он уже есть. */
  duplicateCheck(sha256: string): Promise<DuplicateCheck> {
    return request<DuplicateCheck>('/teacher/textbooks/duplicate-check', {
      method: 'POST',
      body: { sha256 },
    });
  },

  /** Файл своего учебника. Под авторизацией, поэтому blob, а не ссылка. */
  content(textbookId: number, signal?: AbortSignal): Promise<Blob> {
    return requestBlob(`/teacher/textbooks/${textbookId}/content`, signal);
  },
};

/**
 * Назначения учебников классам (контракт §2, §7).
 *
 * Список всегда просится с `includeEnded=true`: экран показывает период целиком — и то, что
 * действует, и то, что начнётся или уже закончилось. Без флага сервер отдаёт только
 * действующее сегодня, и назначение на следующую четверть исчезало бы сразу после создания.
 */
export const textbookBindingsApi = {
  /** Годы → периоды → свои пары «класс + предмет» одним ответом. */
  options(signal?: AbortSignal): Promise<BindingOptions> {
    return request<BindingOptions>('/teacher/textbook-bindings/options', { signal });
  },

  list(filters: BindingFilters, signal?: AbortSignal): Promise<TextbookBinding[]> {
    const params = new URLSearchParams({
      academicYearId: String(filters.academicYearId),
      includeEnded: 'true',
    });
    if (filters.academicPeriodId != null) params.set('academicPeriodId', String(filters.academicPeriodId));
    if (filters.subjectId != null) params.set('subjectId', String(filters.subjectId));
    if (filters.classId != null) params.set('classId', String(filters.classId));
    return request<TextbookBinding[]>(`/teacher/textbook-bindings?${params}`, { signal });
  },

  /** Сетка «периоды × классы» одним запросом. Уже покрытая клетка — не ошибка, а `skipped`. */
  create(body: CreateBindingsRequest): Promise<BindingBatch> {
    return request<BindingBatch>('/teacher/textbook-bindings', { method: 'POST', body });
  },

  /** «Завершить использование» с сегодняшнего дня включительно: идущий сейчас урок учебник не теряет. */
  terminate(bindingId: number): Promise<TextbookBinding> {
    return request<TextbookBinding>(`/teacher/textbook-bindings/${bindingId}/termination`, {
      method: 'POST',
      body: {},
    });
  },

  /** Удаляется только не начавшееся назначение — у него ещё нет истории. */
  remove(bindingId: number): Promise<void> {
    return request<void>(`/teacher/textbook-bindings/${bindingId}`, { method: 'DELETE' });
  },
};

/**
 * Учебники урока (контракт §6). Один ответ на весь блок: выбор учителя, всё назначенное
 * классу на дату урока и право выбирать. Кто что может, решает сервер (`canSelect`).
 */
export const lessonTextbooksApi = {
  get(lessonId: number, signal?: AbortSignal): Promise<LessonTextbooks> {
    return request<LessonTextbooks>(`/lessons/${lessonId}/textbooks`, { signal });
  },

  /** Выбор принимает `bindingId`, а не учебник: учебник действует у класса через назначение. */
  select(lessonId: number, body: SelectLessonTextbookRequest): Promise<LessonTextbooks> {
    return request<LessonTextbooks>(`/lessons/${lessonId}/textbook`, { method: 'PUT', body });
  },

  clear(lessonId: number): Promise<LessonTextbooks> {
    return request<LessonTextbooks>(`/lessons/${lessonId}/textbook`, { method: 'DELETE' });
  },

  /** Файл через урок — второе основание доступа, для всех, кто видит карточку. */
  content(lessonId: number, textbookId: number, signal?: AbortSignal): Promise<Blob> {
    return requestBlob(`/lessons/${lessonId}/textbooks/${textbookId}/content`, signal);
  },
};
