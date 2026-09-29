import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Paperclip, X } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Field, focusFirstInvalidField, Select, TextArea, TextInput } from '@/components/ui/Field';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Toggle } from '@/components/ui/Toggle';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useFormDraft, useFormDraftStore } from '@/context/FormDraftContext';
import { describeGroupChange, emptyHomeworkValues, groupSnapshot, hasHomeworkChanges, homeworkValues, type HomeworkFormDraft, type HomeworkFormValues } from '@/lib/homeworkDraft';
import { useToast } from '@/context/ToastContext';
import { keys, useLesson } from '@/hooks/queries';
import { lessonsApi, type Lesson } from '@/lib/lessonsApi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { cx, formatWeekdayDayMonth } from '@/lib/format';
import {
  homeworkApi,
  ANSWER_FORMATS,
  type CreateHomeworkInput,
  type DueType,
  type RecipientType,
} from '@/lib/homeworkApi';

/**
 * Варианты срока сдачи (ТЗ HOMEWORK-001 §9). «До следующего урока» стоит между точной
 * датой и «без срока» намеренно: это тот же срок, только выраженный расписанием, а не
 * числом, — момент по нему считает бэкенд при публикации.
 */
const DUE_TYPES: ReadonlyArray<readonly [DueType, string]> = [
  ['EXACT', 'Дата и время'],
  ['NEXT_LESSON', 'До следующего урока'],
  ['NONE', 'Без срока'],
];

/**
 * Создание и редактирование домашнего задания (ТЗ FE-Teacher-002 §2–4, §6.1).
 *
 * Форма одна на оба входа (§2.3). Разница только в источнике контекста:
 *
 * - из урока (`?lessonId=`) предмет, класс, подгруппу и период определяет бэкенд по уроку,
 *   поэтому фронт их не пересылает и не даёт менять — иначе появился бы второй источник
 *   правды о том, к чему относится задание;
 * - без урока учитель выбирает предмет и класс до формы (§2.2), и **никакой урок при этом
 *   не создаётся** — задание живёт само по себе.
 *
 * Материалы прикрепляются после создания: эндпоинт материалов адресует уже существующее
 * задание. Поэтому выбранные файлы копятся локально (их можно убрать до сохранения, §3.2)
 * и уходят на сервер сразу после того, как задание получило id.
 */
export function HomeworkFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const [searchParams] = useSearchParams();
  const lessonId = Number(searchParams.get('lessonId')) || undefined;
  const editId = Number(homeworkId) || undefined;
  const prefilledClassId = mode === 'create' && lessonId == null ? positiveId(searchParams.get('classId')) : undefined;
  const prefilledSubjectId = mode === 'create' && lessonId == null ? positiveId(searchParams.get('subjectId')) : undefined;
  const contextParams = new URLSearchParams();
  if (lessonId != null) contextParams.set('lessonId', String(lessonId));
  if (prefilledClassId != null) contextParams.set('classId', String(prefilledClassId));
  if (prefilledSubjectId != null) contextParams.set('subjectId', String(prefilledSubjectId));

  const standaloneDraftId = prefilledClassId == null && prefilledSubjectId == null
    ? 'standalone'
    : `standalone:${prefilledClassId ?? ''}:${prefilledSubjectId ?? ''}`;
  const draftKey = mode === 'edit' ? `homework:edit:${editId}`
    : `homework:new:${lessonId ?? standaloneDraftId}`;
  return <HomeworkFormSession
    key={draftKey}
    mode={mode}
    lessonId={lessonId}
    editId={editId}
    draftKey={draftKey}
    prefilledClassId={prefilledClassId}
    prefilledSubjectId={prefilledSubjectId}
    contextSearch={contextParams.toString()}
  />;
}

