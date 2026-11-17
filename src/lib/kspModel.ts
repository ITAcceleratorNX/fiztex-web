import type {
  KspContext,
  KspDocument,
  KspEntryState,
  KspExportFormat,
  KspGenerateRequest,
  KspJobSource,
  KspStage,
  KspState,
  KspTopicSource,
} from './kspApi';

/**
 * Правила экранов КСП (KSP-FE-001). Здесь только то, что экран обязан решить сам: что
 * показать и что отправить. Права, ревизии, лимиты и состав документа решает бэкенд
 * (`fiztex-back/docs/ksp-contract.md`), экран лишь называет его ответы.
 */

// ---- Карточка урока (К1–К4) ----

/** Подпись карточки «Поурочный план (КСП)». Состояние считает сервер (`entryState`). */
export function entryCaption(state: KspEntryState | undefined, ksp: KspState | undefined): string {
  switch (state) {
    case 'GENERATING':
      return 'ИИ составляет план…';
    case 'UNSAVED':
      return 'Результат готов, но не сохранён. Проверьте и сохраните';
    case 'SAVED':
      return ksp?.updatedAt ? `Сохранён ${dateTimeLabel(ksp.updatedAt)}` : 'Сохранён';
    default:
      return 'Составим по теме из КТП и данным урока, по форме приказа №130';
  }
}

/** «12.11.2026 в 14:20» — так макет пишет время сохранения (К4, С1). */
export function dateTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} в ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** «2026-11-13» → «13.11.2026», как в шапке документа. */
export function dateLabel(isoDate: string | undefined | null): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return y && m && d ? `${d}.${m}.${y}` : isoDate;
}

// ---- Подготовка (П1–П4) ----

export type TopicChoice = 'KTP' | 'LESSON';

export interface PrepForm {
  /** Ручной ввод — только там, где значения нет ни в КТП, ни в уроке (П2). */
  section: string;
  topic: string;
  learningObjectives: string;
  /** При расхождении тем (П4) тему выбирает учитель: по умолчанию не выбрано (ТЗ, «Вопрос для согласования»). */
  topicChoice: TopicChoice | null;
  presentCount: string;
  absentCount: string;
  hintIds: string[];
  wishes: string;
}

export type PrepField = 'section' | 'topic' | 'learningObjectives' | 'topicChoice' | 'presentCount' | 'absentCount';
export type PrepErrors = Partial<Record<PrepField, string>>;

/** Откуда значение реквизита: из КТП, из темы урока или введено вручную. */
export type ValueOrigin = 'KTP' | 'LESSON' | 'MANUAL';

export interface ResolvedField {
  value: string | null;
  origin: ValueOrigin;
}

/** Есть ли у поля значение из КТП. Нет — учитель вводит его сам. */
export function hasKtpValue(context: KspContext, field: keyof KspTopicSource): boolean {
  return !isBlank(context.ktp?.[field]);
}

export function emptyPrepForm(context: KspContext): PrepForm {
  // Без КТП тема, заданная уроку, — уже ответ на «какая тема»: перепечатывать её незачем.
  const lesson = context.ktp ? undefined : context.lesson;
  return {
    section: lesson?.section ?? '',
    topic: lesson?.topic ?? '',
    learningObjectives: lesson?.learningObjectives ?? '',
    topicChoice: null,
    presentCount: countText(context.presentCount),
    absentCount: countText(context.absentCount),
    hintIds: [],
    wishes: '',
  };
}

/**
 * Форма из задачи, запущенной раньше: «Изменить данные» после ошибки (Г2) и возврат к подготовке
 * не теряют ни ввода, ни пожеланий. Значения в `source` уже разрешены сервером, поэтому тема,
 * совпавшая с КТП или уроком, становится выбором, а не ручным вводом.
 */
export function prepFormFromSource(context: KspContext, source: KspJobSource | undefined): PrepForm {
  const form = emptyPrepForm(context);
  if (!source) return form;
  let topicChoice: TopicChoice | null = null;
  if (context.topicMismatch) {
    if (same(source.topic, context.lesson?.topic)) topicChoice = 'LESSON';
    else if (same(source.topic, context.ktp?.topic)) topicChoice = 'KTP';
  }
  return {
    section: hasKtpValue(context, 'section') ? form.section : source.section ?? form.section,
    topic: hasKtpValue(context, 'topic') ? form.topic : source.topic ?? form.topic,
    learningObjectives: hasKtpValue(context, 'learningObjectives')
      ? form.learningObjectives
      : source.learningObjectives ?? form.learningObjectives,
    topicChoice,
    presentCount: countText(source.presentCount ?? context.presentCount),
    absentCount: countText(source.absentCount ?? context.absentCount),
    hintIds: source.hintIds ?? [],
    wishes: source.wishes ?? '',
  };
}

