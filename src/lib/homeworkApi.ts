import { pageQuery, request, requestBlob, requestMultipart } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

/**
 * Поля списка, которых пока нет в сгенерированных типах.
 *
 * `api-types.ts` снят с ветки бэкенда, где работа HOMEWORK-005.1 ещё не влита: там у
 * `HomeworkView` нет ни подписей, ни прогресса. Дописывать их в сгенерированный файл
 * нельзя — он перегенерируется и правки затрутся, — поэтому расширение объявлено здесь
 * и живёт ровно до первого `pnpm gen:api` по слитому бэкенду: после него эти поля
 * приедут сами, и весь блок нужно удалить.
 *
 * Контракт полей — `HomeworkDtos.HomeworkView` (ТЗ HOMEWORK-005.1 §4.2).
 */
export interface HomeworkProgress {
  /** Уникальные ученики, отправившие работу хотя бы один раз. */
  submitted?: number;
  /** Все активные получатели задания. */
  total?: number;
  /** Отправки, ждущие решения учителя. */
  pendingReview?: number;
}

export interface HomeworkLessonRef {
  id?: number;
  lessonDate?: string;
  lessonNumber?: number;
}

interface HomeworkListFields {
  className?: string;
  subjectName?: string;
  subgroupName?: string;
  lesson?: HomeworkLessonRef;
  progress?: HomeworkProgress;
}

export type Homework = Schema<'HomeworkView'> & HomeworkListFields;
export type HomeworkStatus = NonNullable<Homework['status']>;

/**
 * Страница списка с расширенными строками: сгенерированный `PageHomeworkView` знает только
 * урезанный `HomeworkView`, а подписи и прогресс объявлены здесь (см. `HomeworkListFields`).
 */
type HomeworkPage = Omit<Schema<'PageHomeworkView'>, 'content'> & { content?: Homework[] };

/** Вкладка списка: набор статусов, а не отдельный ресурс (ТЗ HOMEWORK-005.1 §4.1). */
export type HomeworkScope = 'ACTUAL' | 'HISTORY';

export interface HomeworkListParams {
  scope: HomeworkScope;
  /** Статусы внутри вкладки; бэк пересекает их с вкладкой, а не заменяет ею. */
  statuses?: HomeworkStatus[];
  classId?: number;
  subgroupId?: number;
  subjectId?: number;
  lessonId?: number;
  /** Период по сроку сдачи, ISO. Задания без срока в период не попадают. */
  dueFrom?: string;
  dueTo?: string;
  pendingReviewOnly?: boolean;
  page?: number;
  size?: number;
}

/**
 * Домашние задания учителя (HomeworkController).
 *
 * Фильтрация целиком серверная (ТЗ §7): доотбирать пришедшую страницу на клиенте нельзя —
 * на второй странице выдача была бы другой, а «сдали / всего» посчитан по всем получателям,
 * а не по тому, что попало в ответ.
 */