function HomeworkFormSession({ mode, lessonId, editId, draftKey, prefilledClassId, prefilledSubjectId, contextSearch }: {
  mode: 'create' | 'edit'; lessonId?: number; editId?: number; draftKey: string;
  prefilledClassId?: number; prefilledSubjectId?: number; contextSearch: string;
}) {
  const draftStore = useFormDraftStore();
  const { draft, setDraft, clear } = useFormDraft<HomeworkFormDraft>(draftKey, () => {
    const values = { ...emptyHomeworkValues(), classId: prefilledClassId, subjectId: prefilledSubjectId };
    return { values, baseline: values, initialized: mode === 'create', group: null, notice: null,
      error: null, createdId: null, saving: false };
  }, hasHomeworkChanges);
  const { title, description, dueType, answerFormat, antiCheatEnabled, dueAt, recipientType,
    pickedLessonId, tempGroupId, files, subjectId, classId } = draft.values;
  const { error, createdId } = draft;
  const [discardOpen, setDiscardOpen] = useState(false);
  const [validationRequest, setValidationRequest] = useState(0);
  const discardTrigger = useRef<HTMLButtonElement | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const dirty = hasHomeworkChanges(draft);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function setField<K extends keyof HomeworkFormValues>(key: K) {
    return (update: SetStateAction<HomeworkFormValues[K]>) => setDraft((current) => ({
      ...current, values: { ...current.values, [key]: typeof update === 'function'
        ? (update as (value: HomeworkFormValues[K]) => HomeworkFormValues[K])(current.values[key]) : update },
    }));
  }
  const setTitle = setField('title');
  const setDescription = setField('description');
  const setDueType = setField('dueType');
  const setAnswerFormat = setField('answerFormat');
  const setAntiCheatEnabled = setField('antiCheatEnabled');
  const setDueAt = setField('dueAt');
  const setRecipientType = setField('recipientType');
  const setTempGroupId = setField('tempGroupId');
  const setFiles = setField('files');

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  useDocumentTitle(mode === 'edit' ? 'Редактирование задания' : 'Новое домашнее задание');

  const lessonQuery = useLesson(lessonId ?? null);
  const cardQuery = useQuery({
    queryKey: ['homework', 'card', editId],
    queryFn: ({ signal }) => homeworkApi.card(editId as number, signal),
    enabled: mode === 'edit' && editId != null,
    refetchOnMount: 'always',
  });
  const existing = cardQuery.data;

  const fileInput = useRef<HTMLInputElement>(null);

  // Refetches must not overwrite a restored or already edited form.
  useEffect(() => {
    if (!existing || draft.initialized || cardQuery.isFetching) return;
    const values = homeworkValues(existing);
    setDraft((current) => ({ ...current, values, baseline: values, initialized: true }));
  }, [existing, draft.initialized, cardQuery.isFetching, setDraft]);

  const standalone = mode === 'create' && lessonId == null;
  const recipientsLocked = Boolean(existing?.recipients?.locked);

  /**
   * Что учитель вообще может выбрать — берётся из его расписания, а не из школьного
   * справочника: `/api/admin/*` учительскому токену отвечает 401, и общий `request()`
   * считает это концом сессии (см. `routes.ts`). Расписание — единственный доступный
   * учителю источник пары «класс + предмет», и оно покрывает даже того, кто ещё ни
   * одного задания не создавал.
   *
   * Собственные задания добавляются сверху: учитель мог задать ДЗ классу, урок с которым
   * на этой неделе не выпал, и терять такой класс из выбора нельзя.
   */
  const contextQuery = useQuery({
    queryKey: ['homework', 'form', 'context'],
    queryFn: async ({ signal }) => {
      const subjects = new Map<number, string>();
      const classes = new Map<number, string>();

      const week = await lessonsApi.myWeek(undefined, signal);
      for (const lesson of week.lessons ?? []) {
        if (lesson.subjectId != null && lesson.subjectName) subjects.set(lesson.subjectId, lesson.subjectName);
        if (lesson.classId != null && lesson.className) classes.set(lesson.classId, lesson.className);
      }

      const page = await homeworkApi.list({ scope: 'ACTUAL', size: 100 }, signal);
      for (const row of page.content ?? []) {
        if (row.subjectId != null && row.subjectName) subjects.set(row.subjectId, row.subjectName);
        if (row.classId != null && row.className) classes.set(row.classId, row.className);
      }

      const byName = (a: [number, string], b: [number, string]) =>
        a[1].localeCompare(b[1], 'ru', { numeric: true });
      return { subjects: [...subjects].sort(byName), classes: [...classes].sort(byName) };
    },
    enabled: standalone,
    staleTime: 5 * 60_000,
  });
  const prefilledContext = [
    prefilledClassId != null
      ? `класс «${contextQuery.data?.classes.find(([id]) => id === prefilledClassId)?.[1] ?? `№${prefilledClassId}`}»`
      : null,
    prefilledSubjectId != null
      ? `предмет «${contextQuery.data?.subjects.find(([id]) => id === prefilledSubjectId)?.[1] ?? `№${prefilledSubjectId}`}»`
      : null,
  ].filter((part): part is string => part != null);

  /**
   * Уроки, к которым можно привязать задание.
   *
   * Привязка — не украшение: она отличает «задано на этом уроке» от «задано классу вообще»,
   * и от неё зависит, увидит ли задание тот, кто открыл урок в расписании. Раньше её давал
   * только вход с карточки урока, и задание из раздела оставалось ни к чему не привязанным.
   *
   * Берутся уроки самого учителя (`/api/lessons` ролевой), поэтому чужой урок в списке не
   * появится, а бэкенд всё равно проверит право вести этот урок. Предмет отбирается на
   * клиенте: у списка уроков фильтра по предмету нет, а класс сужает выдачу до десятков строк.
   *
   * Окно — две недели назад и месяц вперёд: задание выдают на уроке или сразу после него,
   * а «привязать к уроку прошлого месяца» — не рабочий случай, зато длинный список.
   */
  const lessonsQuery = useQuery({
    queryKey: ['homework', 'form', 'lessons', classId, subjectId],
    queryFn: async ({ signal }) => {
      const page = await lessonsApi.list(
        {
          classId: classId as number,
          dateFrom: shiftedDate(-14),
          dateTo: shiftedDate(30),
          status: 'ACTIVE',
          size: 100,
        },
        signal,
      );
      return (page.content ?? []).filter((lesson) => lesson.subjectId === subjectId);
    },
    enabled: standalone && classId != null && subjectId != null,
    staleTime: 5 * 60_000,
  });
  const lessons = lessonsQuery.data ?? [];

  /**
   * Предвыбор — ближайший по времени урок, а не первый в списке: задание заводят на уроке
   * или сразу после него, поэтому «ближайший» бывает и сегодняшним прошедшим, и завтрашним.
   * Выбор остаётся видимым и меняемым — включая «без привязки».
   */
  useEffect(() => {
    if (!standalone || !lessonsQuery.isSuccess || lessonsQuery.isFetching) return;
    if (pickedLessonId != null && !lessons.some((lesson) => lesson.id === pickedLessonId)) {
      setDraft((current) => ({ ...current, values: { ...current.values, pickedLessonId: undefined, lessonChoiceMade: true },
        notice: 'Выбранный урок больше недоступен. Выберите другой урок или оставьте задание без привязки. Остальные поля сохранены.' }));
      return;
    }
    if (draft.values.lessonChoiceMade) return;
    if (pickedLessonId != null || lessons.length === 0) return;
    const now = Date.now();
    const nearest = [...lessons].sort((a, b) => Math.abs(startMs(a) - now) - Math.abs(startMs(b) - now))[0];
    setDraft((current) => ({ ...current, values: { ...current.values, pickedLessonId: nearest?.id } }));
  }, [standalone, lessonsQuery.isSuccess, lessonsQuery.isFetching, lessons, pickedLessonId, draft.values.lessonChoiceMade, setDraft]);

  function changeContext(patch: Partial<HomeworkFormValues>) {
    setDraft((current) => ({ ...current, group: null, notice: null,
      values: { ...current.values, ...patch, pickedLessonId: undefined, lessonChoiceMade: false,
        recipientType: 'CLASS', tempGroupId: undefined } }));
  }

  /** Урок задания: из адреса (вход с карточки урока) либо выбранный в форме. */
  const contextLesson = lessonQuery.data ?? lessons.find((lesson) => lesson.id === pickedLessonId);
  const attachedLessonId = lessonId ?? pickedLessonId;

  // Apply the lesson default only once for a new untouched form. A manual choice
  // of the whole class must survive navigation and query refetches.
  const defaultRecipientsApplied = useRef(draftStore.get(draftKey) != null);
  useEffect(() => {
    if (mode !== 'create' || !contextLesson || defaultRecipientsApplied.current) return;
    defaultRecipientsApplied.current = true;
    if (contextLesson.subgroupId && recipientType === 'CLASS') {
      setDraft((current) => ({ ...current,
        values: { ...current.values, recipientType: 'SUBGROUP' },
        baseline: { ...current.baseline, recipientType: 'SUBGROUP' },
      }));
    }
  }, [mode, contextLesson, recipientType, setDraft]);

  /**
   * Временные группы уже существующего класса (§3.1). Здесь только выбор из готовых —
   * собирать и менять состав групп полагается отдельному экрану, и новой логики
   * назначения получателей этот список не создаёт.
   */
  const targetClassId = standalone ? classId : lessonQuery.data?.classId ?? existing?.classId;
  const targetSubjectId = standalone ? subjectId : lessonQuery.data?.subjectId ?? existing?.subjectId;
  const groupsQuery = useQuery({
    queryKey: ['homework', 'form', 'groups', targetClassId, targetSubjectId],
    queryFn: ({ signal }) => homeworkApi.listGroups(targetClassId as number, targetSubjectId, signal),
    enabled: targetClassId != null && !recipientsLocked,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const groups = groupsQuery.data ?? [];

  useEffect(() => {
    if (recipientsLocked && existing) {
      const savedType = existing.recipients?.type ?? 'CLASS';
      const savedGroup = existing.recipients?.tempGroupId;
      if (recipientType !== savedType || tempGroupId !== savedGroup) {
        setDraft((current) => ({ ...current, values: { ...current.values, recipientType: savedType, tempGroupId: savedGroup },
          notice: 'По заданию появились ответы: получатели закрыты для изменения. Восстановлен сохранённый состав; текст и срок сохранены.' }));
      }
      return;
    }
    if (recipientType !== 'TEMP_GROUP' || tempGroupId == null || !groupsQuery.isSuccess || groupsQuery.isFetching) return;
    const group = groups.find((item) => item.id === tempGroupId && item.status !== 'ARCHIVED');
    if (!group) {
      setDraft((current) => ({ ...current, values: { ...current.values, tempGroupId: undefined }, group: null,
        notice: `Группа «${current.group?.name ?? `№${tempGroupId}`}» больше недоступна. Выберите получателей заново. Остальные поля сохранены.` }));
      return;
    }
    const next = groupSnapshot(group);
    if (JSON.stringify(next) === JSON.stringify(draft.group)) return;
    const change = draft.group?.id === next.id ? describeGroupChange(draft.group, next) : null;
    setDraft((current) => ({ ...current, group: next,
      notice: next.count === 0 ? `В группе «${next.name}» нет учеников. Выберите других получателей.` : change ?? current.notice }));
  }, [recipientsLocked, existing, recipientType, tempGroupId, groupsQuery.isSuccess, groupsQuery.isFetching, groups, draft.group, setDraft]);

  const hasAnswers = Boolean(existing?.hasAnswers);

  const valid = title.trim().length > 0 && description.trim().length > 0
    // Дату вводят только у точного срока: «без срока» её не имеет, а «до следующего
    // урока» получает момент от бэкенда при публикации.
    && (dueType !== 'EXACT' || dueAt.length > 0)
    && (!standalone || (subjectId != null && classId != null))
    && (recipientsLocked || recipientType !== 'SUBGROUP' || !!(contextLesson?.subgroupId || existing?.recipients?.subgroupId))
    && (recipientsLocked || recipientType !== 'TEMP_GROUP' || (groupsQuery.isSuccess && !groupsQuery.isFetching
      && groups.some((group) => group.id === tempGroupId && group.status !== 'ARCHIVED' && (group.studentCount ?? 1) > 0)));

  const validationErrors = {
    subject: validationRequest > 0 && standalone && subjectId == null ? 'Выберите предмет' : undefined,
    schoolClass: validationRequest > 0 && standalone && classId == null ? 'Выберите класс' : undefined,
    title: validationRequest > 0 && !title.trim() ? 'Укажите название задания' : undefined,
    description: validationRequest > 0 && !description.trim() ? 'Заполните инструкцию ученику' : undefined,
    dueAt: validationRequest > 0 && dueType === 'EXACT' && !dueAt ? 'Укажите дату и время сдачи' : undefined,
    recipient: validationRequest > 0 && !recipientsLocked && recipientType === 'SUBGROUP'
      && !(contextLesson?.subgroupId || existing?.recipients?.subgroupId)
      ? 'Подгруппа урока недоступна. Выберите других получателей.'
      : undefined,
    tempGroup: validationRequest > 0 && !recipientsLocked && recipientType === 'TEMP_GROUP'
      ? !tempGroupId
        ? 'Выберите временную группу'
        : groupsQuery.isError
          ? 'Не удалось проверить группу. Повторите проверку.'
          : !groupsQuery.isSuccess || groupsQuery.isFetching
            ? 'Дождитесь загрузки списка групп'
            : !groups.some((group) => group.id === tempGroupId && group.status !== 'ARCHIVED' && (group.studentCount ?? 1) > 0)
              ? 'Группа недоступна или в ней нет учеников'
              : undefined
      : undefined,
  };

  useEffect(() => {
    if (validationRequest > 0) focusFirstInvalidField(formRef.current);
  }, [validationRequest]);

  /**
   * Создание всегда даёт черновик, и публикации здесь нет намеренно.
   *
   * <p>Раньше главной кнопкой формы была «Опубликовать», и задание уходило классу прямо
   * из неё — до того, как учитель увидел его карточку. А ровно там и происходит всё
   * остальное: генерация текста и вопросов моделью, их проверка и правка. Публиковать в
   * момент, когда проверять ещё нечего, — значит отправлять ученикам непрочитанное.
   *
   * <p>У теста это к тому же невозможно: без вопросов бэкенд его не публикует, а вопросы
   * добавляются на карточке. Кнопка «Опубликовать» в форме для половины случаев была
   * обещанием, которое она не могла выполнить.
   */
  const save = useMutation({
    mutationFn: async () => {
      setDraft((current) => ({ ...current, error: null }));
      if (mode === 'edit' && editId != null) {
        const updated = await homeworkApi.update(editId, {
          title: title.trim(),
          description: description.trim(),
          dueType,
          dueAt: dueType === 'EXACT' ? new Date(dueAt).toISOString() : undefined,
          answerFormat,
          antiCheatEnabled,
        });
        const recipientsChanged =
          existing?.recipients?.type !== recipientType
          || (existing?.recipients?.tempGroupId ?? undefined) !== tempGroupId;
        if (!recipientsLocked && recipientsChanged) {
          await homeworkApi.setRecipients(editId, {
            type: recipientType,
            tempGroupId: recipientType === 'TEMP_GROUP' ? tempGroupId : undefined,
          });
        }
        await uploadFiles(editId);
        return updated;
      }

      const input: CreateHomeworkInput = {
        // Привязка к уроку — единственный источник контекста: класс, предмет, подгруппу и
        // период бэкенд берёт из урока (§3.1), и слать их рядом значило бы спорить с ним.
        lessonId: attachedLessonId,
        classId: attachedLessonId == null ? classId : undefined,
        subjectId: attachedLessonId == null ? subjectId : undefined,
        title: title.trim(),
        description: description.trim(),
        recipientType,
        tempGroupId: recipientType === 'TEMP_GROUP' ? tempGroupId : undefined,
        dueType,
        dueAt: dueType === 'EXACT' ? new Date(dueAt).toISOString() : undefined,
        answerFormat,
        antiCheatEnabled,
      };
      const created = await homeworkApi.create(input);
      setDraft((current) => ({ ...current, createdId: created.id ?? null }));
      await uploadFiles(created.id as number);
      return created;
    },
    onSuccess: (result) => {
      clear();
      void queryClient.invalidateQueries({ queryKey: ['homework'] });
      // Карточка урока под ключ `homework` не попадает, а состояние её блока ДЗ
      // изменилось: черновик или публикация закрывают «пока не указано», публикация
      // вдобавок снимает отметку «ДЗ не задано». Возврат в урок идёт сразу отсюда,
      // и без сброса он показал бы прежнее состояние.
      if (attachedLessonId != null) {
        void queryClient.invalidateQueries({ queryKey: keys.lesson(attachedLessonId) });
      }
      toast.success(
        mode === 'edit'
          ? 'Изменения сохранены'
          : 'Черновик создан — проверьте задание и опубликуйте его',
      );
      // Возврат туда, откуда пришли (§4.1): из урока — в урок, иначе — в карточку задания.
      if (!mounted.current) return;
      if (mode === 'create' && lessonId) navigate(`/lesson-schedule/lessons/${lessonId}`);
      else navigate(`/homework/${result.id}`);
    },
    onError: (err) => {
      setDraft((current) => ({ ...current, saving: false, error: err instanceof ApiError ? err.message : 'Не удалось сохранить задание' }));
    },
  });

  async function uploadFiles(id: number) {
    for (const file of files) {
      await homeworkApi.addMaterialFile(id, file);
      // Keep only pending attachments if a later upload fails.
      setDraft((current) => ({ ...current, values: { ...current.values, files: current.values.files.filter((item) => item !== file) } }));
    }
  }

  function saveForm() {
    if (draftStore.get<HomeworkFormDraft>(draftKey)?.saving || createdId != null) return;
    if (!valid) {
      setValidationRequest((request) => request + 1);
      return;
    }
    setDraft((current) => ({ ...current, saving: true, error: null }));
    save.mutate();
  }

  if (mode === 'edit' && cardQuery.isPending) return <LoadingBlock label="Загрузка задания…" />;
  if (mode === 'edit' && !draft.initialized && cardQuery.isFetching) return <LoadingBlock label="Загрузка задания…" />;
  if (mode === 'edit' && (cardQuery.isError || !existing)) {
    return (
      <div className="card">
        <ErrorBlock message="Не удалось загрузить задание" onRetry={() => void cardQuery.refetch()} />
      </div>
    );
  }
  if (mode === 'edit' && existing && existing.status !== 'DRAFT' && existing.status !== 'PUBLISHED') {
    return (
      <div className="card">
        <EmptyBlock
          title="Задание нельзя редактировать"
          description="Завершённые и отменённые задания доступны только для просмотра."
          action={
            <Link to={`/homework/${editId}`} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
              К заданию
            </Link>
          }
        />
      </div>
    );
  }

  const busy = save.isPending || draft.saving;
  const backTo = mode === 'edit' ? `/homework/${editId}` : lessonId ? `/lesson-schedule/lessons/${lessonId}` : '/homework';
  const formUrl = mode === 'edit' ? `/homework/${editId}/edit` : `/homework/new${contextSearch ? `?${contextSearch}` : ''}`;

  return (
    <div ref={formRef} className="flex max-w-4xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link to={backTo} aria-label="Назад" className="text-subtle transition hover:text-ink">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-28 font-bold text-ink">
          {mode === 'edit' ? 'Редактирование задания' : 'Новое домашнее задание'}
        </h1>
      </div>

      <NoticeBar tone="soft">
        При переходах внутри сайта поля и выбранные файлы сохранятся в этой вкладке.
        Обновление страницы или завершение сессии удалит несохранённые изменения.
        {dirty && <span className="mt-1 block font-semibold">Есть несохранённые изменения.</span>}
      </NoticeBar>

      {standalone && prefilledContext.length > 0 && (
        <NoticeBar tone="soft">
          Из фильтров списка подставлены {prefilledContext.join(' и ')}. Проверьте значения ниже — их можно изменить.
        </NoticeBar>
      )}

      {draft.notice && <NoticeBar tone="soft">{draft.notice}</NoticeBar>}

      {/* Контекст задания: из урока он определён и неизменяем, вне урока — выбирается. */}
      {lessonId ? (
        <div className="rounded-xl bg-neutral-bg/60 px-4 py-3 text-13">
          {lessonQuery.isPending ? (
            <span className="text-subtle">Загрузка урока…</span>
          ) : lessonQuery.data ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <Ctx label="Предмет" value={lessonQuery.data.subjectName} />
              <Ctx
                label="Класс"
                value={
                  lessonQuery.data.subgroupName
                    ? `${lessonQuery.data.className} · ${lessonQuery.data.subgroupName}`
                    : lessonQuery.data.className
                }
              />
              <Ctx label="Дата" value={lessonQuery.data.date} />
            </div>
          ) : (
            <span className="text-subtle">Урок недоступен</span>
          )}
        </div>
      ) : null}

      {mode === 'edit' && hasAnswers && (
        <NoticeBar tone="soft">
          По заданию уже есть ответы учеников. Изменения увидят все получатели, а отправленные
          работы сохранятся.
        </NoticeBar>
      )}

      <fieldset disabled={busy} className="card flex min-w-0 flex-col gap-4 p-5">
        {standalone && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Предмет" required error={validationErrors.subject}>
              <Select
                value={subjectId != null ? String(subjectId) : ''}
                onChange={(event) => changeContext({ subjectId: Number(event.target.value) || undefined })}
                disabled={contextQuery.isPending}
              >
                <option value="">Выберите предмет</option>
                {(contextQuery.data?.subjects ?? []).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Класс" required error={validationErrors.schoolClass}>
              <Select
                value={classId != null ? String(classId) : ''}
                onChange={(event) => changeContext({ classId: Number(event.target.value) || undefined })}
                disabled={contextQuery.isPending}
              >
                <option value="">Выберите класс</option>
                {(contextQuery.data?.classes ?? []).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {standalone && (
          <Field label="Урок">
            <Select
              value={pickedLessonId != null ? String(pickedLessonId) : ''}
              onChange={(event) => {
                const id = Number(event.target.value) || undefined;
                setDraft((current) => ({ ...current, values: { ...current.values, pickedLessonId: id, lessonChoiceMade: true } }));
              }}
              disabled={classId == null || subjectId == null || lessonsQuery.isPending}
            >
              <option value="">Без привязки к уроку</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lessonOptionLabel(lesson)}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-11 text-subtle">
              {classId == null || subjectId == null
                ? 'Выберите класс и предмет — уроки подставятся из вашего расписания.'
                : lessonsQuery.isPending
                  ? 'Загружаем уроки…'
                  : lessons.length === 0
                    ? 'Уроков этого предмета в ближайшие недели нет — задание останется без привязки.'
                    : 'Привязанное задание видно на карточке урока. Без привязки оно попадёт на урок только по сроку сдачи.'}
            </p>
          </Field>
        )}

        <Field label="Название ДЗ" required error={validationErrors.title}>
          <TextInput
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Параграф 12, упражнения 1–5"
            maxLength={300}
          />
        </Field>

        {/*
          Тип выбирается до вопросов, а не после: описание есть у обоих — это текст задания,
          — а различается то, чем отвечает ученик. Переключение теста с вопросами обратно
          бэкенд не даст, и об этом сказано здесь же, чтобы отказ не был сюрпризом.
        */}
        <Field label="Как ученик отвечает" required>
          <SegmentedTabs
            value={answerFormat}
            options={ANSWER_FORMATS}
            onChange={setAnswerFormat}
            ariaLabel="Как ученик отвечает"
          />
          <p className="mt-1.5 text-11 text-muted">
            {answerFormat === 'TEST'
              ? 'Ученик отвечает на вопросы в приложении. Вопросы добавляются на карточке задания.'
              : 'Ученик присылает текст, фотографии решения и файлы.'}
          </p>
          {mode === 'edit' && (existing?.questionCount ?? 0) > 0 && answerFormat === 'TEST' && (
            <p className="mt-1.5 text-11 text-muted">
              Чтобы перевести задание в работу текстом, сначала удалите вопросы.
            </p>
          )}
        </Field>

        {/*
          Античит стоит сразу под типом работы, потому что от типа зависит, что он вообще
          делает: у теста это наблюдение за выходами из окна, у работы текстом — только
          защита содержимого от скриншотов. Подпись меняется вместе с типом, чтобы учитель
          не включал то, чего не будет.
        */}
        <Field label="Античит">
          <Toggle
            checked={antiCheatEnabled}
            onChange={setAntiCheatEnabled}
            label="Следить за прохождением"
            description={
              answerFormat === 'TEST'
                ? 'Приложение отметит переключения окна и попытки скриншота во время теста.'
                : 'Приложение отметит попытки сделать скриншот текста задания.'
            }
          />
          <p className="mt-1.5 text-11 text-muted">
            События видны при проверке работы. Тест не прерывается, оценка не меняется —
            решение остаётся за вами.
          </p>
        </Field>

        {/*
          Поле одно, но означает разное, и подпись обязана это показывать. У работы текстом
          здесь само задание. У теста — только инструкция к нему: сама работа лежит в
          вопросах, и подпись «Описание задания» читалась как второй способ задать ДЗ —
          учитель видел тест и текстовую работу в одной форме, хотя тип выбран один.

          Убрать поле у теста нельзя: без него задание не публикуется, и ученик открывает
          тест, не зная ни темы, ни того, чем можно пользоваться.
        */}
        <Field
          label={answerFormat === 'TEST' ? 'Инструкция к тесту' : 'Описание и инструкция ученику'}
          required
          error={validationErrors.description}
        >
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={
              answerFormat === 'TEST'
                ? 'Что за тест, сколько времени занимает, чем можно пользоваться…'
                : 'Подробно опишите задание, что нужно сделать…'
            }
            rows={answerFormat === 'TEST' ? 3 : 5}
            maxLength={4000}
          />
          <p className="mt-1.5 text-11 text-muted">
            {answerFormat === 'TEST'
              ? 'Сама работа — это вопросы: они добавляются на карточке задания после создания.'
              : 'Ученик присылает ответ текстом, фотографиями и файлами.'}
          </p>
        </Field>

        <div>
          <p className="label-base">Материалы учителя</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {files.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="inline-flex items-center gap-1.5 rounded bg-neutral-bg px-2 py-1 text-11 text-neutral-fg"
              >
                <Paperclip className="size-3" aria-hidden />
                {file.name}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Убрать ${file.name}`}
                  className="text-subtle transition hover:text-ink"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
              Прикрепить файл
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              // Список читается ДО сброса значения. `setFiles` с функцией-обновителем
              // вызывает её при рендере, а не на месте, и к тому моменту `event.target.files`
              // у обнулённого инпута уже пуст — файл молча терялся, и «Прикрепить файл»
              // выглядел неработающим. Сброс нужен, чтобы повторный выбор того же файла
              // снова дал `change`.
              const picked = Array.from(event.target.files ?? []);
              event.target.value = '';
              setFiles((prev) => [...prev, ...picked]);
            }}
          />
          <p className="mt-1 text-11 text-subtle">
            Файлы загрузятся после сохранения задания. Ограничения по типу и размеру проверяет сервер.
          </p>
        </div>

        <div>
          <p className="label-base" id="due-type-label">
            Срок сдачи
          </p>
          {/*
            Выбранный срок — фирменный оранжевый (`brand-500`, он же `--color-brand-orange`
            из Figma), а не белая пилюля: белое на светло-сером здесь читалось как «ничего
            не выбрано», и учитель отправлял задание не с тем сроком, который думал.

            Это не {@link SegmentedTabs}: там переключают выборку данных и по макету
            остаётся белая пилюля. Здесь выбирают значение поля — отсюда и радиогруппа,
            и другой акцент.
          */}
          <div
            role="radiogroup"
            aria-labelledby="due-type-label"
            className="mt-1.5 inline-flex gap-1 rounded-xl bg-neutral-bg p-1"
          >
            {DUE_TYPES.map(([value, label]) => {
              const selected = dueType === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setDueType(value)}
                  className={cx(
                    'rounded-lg px-4 py-2 text-13 transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50',
                    selected
                      ? 'bg-brand-500 font-semibold text-white shadow-sm'
                      : 'font-medium text-muted hover:bg-surface hover:text-ink',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {dueType === 'EXACT' && (
            <Field label="Дата и время сдачи" required error={validationErrors.dueAt} className="mt-2 max-w-xs">
              <TextInput
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="h-10 w-64 text-13"
              />
            </Field>
          )}
          {dueType === 'NEXT_LESSON' && (
            <p className="mt-2 max-w-prose text-11 text-subtle">
              Дату подставит сервер при публикации — по ближайшему уроку этого предмета
              в классе. Точную дату видно на карточке задания после публикации; если урока
              впереди не окажется, сервер попросит выбрать дату или вариант без срока.
            </p>
          )}
        </div>

        <Field label="Получатели" error={validationErrors.recipient}>
          <Select
            value={recipientType}
            onChange={(event) => {
              defaultRecipientsApplied.current = true;
              setRecipientType(event.target.value as RecipientType);
            }}
            disabled={recipientsLocked}
          >
            <option value="CLASS">Весь класс</option>
            {(contextLesson?.subgroupId || existing?.recipients?.subgroupId || recipientType === 'SUBGROUP') && (
              <option value="SUBGROUP">Подгруппа урока</option>
            )}
            {(groups.length > 0 || recipientType === 'TEMP_GROUP') && <option value="TEMP_GROUP">Временная группа</option>}
          </Select>

          {recipientType === 'SUBGROUP' && !lessonQuery.isPending && !contextLesson?.subgroupId && !existing?.recipients?.subgroupId && (
            <p className="mt-1 text-11 text-subtle">Подгруппа урока больше недоступна. Выберите других получателей. Остальные поля сохранены.</p>
          )}

          {!recipientsLocked && groupsQuery.isError && (
            <ErrorBlock message="Не удалось проверить группы. Введённые данные сохранены." onRetry={() => void groupsQuery.refetch()} />
          )}
          {recipientType === 'TEMP_GROUP' && groupsQuery.isFetching && (
            <p className="mt-1 text-11 text-subtle">Проверяем актуальный состав группы…</p>
          )}

          {recipientType === 'TEMP_GROUP' && (
            <Field label="Временная группа" required error={validationErrors.tempGroup} className="mt-2">
              <Select
                value={tempGroupId != null ? String(tempGroupId) : ''}
                onChange={(event) => setTempGroupId(Number(event.target.value) || undefined)}
                disabled={recipientsLocked}
              >
                <option value="">Выберите группу</option>
                {groups.map((group) => (
                  // Подпись собирается строкой: `Select` читает `children` через `String()`,
                  // и массив узлов превратился бы в «Группа, · 0 уч.» с лишней запятой.
                  <option key={group.id} value={group.id}>
                    {group.studentCount != null
                      ? `${group.name} · ${group.studentCount} уч.`
                      : group.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {/* Группы заводятся для пары «класс + предмет», поэтому экран открывается с ними. */}
          {targetClassId != null && targetSubjectId != null && !recipientsLocked && (
            <Link
              to={`/homework/groups?classId=${targetClassId}&subjectId=${targetSubjectId}${
                editId ? `&homeworkId=${editId}` : ''
              }&returnTo=${encodeURIComponent(formUrl)}`}
              onClick={(event) => { if (busy) event.preventDefault(); }}
              aria-disabled={busy}
              className="mt-1.5 inline-block text-11 font-medium text-link hover:underline"
            >
              {groups.length > 0 ? 'Настроить группы' : 'Разделить класс на группы'}
            </Link>
          )}

          {recipientsLocked ? (
            <p className="mt-1 text-11 text-subtle">
              Состав получателей закрыт: по заданию уже есть ответы.
            </p>
          ) : existing?.recipients?.totalCount ? (
            <p className="mt-1 text-11 text-subtle">
              Сейчас получателей: {existing.recipients.totalCount}
            </p>
          ) : null}
        </Field>
      </fieldset>

      {error && (
        <NoticeBar tone="solid">
          {createdId != null
            ? `Черновик создан, но материалы приложить не удалось. ${error}`
            : error}
          {/* Черновик уже есть — выход из этого состояния один, и он в главной кнопке
              внизу. Вторая кнопка с тем же словом только спрашивала бы, чем они разные. */}
          {createdId == null && (
            <button
              type="button"
              onClick={saveForm}
              className="ml-2 font-semibold underline"
            >
              Повторить
            </button>
          )}
        </NoticeBar>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {dirty && (
          <Button variant="ghost" disabled={busy} onClick={(event) => {
            discardTrigger.current = event.currentTarget;
            setDiscardOpen(true);
          }}>
            Удалить локальный черновик
          </Button>
        )}
        <Link to={backTo} className={buttonClassName({ variant: 'secondary' })}>
          Вернуться позже
        </Link>
        {/* Черновик уже заведён, а упали материалы — тогда главная кнопка ведёт в него, а не
            создаёт второе задание. Ссылка в баннере говорит то же самое; расходиться им нельзя. */}
        {createdId != null ? (
          <Button onClick={() => navigate(`/homework/${createdId}`)}>Открыть черновик</Button>
        ) : (
          <Button onClick={saveForm} loading={busy}>
            {mode === 'edit' ? 'Сохранить' : 'Создать черновик'}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={discardOpen}
        onClose={() => { setDiscardOpen(false); discardTrigger.current?.focus(); }}
        onConfirm={() => { clear(); setDiscardOpen(false); navigate(backTo); }}
        title="Удалить несохранённые изменения?"
        message="Введённые поля и ещё не загруженные файлы будут удалены из этой вкладки. Данные, уже сохранённые на сервере, останутся."
        confirmLabel="Удалить изменения"
        cancelLabel="Продолжить редактирование"
        danger
      />
    </div>
  );
}

function Ctx({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-subtle">{label}:</span>
      <span className="font-medium text-ink">{value}</span>
    </span>
  );
}

function positiveId(value: string | null): number | undefined {
  if (value == null) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/** Дата в местной зоне со сдвигом в днях — граница окна выбора уроков. */
function shiftedDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('sv-SE');
}

/** Начало урока моментом: у списка есть `startsAt`, у старых ответов — только дата и время. */
function startMs(lesson: Lesson): number {
  const value = lesson.startsAt ?? `${lesson.date}T${lesson.startTime ?? '00:00:00'}`;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** «21 авг, пт · 08:00 · Подгруппа A» — по чему учитель узнаёт свой урок в списке. */
function lessonOptionLabel(lesson: Lesson): string {
  const day = lesson.date ? formatWeekdayDayMonth(lesson.date) : '';
  const time = lesson.startTime ? lesson.startTime.slice(0, 5) : '';
  return [day, time, lesson.subgroupName].filter(Boolean).join(' · ');
}