/**
 * Значения, с которыми пойдёт генерация. При расхождении тем раздел и цели берутся у выбранной
 * темы, если они у неё есть: фактическая тема из другой темы КТП приходит со своими целями.
 */
export function resolvePrepFields(context: KspContext, form: PrepForm): Record<keyof KspTopicSource, ResolvedField> {
  const pick = (field: keyof KspTopicSource): ResolvedField => {
    if (context.topicMismatch && form.topicChoice === 'LESSON' && !isBlank(context.lesson?.[field])) {
      return { value: context.lesson?.[field] ?? null, origin: 'LESSON' };
    }
    if (hasKtpValue(context, field)) {
      return { value: context.ktp?.[field] ?? null, origin: 'KTP' };
    }
    const typed = form[field].trim();
    return { value: typed || null, origin: 'MANUAL' };
  };
  const topic = context.topicMismatch && form.topicChoice == null
    ? { value: null, origin: 'KTP' as const }
    : pick('topic');
  return { section: pick('section'), topic, learningObjectives: pick('learningObjectives') };
}

/** Проверка перед «Сгенерировать КСП» (П3): неполный запрос не отправляется. */
export function validatePrep(context: KspContext, form: PrepForm): PrepErrors {
  const errors: PrepErrors = {};
  if (context.topicMismatch && form.topicChoice == null) {
    errors.topicChoice = 'Выберите тему, по которой составить КСП';
  }
  if (!hasKtpValue(context, 'section') && !form.section.trim()) errors.section = 'Укажите раздел';
  if (!hasKtpValue(context, 'topic') && !form.topic.trim()) errors.topic = 'Укажите тему урока';
  if (!hasKtpValue(context, 'learningObjectives') && !form.learningObjectives.trim()) {
    errors.learningObjectives = 'Укажите хотя бы одну цель обучения';
  }
  for (const field of ['presentCount', 'absentCount'] as const) {
    if (parseCount(form[field]) === 'invalid') errors[field] = 'Целое число от 0 до 10000';
  }
  return errors;
}

export function buildGenerateRequest(context: KspContext, form: PrepForm): KspGenerateRequest {
  const fields = resolvePrepFields(context, form);
  const present = parseCount(form.presentCount);
  const absent = parseCount(form.absentCount);
  return {
    section: fields.section.value ?? undefined,
    topic: fields.topic.value ?? undefined,
    learningObjectives: fields.learningObjectives.value ?? undefined,
    wishes: form.wishes.trim() || undefined,
    hintIds: form.hintIds.length > 0 ? form.hintIds : undefined,
    language: context.defaultLanguage ?? undefined,
    presentCount: typeof present === 'number' ? present : undefined,
    absentCount: typeof absent === 'number' ? absent : undefined,
  };
}

/** Повтор с теми же данными: «Повторить генерацию» (Г2, Н4), «Сгенерировать заново» в редакторе (Р1). */
export function requestFromSource(source: KspJobSource | undefined, fallbackLanguage?: string): KspGenerateRequest {
  return {
    section: source?.section ?? undefined,
    topic: source?.topic ?? undefined,
    learningObjectives: source?.learningObjectives ?? undefined,
    wishes: source?.wishes ?? undefined,
    hintIds: source?.hintIds && source.hintIds.length > 0 ? source.hintIds : undefined,
    language: source?.language ?? fallbackLanguage,
    presentCount: source?.presentCount ?? undefined,
    absentCount: source?.absentCount ?? undefined,
  };
}

/**
 * Повторная генерация сохранённого КСП (Н1): раздел, тему, цели и счётчики берём из
 * сохранённого документа — учитель мог их поправить, — а пожелания из последней задачи.
 */
export function regenerateRequest(document: KspDocument, lastSource?: KspJobSource): KspGenerateRequest {
  return {
    section: document.section || undefined,
    topic: document.topic || undefined,
    learningObjectives: document.learningObjectives || undefined,
    wishes: lastSource?.wishes ?? undefined,
    hintIds: lastSource?.hintIds && lastSource.hintIds.length > 0 ? lastSource.hintIds : undefined,
    language: document.language ?? undefined,
    presentCount: document.presentCount ?? undefined,
    absentCount: document.absentCount ?? undefined,
  };
}