export const homeworkApi = {
  list(params: HomeworkListParams, signal?: AbortSignal): Promise<HomeworkPage> {
    const { statuses, ...rest } = params;
    // Повторяющийся `statuses` — множество на бэке, поэтому ключ дублируется, а не
    // склеивается запятой: Spring разбирает именно повторы.
    const repeated = (statuses ?? []).map((status) => `statuses=${status}`).join('&');
    const query = pageQuery({ ...rest });
    const separator = query ? '&' : '?';
    return request<HomeworkPage>(
      `/homework${query}${repeated ? separator + repeated : ''}`,
      { signal },
    );
  },

  card: (homeworkId: number, signal?: AbortSignal) =>
    request<Homework>(`/homework/${homeworkId}`, { signal }),

  create: (input: CreateHomeworkInput) =>
    request<Homework>('/homework', { method: 'POST', body: input }),

  update: (homeworkId: number, input: UpdateHomeworkInput) =>
    request<Homework>(`/homework/${homeworkId}`, { method: 'PUT', body: input }),

  remove: (homeworkId: number) => request<void>(`/homework/${homeworkId}`, { method: 'DELETE' }),

  publish: (homeworkId: number) =>
    request<Homework>(`/homework/${homeworkId}/publish`, { method: 'POST' }),

  complete: (homeworkId: number) =>
    request<Homework>(`/homework/${homeworkId}/completion`, { method: 'POST' }),

  /** Повторное открытие — это снятие завершения, отдельного ресурса у него нет (§6.3). */
  reopen: (homeworkId: number) =>
    request<Homework>(`/homework/${homeworkId}/completion`, { method: 'DELETE' }),

  cancel: (homeworkId: number) =>
    request<Homework>(`/homework/${homeworkId}/cancellation`, { method: 'POST' }),

  setRecipients: (homeworkId: number, input: SetRecipientsInput) =>
    request<Homework>(`/homework/${homeworkId}/recipients`, { method: 'PUT', body: input }),

  /**
   * Временные группы класса (HOMEWORK-002 §4). Это готовые группы, собранные учителем
   * раньше; создание и правку состава делает отдельный экран, здесь — только выбор.
   */
  listGroups: (classId: number, subjectId?: number, signal?: AbortSignal) =>
    request<HomeworkGroup[]>(
      `/homework-groups${pageQuery({ classId, subjectId, status: 'ACTIVE' })}`,
      { signal },
    ),

  // ─── Наборы групп (HOMEWORK-002 §5) ────────────────────────────────────────
  listGroupSets: (classId: number, subjectId?: number, signal?: AbortSignal) =>
    request<HomeworkGroupSet[]>(
      `/homework-group-sets${pageQuery({ classId, subjectId, status: 'ACTIVE' })}`,
      { signal },
    ),

  createGroupSet: (input: {
    classId: number;
    subjectId: number;
    groupCount: number;
    source: GroupSource;
    sourceId?: number;
    name?: string;
    random?: boolean;
  }) => request<HomeworkGroupSet>('/homework-group-sets', { method: 'POST', body: input }),

  /**
   * Пересборка состава — она же «перемешать случайно» и «добавить группу»: и то и другое
   * это заново разложить исходный состав, только на другое число групп. Отдельной ручки
   * «добавить группу» у бэкенда нет, и придумывать её на фронте нельзя — состав внутри
   * набора не должен пересекаться, а следит за этим сервер.
   */
  redistributeGroupSet: (
    setId: number,
    input: { groupCount: number; source: GroupSource; sourceId?: number },
  ) => request<HomeworkGroupSet>(`/homework-group-sets/${setId}/distribution`, {
    method: 'POST',
    body: input,
  }),

  /** Перенос ученика между группами набора — одной операцией, а не «убрать + добавить». */
  moveGroupStudent: (setId: number, studentId: number, targetGroupId: number) =>
    request<HomeworkGroupSet>(`/homework-group-sets/${setId}/moves`, {
      method: 'POST',
      body: { studentId, targetGroupId },
    }),

  renameGroupSet: (setId: number, name: string) =>
    request<HomeworkGroupSet>(`/homework-group-sets/${setId}/name`, {
      method: 'PUT',
      body: { name },
    }),

  archiveGroupSet: (setId: number) =>
    request<HomeworkGroupSet>(`/homework-group-sets/${setId}/archival`, { method: 'POST' }),

  renameGroup: (groupId: number, name: string) =>
    request<HomeworkGroup>(`/homework-groups/${groupId}/name`, { method: 'PUT', body: { name } }),

  setGroupStudents: (groupId: number, studentIds: number[]) =>
    request<HomeworkGroup>(`/homework-groups/${groupId}/students`, {
      method: 'PUT',
      body: { studentIds },
    }),

  // ─── Материалы ─────────────────────────────────────────────────────────────
  listMaterials: (homeworkId: number, signal?: AbortSignal) =>
    request<HomeworkMaterial[]>(`/homework/${homeworkId}/materials`, { signal }),

  addMaterialFile: (homeworkId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return requestMultipart<HomeworkMaterial>(`/homework/${homeworkId}/materials/files`, form);
  },

  addMaterialLink: (homeworkId: number, url: string) =>
    request<HomeworkMaterial>(`/homework/${homeworkId}/materials/links`, {
      method: 'POST',
      body: { url },
    }),

  deleteMaterial: (homeworkId: number, materialId: number) =>
    request<void>(`/homework/${homeworkId}/materials/${materialId}`, { method: 'DELETE' }),

  materialBlob: (homeworkId: number, materialId: number, signal?: AbortSignal) =>
    requestBlob(`/homework/${homeworkId}/materials/${materialId}/content`, signal),

  // ─── Получатели и работы ───────────────────────────────────────────────────
  roster: (homeworkId: number, signal?: AbortSignal) =>
    request<Roster>(`/homework/${homeworkId}/submissions`, { signal }),

  submission: (homeworkId: number, studentProfileId: number, signal?: AbortSignal) =>
    request<Submission>(`/homework/${homeworkId}/submissions/${studentProfileId}`, { signal }),

  submissionAttachmentBlob: (
    homeworkId: number,
    studentProfileId: number,
    attachmentId: number,
    signal?: AbortSignal,
  ) =>
    requestBlob(
      `/homework/${homeworkId}/submissions/${studentProfileId}/attachments/${attachmentId}/content`,
      signal,
    ),

  reviewPhotoBlob: (
    homeworkId: number,
    studentProfileId: number,
    photoId: number,
    signal?: AbortSignal,
  ) =>
    requestBlob(
      `/homework/${homeworkId}/submissions/${studentProfileId}/review-photos/${photoId}/content`,
      signal,
    ),

  /** Решение учителя по конкретной версии работы (§9). Multipart — вместе с фотографиями. */
  review: (homeworkId: number, studentProfileId: number, input: ReviewInput) => {
    const form = new FormData();
    form.append('decision', input.decision);
    form.append('expectedAttemptId', String(input.expectedAttemptId));
    if (input.comment) form.append('comment', input.comment);
    for (const photo of input.photos ?? []) form.append('photos', photo);
    return requestMultipart<Submission>(
      `/homework/${homeworkId}/submissions/${studentProfileId}/reviews`,
      form,
    );
  },
};

