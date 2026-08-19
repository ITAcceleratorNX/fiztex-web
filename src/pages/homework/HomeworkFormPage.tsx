import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Paperclip, X } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { useToast } from '@/context/ToastContext';
import { useLesson } from '@/hooks/queries';
import { lessonsApi } from '@/lib/lessonsApi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import {
  homeworkApi,
  type CreateHomeworkInput,
  type DueType,
  type RecipientType,
} from '@/lib/homeworkApi';

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

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  useDocumentTitle(mode === 'edit' ? 'Редактирование задания' : 'Новое домашнее задание');

  const lessonQuery = useLesson(lessonId ?? null);
  const cardQuery = useQuery({
    queryKey: ['homework', 'card', editId],
    queryFn: ({ signal }) => homeworkApi.card(editId as number, signal),
    enabled: mode === 'edit' && editId != null,
  });
  const existing = cardQuery.data;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueType, setDueType] = useState<DueType>('EXACT');
  const [dueAt, setDueAt] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('CLASS');
  const [tempGroupId, setTempGroupId] = useState<number>();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Правка начинается с текущих значений, а не с пустой формы.
  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title ?? '');
    setDescription(existing.description ?? '');
    setDueType((existing.dueType as DueType) ?? 'EXACT');
    setDueAt(existing.dueAt ? toLocalInput(existing.dueAt) : '');
    setRecipientType((existing.recipients?.type as RecipientType) ?? 'CLASS');
    setTempGroupId(existing.recipients?.tempGroupId ?? undefined);
  }, [existing]);

  // Задание из урока по умолчанию адресовано подгруппе урока, если она есть.
  useEffect(() => {
    if (mode === 'create' && lessonQuery.data?.subgroupId) setRecipientType('SUBGROUP');
  }, [mode, lessonQuery.data]);

  const standalone = mode === 'create' && lessonId == null;
  const recipientsLocked = Boolean(existing?.recipients?.locked);
  const [subjectId, setSubjectId] = useState<number>();
  const [classId, setClassId] = useState<number>();

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

  /**
   * Временные группы уже существующего класса (§3.1). Здесь только выбор из готовых —
   * собирать и менять состав групп полагается отдельному экрану, и новой логики
   * назначения получателей этот список не создаёт.
   */
  const targetClassId = standalone ? classId : lessonQuery.data?.classId ?? existing?.classId;
  const targetSubjectId = standalone ? subjectId : lessonQuery.data?.subjectId ?? existing?.subjectId;
  const groupsQuery = useQuery({
    queryKey: ['homework', 'form', 'groups', targetClassId],
    queryFn: ({ signal }) => homeworkApi.listGroups(targetClassId as number, undefined, signal),
    enabled: targetClassId != null && !recipientsLocked,
    staleTime: 5 * 60_000,
  });
  const groups = groupsQuery.data ?? [];

  const hasAnswers = Boolean(existing?.hasAnswers);

  const valid = title.trim().length > 0 && description.trim().length > 0
    && (dueType === 'NONE' || dueAt.length > 0)
    && (!standalone || (subjectId != null && classId != null))
    && (recipientType !== 'TEMP_GROUP' || tempGroupId != null);

  /**
   * Одна мутация на «черновик» и «публикацию»: разница только в том, дёргаем ли publish
   * после создания. Пока она в полёте, обе кнопки заблокированы — двойной клик не должен
   * создать второе задание (§4.3, §10).
   */
  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      setError(null);
      if (mode === 'edit' && editId != null) {
        const updated = await homeworkApi.update(editId, {
          title: title.trim(),
          description: description.trim(),
          dueType,
          dueAt: dueType === 'NONE' ? undefined : new Date(dueAt).toISOString(),
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
        lessonId,
        classId: standalone ? classId : undefined,
        subjectId: standalone ? subjectId : undefined,
        title: title.trim(),
        description: description.trim(),
        recipientType,
        tempGroupId: recipientType === 'TEMP_GROUP' ? tempGroupId : undefined,
        dueType,
        dueAt: dueType === 'NONE' ? undefined : new Date(dueAt).toISOString(),
      };
      const created = await homeworkApi.create(input);
      await uploadFiles(created.id as number);
      if (publish) return homeworkApi.publish(created.id as number);
      return created;
    },
    onSuccess: (result, publish) => {
      void queryClient.invalidateQueries({ queryKey: ['homework'] });
      toast.success(
        mode === 'edit' ? 'Изменения сохранены' : publish ? 'Задание опубликовано' : 'Черновик сохранён',
      );
      // Возврат туда, откуда пришли (§4.1): из урока — в урок, иначе — в карточку задания.
      if (mode === 'create' && lessonId) navigate(`/lesson-schedule/lessons/${lessonId}`);
      else navigate(`/homework/${result.id}`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить задание');
    },
  });

  async function uploadFiles(id: number) {
    for (const file of files) {
      await homeworkApi.addMaterialFile(id, file);
    }
  }

  if (mode === 'edit' && cardQuery.isPending) return <LoadingBlock label="Загрузка задания…" />;
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

  const busy = save.isPending;
  const backTo = mode === 'edit' ? `/homework/${editId}` : lessonId ? `/lesson-schedule/lessons/${lessonId}` : '/homework';

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link to={backTo} aria-label="Назад" className="text-subtle transition hover:text-ink">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-28 font-bold text-ink">
          {mode === 'edit' ? 'Редактирование задания' : 'Новое домашнее задание'}
        </h1>
      </div>

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

      <div className="card flex flex-col gap-4 p-5">
        {standalone && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Предмет" required>
              <Select
                value={subjectId != null ? String(subjectId) : ''}
                onChange={(event) => setSubjectId(Number(event.target.value) || undefined)}
                disabled={contextQuery.isPending}
              >
                <option value="">Выберите предмет</option>
                {(contextQuery.data?.subjects ?? []).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Класс" required>
              <Select
                value={classId != null ? String(classId) : ''}
                onChange={(event) => setClassId(Number(event.target.value) || undefined)}
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

        <Field label="Название ДЗ" required>
          <TextInput
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Параграф 12, упражнения 1–5"
            maxLength={300}
          />
        </Field>

        <Field label="Описание и инструкция ученику" required>
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Подробно опишите задание, что нужно сделать…"
            rows={5}
            maxLength={4000}
          />
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
              setFiles((prev) => [...prev, ...Array.from(event.target.files ?? [])]);
              if (fileInput.current) fileInput.current.value = '';
            }}
          />
          <p className="mt-1 text-11 text-subtle">
            Файлы загрузятся после сохранения задания. Ограничения по типу и размеру проверяет сервер.
          </p>
        </div>

        <div>
          <p className="label-base">Срок сдачи</p>
          <div className="mt-1.5 inline-flex gap-1 rounded-xl bg-neutral-bg p-1">
            {([['EXACT', 'Дата и время'], ['NONE', 'Без срока']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={dueType === value}
                onClick={() => setDueType(value)}
                className={cx(
                  'rounded-lg px-4 py-2 text-13 font-medium transition',
                  dueType === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {dueType === 'EXACT' && (
            <input
              type="datetime-local"
              aria-label="Срок сдачи"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className="input-base mt-2 h-10 w-64 text-13"
            />
          )}
        </div>

        <Field label="Получатели">
          <Select
            value={recipientType}
            onChange={(event) => setRecipientType(event.target.value as RecipientType)}
            disabled={recipientsLocked}
          >
            <option value="CLASS">Весь класс</option>
            {(lessonQuery.data?.subgroupId || existing?.recipients?.subgroupId) && (
              <option value="SUBGROUP">Подгруппа урока</option>
            )}
            {groups.length > 0 && <option value="TEMP_GROUP">Временная группа</option>}
          </Select>

          {recipientType === 'TEMP_GROUP' && (
            <Select
              className="mt-2"
              aria-label="Временная группа"
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
          )}
          {/* Группы заводятся для пары «класс + предмет», поэтому экран открывается с ними. */}
          {targetClassId != null && targetSubjectId != null && !recipientsLocked && (
            <Link
              to={`/homework/groups?classId=${targetClassId}&subjectId=${targetSubjectId}${
                editId ? `&homeworkId=${editId}` : ''
              }`}
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
      </div>

      {error && (
        <NoticeBar tone="solid">
          {error}
          <button
            type="button"
            onClick={() => save.mutate(false)}
            className="ml-2 font-semibold underline"
          >
            Повторить
          </button>
        </NoticeBar>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Link to={backTo} className={buttonClassName({ variant: 'secondary' })}>
          Отмена
        </Link>
        {mode === 'edit' ? (
          <Button onClick={() => save.mutate(false)} disabled={!valid} loading={busy}>
            Сохранить
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => save.mutate(false)} disabled={!valid || busy}>
              Сохранить как черновик
            </Button>
            <Button onClick={() => save.mutate(true)} disabled={!valid} loading={busy}>
              Опубликовать
            </Button>
          </>
        )}
      </div>
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

/** `datetime-local` работает с местным временем без зоны, а срок хранится моментом. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