/** Подпись «Исходных данных» (Г1, Г2): подсказки словами, потом свой текст. */
export function wishesLabel(source: KspJobSource | undefined, hints: KspContext['hints']): string {
  const labels = (source?.hintIds ?? []).map((id) => hints?.find((hint) => hint.id === id)?.label ?? id);
  const head = labels.join(', ');
  const wishes = source?.wishes?.trim();
  if (head && wishes) return `${head}. ${wishes}`;
  return head || wishes || '';
}

/** Источник значения в «Исходных данных»: совпало с КТП, с темой урока или введено вручную. */
export function originOf(context: KspContext, field: keyof KspTopicSource, value: string | null | undefined): ValueOrigin {
  if (!isBlank(value) && same(value, context.ktp?.[field])) return 'KTP';
  if (!isBlank(value) && same(value, context.lesson?.[field])) return 'LESSON';
  return 'MANUAL';
}

export const ORIGIN_LABEL: Record<ValueOrigin, string> = {
  KTP: 'из КТП',
  LESSON: 'тема урока',
  MANUAL: 'вручную',
};

/** Пустой счётчик — «не известно», а не ноль: в документе поле останется незаполненным. */
export function parseCount(text: string): number | null | 'invalid' {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  const value = Number(trimmed);
  return value <= 10000 ? value : 'invalid';
}

