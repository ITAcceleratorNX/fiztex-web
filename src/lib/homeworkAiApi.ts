import { request, requestBlob, requestMultipart } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

/**
 * AI-часть домашнего задания и материалы урока, на которых она работает
 * (ТЗ HOMEWORK-BE-006, контракт — `fiztex-back/docs/homework-ai-contract.md`).
 *
 * Отдельный файл от `homeworkApi.ts`: тот и без того на четыреста строк, а это цельный
 * кусок с собственным протоколом — задача, опрос состояния, применение результата.
 */

export type LessonMaterial = Schema<'LessonMaterialView'>;
export type HomeworkAiJob = Schema<'HomeworkAiJobView'>;
export type HomeworkAiQuota = Schema<'HomeworkAiQuotaView'>;
export type HomeworkAiResult = Schema<'HomeworkAiResultView'>;
export type HomeworkQuestion = Schema<'HomeworkQuestionView'>;
export type StudentQuestion = Schema<'StudentQuestionView'>;
export type TeacherAnswer = Schema<'TeacherAnswerView'>;
export type AnswerPhoto = Schema<'AnswerPhotoView'>;
export type AiRecommendation = Schema<'HomeworkAiRecommendationView'>;
export type SaveQuestionsRequest = Schema<'SaveHomeworkQuestionsRequest'>;
export type StartGenerationRequest = Schema<'StartHomeworkAiGenerationRequest'>;
export type SetAnswerScoresRequest = Schema<'SetAnswerScoresRequest'>;

/**
 * Ключ идемпотентности. Клиент обязан сгенерировать его **один раз на нажатие кнопки**
 * и повторять при ретрае: повтор с тем же ключом возвращает существующую задачу и не
 * тратит квоту, а новый ключ — это второй платный вызов модели.
 */
function idempotent(key: string) {
  return { 'Idempotency-Key': key };
}

export const lessonMaterialsApi = {
  list: (lessonId: number, childId?: number, signal?: AbortSignal) =>
    request<LessonMaterial[]>(
      `/lessons/${lessonId}/materials${childId != null ? `?childId=${childId}` : ''}`,
      { signal },
    ),

  addFile: (lessonId: number, file: File, signal?: AbortSignal) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestMultipart<LessonMaterial>(`/lessons/${lessonId}/materials/files`, formData, signal);
  },

  addLink: (lessonId: number, url: string) =>
    request<LessonMaterial>(`/lessons/${lessonId}/materials/links`, {
      method: 'POST',
      body: { url },
    }),

  setVisibility: (lessonId: number, materialId: number, visibleToStudents: boolean) =>
    request<LessonMaterial>(`/lessons/${lessonId}/materials/${materialId}`, {
      method: 'PATCH',
      body: { visibleToStudents },
    }),

  remove: (lessonId: number, materialId: number) =>
    request<void>(`/lessons/${lessonId}/materials/${materialId}`, { method: 'DELETE' }),

  /**
   * Содержимое файла. Отдаётся под авторизацией, поэтому обычной ссылкой его не открыть —
   * в теге нет заголовка. Забираем запросом и показываем как object URL, ровно как
   * вложения работ ({@code AttachmentChip}).
   */
  content: (lessonId: number, materialId: number, signal?: AbortSignal) =>
    requestBlob(`/lessons/${lessonId}/materials/${materialId}/content`, signal),
};