/** Статусы, которые фильтр предлагает на каждой вкладке (§4.1). */
export const SCOPE_STATUSES: Record<HomeworkScope, HomeworkStatus[]> = {
  ACTUAL: ['DRAFT', 'PUBLISHED'],
  HISTORY: ['COMPLETED', 'CANCELLED'],
};

// ─── Работы учеников (HOMEWORK-003/004) ──────────────────────────────────────

export type SubmissionStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'RETURNED' | 'DONE';
export type ReviewDecision = 'DONE' | 'RETURNED';
export type RecipientType = 'CLASS' | 'SUBGROUP' | 'TEMP_GROUP' | 'STUDENTS';
export type DueType = 'EXACT' | 'NEXT_LESSON' | 'NONE';

/**
 * DTO работ учеников. Объявлены здесь по той же причине, что и поля списка выше:
 * `api-types.ts` снят с ветки бэкенда без этой части контракта. Уйдут отсюда вместе
 * с блоком `HomeworkListFields` после первого `pnpm gen:api` по слитому бэкенду.
 *
 * Контракт — `HomeworkSubmissionDtos` (HOMEWORK-003/004).
 */
export interface Attachment {
  id?: number;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface SubmissionReview {
  id?: number;
  decision?: ReviewDecision;
  comment?: string;
  teacherProfileId?: number;
  createdAt?: string;
  photos?: Attachment[];
}

export interface Attempt {
  id?: number;
  attemptNumber?: number;
  body?: string;
  submittedAt?: string;
  photos?: Attachment[];
  files?: Attachment[];
  reviews?: SubmissionReview[];
}

export interface Submission {
  id?: number;
  homeworkId?: number;
  studentProfileId?: number;
  studentFullName?: string;
  status?: SubmissionStatus;
  attemptCount?: number;
  resubmitted?: boolean;
  lastSubmittedAt?: string;
  canSubmit?: boolean;
  blockedReason?: string;
  currentAttempt?: Attempt;
  history?: Attempt[];
}

export interface RosterEntry {
  studentProfileId?: number;
  fullName?: string;
  status?: SubmissionStatus;
  submissionId?: number;
  currentAttemptId?: number;
  lastSubmittedAt?: string;
  resubmitted?: boolean;
  active?: boolean;
}

export interface Roster {
  total?: number;
  submitted?: number;
  returned?: number;
  done?: number;
  notSubmitted?: number;
  students?: RosterEntry[];
}

export type HomeworkMaterial = Schema<'HomeworkMaterialView'>;

export interface HomeworkGroupStudent {
  studentProfileId?: number;
  fullName?: string;
  active?: boolean;
}

export interface HomeworkGroup {
  id?: number;
  name?: string;
  classId?: number;
  subjectId?: number;
  groupSetId?: number;
  studentCount?: number;
  status?: string;
  students?: HomeworkGroupStudent[];
}

/** Набор — класс, разделённый на несколько непересекающихся групп (HOMEWORK-002 §5). */
export interface HomeworkGroupSet {
  id?: number;
  name?: string;
  classId?: number;
  subjectId?: number;
  status?: 'ACTIVE' | 'ARCHIVED';
  groups?: HomeworkGroup[];
}

/** Откуда берётся состав при делении: весь класс, подгруппа расписания или другая группа. */
export type GroupSource = 'CLASS' | 'SUBGROUP' | 'TEMP_GROUP';

export interface CreateHomeworkInput {
  /** Задание из урока: предмет, класс, подгруппа и период берёт бэкенд из урока (§2.1). */
  lessonId?: number;
  /** Самостоятельное задание (§2.2). Фиктивный урок под него не заводится. */
  classId?: number;
  subjectId?: number;
  title: string;
  description?: string;
  recipientType?: RecipientType;
  subgroupId?: number;
  tempGroupId?: number;
  studentIds?: number[];
  dueType: DueType;
  dueAt?: string;
}

export interface UpdateHomeworkInput {
  title: string;
  description?: string;
  dueType: DueType;
  dueAt?: string;
}

export interface SetRecipientsInput {
  type: RecipientType;
  subgroupId?: number;
  tempGroupId?: number;
  studentIds?: number[];
}

export interface ReviewInput {
  decision: ReviewDecision;
  /**
   * Версия, к которой относится решение (§9). Бэкенд сверяет её с текущей и отклоняет
   * решение, если ученик успел прислать новую: иначе учитель принял бы одну работу,
   * а подпись легла бы на другую.
   */
  expectedAttemptId: number;
  comment?: string;
  photos?: File[];
}