function countText(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

// ---- Редактор (Р1–Р4, С3, Н3) ----

/** Этап с ключом строки: без него перетаскивание путало бы поля соседних этапов. */
export interface EditorStage {
  key: string;
  stage: string;
  minutes: string;
  teacherActions: string;
  studentActions: string;
  assessment: string;
  resources: string;
}

export interface EditorDocument {
  language: string;
  organizationName: string;
  section: string;
  teacherName: string;
  lessonDate: string;
  className: string;
  presentCount: string;
  absentCount: string;
  topic: string;
  learningObjectives: string;
  lessonObjectives: string;
  stages: EditorStage[];
}

let stageSeq = 0;
const stageKey = () => `stage-${++stageSeq}`;

export function toEditor(document: KspDocument | undefined, fallbackLanguage = 'ru'): EditorDocument {
  return {
    language: document?.language ?? fallbackLanguage,
    organizationName: document?.organizationName ?? '',
    section: document?.section ?? '',
    teacherName: document?.teacherName ?? '',
    lessonDate: document?.lessonDate ?? '',
    className: document?.className ?? '',
    presentCount: countText(document?.presentCount),
    absentCount: countText(document?.absentCount),
    topic: document?.topic ?? '',
    learningObjectives: document?.learningObjectives ?? '',
    lessonObjectives: document?.lessonObjectives ?? '',
    stages: (document?.stages ?? []).map(stageToEditor),
  };
}

function stageToEditor(stage: KspStage): EditorStage {
  return {
    key: stageKey(),
    stage: stage.stage ?? '',
    minutes: stage.durationMinutes != null ? String(stage.durationMinutes) : '',
    teacherActions: stage.teacherActions ?? '',
    studentActions: stage.studentActions ?? '',
    assessment: stage.assessment ?? '',
    resources: stage.resources ?? '',
  };
}

export function newStage(): EditorStage {
  return { key: stageKey(), stage: '', minutes: '', teacherActions: '', studentActions: '', assessment: '', resources: '' };
}

/** Документ для `PUT`. Пустой счётчик уходит `undefined` (Jackson читает его как `null`), не нулём. */
export function fromEditor(editor: EditorDocument): KspDocument {
  const present = parseCount(editor.presentCount);
  const absent = parseCount(editor.absentCount);
  return {
    language: editor.language,
    organizationName: editor.organizationName,
    section: editor.section,
    teacherName: editor.teacherName,
    lessonDate: editor.lessonDate || undefined,
    className: editor.className,
    presentCount: typeof present === 'number' ? present : undefined,
    absentCount: typeof absent === 'number' ? absent : undefined,
    topic: editor.topic,
    learningObjectives: editor.learningObjectives,
    lessonObjectives: editor.lessonObjectives,
    stages: editor.stages.map((stage) => {
      const minutes = parseMinutes(stage.minutes);
      return {
        stage: stage.stage,
        durationMinutes: typeof minutes === 'number' ? minutes : undefined,
        teacherActions: stage.teacherActions,
        studentActions: stage.studentActions,
        assessment: stage.assessment,
        resources: stage.resources,
      };
    }),
  };
}

/** Есть ли ручные правки: сравнение того, что уйдёт на сервер, без ключей строк. */
export function sameDocument(a: EditorDocument, b: EditorDocument): boolean {
  return JSON.stringify(fromEditor(a)) === JSON.stringify(fromEditor(b));
}

export function moveStage(stages: EditorStage[], from: number, to: number): EditorStage[] {
  if (from === to || from < 0 || from >= stages.length) return stages;
  const next = stages.slice();
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}

export function parseMinutes(text: string): number | null | 'invalid' {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  const value = Number(trimmed);
  return value >= 1 && value <= 600 ? value : 'invalid';
}

export interface DurationSummary {
  /** Сумма введённого времени. */
  sum: number;
  expected: number;
  /** У всех этапов есть время, а сумма не равна длительности урока (Р2). */
  mismatch: boolean;
  /** Время указано не у всех этапов. */
  incomplete: boolean;
}

/**
 * Сумма времени этапов против длительности урока. То же правило, что `KspWarnings` на
 * бэкенде, но по живому вводу: предупреждение сервера пришло бы только после сохранения.
 * Время само не перераспределяется (ТЗ).
 */
export function durationSummary(stages: EditorStage[], expected: number): DurationSummary {
  const values = stages.map((stage) => parseMinutes(stage.minutes));
  const sum = values.reduce<number>((total, value) => total + (typeof value === 'number' ? value : 0), 0);
  const incomplete = values.some((value) => typeof value !== 'number');
  return { sum, expected, incomplete, mismatch: !incomplete && stages.length > 0 && sum !== expected };
}

export type EditorErrors = Record<string, string>;

/**
 * Подсказка до отправки: то, что сервер всё равно отклонит 422. Ключи — те же пути, что в
 * `details` ответа сервера (`document.topic`, `document.stages[0].stage`), чтобы ошибки обоих
 * источников ложились на одни поля.
 */
export function validateEditor(editor: EditorDocument): EditorErrors {
  const errors: EditorErrors = {};
  if (!editor.topic.trim()) errors['document.topic'] = 'Укажите тему урока';
  if (!editor.learningObjectives.trim()) errors['document.learningObjectives'] = 'Укажите цели обучения';
  if (!editor.lessonObjectives.trim()) errors['document.lessonObjectives'] = 'Укажите цели урока';
  if (editor.stages.length === 0) errors['document.stages'] = 'Добавьте хотя бы один этап урока';
  if (parseCount(editor.presentCount) === 'invalid') errors['document.presentCount'] = 'Целое число от 0 до 10000';
  if (parseCount(editor.absentCount) === 'invalid') errors['document.absentCount'] = 'Целое число от 0 до 10000';
  editor.stages.forEach((stage, index) => {
    if (!stage.stage.trim()) errors[`document.stages[${index}].stage`] = 'Укажите название этапа';
    if (parseMinutes(stage.minutes) === 'invalid') errors[`document.stages[${index}].durationMinutes`] = 'От 1 до 600';
  });
  return errors;
}

/** Ошибки 422 сервера (`details: [{field, message}]`) в те же ключи. */
export function serverFieldErrors(details: unknown): EditorErrors {
  if (!Array.isArray(details)) return {};
  const errors: EditorErrors = {};
  for (const item of details) {
    if (item && typeof item === 'object' && 'field' in item && 'message' in item) {
      errors[String(item.field)] = String(item.message);
    }
  }
  return errors;
}

/** Ошибки этапа по его месту в списке — после перестановки они переезжают вместе с номером. */
export function stageErrors(errors: EditorErrors, index: number) {
  return {
    stage: errors[`document.stages[${index}].stage`],
    minutes: errors[`document.stages[${index}].durationMinutes`],
  };
}

// ---- Экспорт ----

/** Имя файла по правилу сервера (контракт §8): `КСП_{класс}_{дата}.{формат}`. */
export function exportFileName(document: KspDocument | undefined, format: KspExportFormat): string {
  const className = (document?.className ?? '').replace(/[^\p{L}\p{N}_-]/gu, '_');
  return ['КСП', className, document?.lessonDate ?? ''].filter(Boolean).join('_') + '.' + format;
}

export const EXPORT_LABEL: Record<KspExportFormat, string> = { docx: 'Word', pdf: 'PDF' };

// ---- Общее ----

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

function same(a: string | null | undefined, b: string | null | undefined): boolean {
  return !isBlank(a) && !isBlank(b) && (a as string).trim().toLowerCase() === (b as string).trim().toLowerCase();
}