export const homeworkAiApi = {
  quota: (signal?: AbortSignal) => request<HomeworkAiQuota>('/homework/ai-quota', { signal }),

  startGeneration: (homeworkId: number, key: string, input: StartGenerationRequest) =>
    request<HomeworkAiJob>(`/homework/${homeworkId}/ai-generations`, {
      method: 'POST',
      body: input,
      headers: idempotent(key),
    }),

  job: (jobId: number, signal?: AbortSignal) =>
    request<HomeworkAiJob>(`/homework/ai-generations/${jobId}`, { signal }),

  jobs: (homeworkId: number, signal?: AbortSignal) =>
    request<HomeworkAiJob[]>(`/homework/${homeworkId}/ai-generations`, { signal }),

  /** Применить результат к заданию — когда он не применился сам из-за правок учителя. */
  apply: (homeworkId: number, jobId: number) =>
    request<HomeworkAiJob>(`/homework/${homeworkId}/ai-generations/${jobId}/apply`, {
      method: 'POST',
    }),

  /** Что предлагает модель — чтобы решение принималось по прочитанному. */
  result: (homeworkId: number, jobId: number, signal?: AbortSignal) =>
    request<HomeworkAiResult>(`/homework/${homeworkId}/ai-generations/${jobId}/result`, {
      signal,
    }),

  /** Отказаться от предложенного варианта: учитель оставляет свой текст. */
  discard: (homeworkId: number, jobId: number) =>
    request<HomeworkAiJob>(`/homework/${homeworkId}/ai-generations/${jobId}/discard`, {
      method: 'POST',
    }),

  /** Вернуть то, что было в задании до применения. */
  revert: (homeworkId: number, jobId: number) =>
    request<HomeworkAiJob>(`/homework/${homeworkId}/ai-generations/${jobId}/revert`, {
      method: 'POST',
    }),

  suggestGrades: (homeworkId: number, studentProfileId: number, key: string) =>
    request<HomeworkAiJob>(
      `/homework/${homeworkId}/submissions/${studentProfileId}/ai-grade-suggestions`,
      { method: 'POST', headers: idempotent(key) },
    ),

  /**
   * Рекомендованная оценка за работу целиком — или пусто, если проверку ещё не запускали.
   *
   * Отдельный запрос, а не поле задачи: рекомендация живёт по попытке и переживает саму
   * задачу, а карточку с ней экран показывает и после перезагрузки страницы.
   */
  recommendation: (homeworkId: number, studentProfileId: number, signal?: AbortSignal) =>
    request<AiRecommendation | null>(
      `/homework/${homeworkId}/submissions/${studentProfileId}/ai-recommendation`,
      { signal },
    ),

  /**
   * Последняя подсказка по текущей попытке ученика — или пусто, если её не запускали.
   *
   * Состояние идущей задачи спрашивается у сервера, а не хранится в браузере: учитель,
   * открывший проверку на другом устройстве, обязан увидеть ту же задачу, а не пустой
   * экран с кнопкой, второе нажатие которой стоило бы вторых денег.
   */
  lastGradeSuggestion: (homeworkId: number, studentProfileId: number, signal?: AbortSignal) =>
    request<HomeworkAiJob | null>(
      `/homework/${homeworkId}/submissions/${studentProfileId}/ai-grade-suggestions`,
      { signal },
    ),
};

export const homeworkQuestionsApi = {
  list: (homeworkId: number, signal?: AbortSignal) =>
    request<HomeworkQuestion[]>(`/homework/${homeworkId}/questions`, { signal }),

  save: (homeworkId: number, input: SaveQuestionsRequest) =>
    request<HomeworkQuestion[]>(`/homework/${homeworkId}/questions`, {
      method: 'PUT',
      body: input,
    }),

  /** Заменить один вопрос моделью; соседние не трогаются. */
  regenerate: (homeworkId: number, questionId: number, key: string, teacherPrompt?: string) =>
    request<HomeworkAiJob>(`/homework/${homeworkId}/questions/${questionId}/regenerate`, {
      method: 'POST',
      body: { teacherPrompt },
      headers: idempotent(key),
    }),
};

export const homeworkAnswersApi = {
  /**
   * Снимок решения, приложенный учеником к открытому вопросу.
   *
   * Отдаётся потоком под авторизацией, поэтому в `<img src>` его не поставить: заголовка
   * там нет. Забирается запросом и живёт object URL-ом — как остальные вложения работы.
   */
  photoBlob: (
    homeworkId: number,
    studentProfileId: number,
    photoId: number,
    signal?: AbortSignal,
  ) =>
    requestBlob(
      `/homework/${homeworkId}/submissions/${studentProfileId}/answer-photos/${photoId}/content`,
      signal,
    ),

  /**
   * Вопросы для ученика — **только этот адрес**. Учительский `/questions` отдаёт ключ
   * правильных ответов, и обращение к нему с экрана ученика раскрывает тест.
   */
  myQuestions: (homeworkId: number, signal?: AbortSignal) =>
    request<StudentQuestion[]>(`/homework/${homeworkId}/my-submission/questions`, { signal }),

  ofStudent: (homeworkId: number, studentProfileId: number, signal?: AbortSignal) =>
    request<TeacherAnswer[]>(
      `/homework/${homeworkId}/submissions/${studentProfileId}/answers`,
      { signal },
    ),

  /** Баллы за вопросы. Это разбор работы, а не оценка: она ставится через `POST /grades`. */
  setScores: (homeworkId: number, studentProfileId: number, input: SetAnswerScoresRequest) =>
    request<TeacherAnswer[]>(
      `/homework/${homeworkId}/submissions/${studentProfileId}/answers/scores`,
      { method: 'PUT', body: input },
    ),
};
