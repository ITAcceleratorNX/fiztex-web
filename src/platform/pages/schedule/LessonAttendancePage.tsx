import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Clock, EyeOff, Info, LockKeyhole, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CollapsibleCard } from '@/components/ui/CollapsibleCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import {
  useAttendanceHistory,
  useAttendanceSheet,
  useLesson,
  useMarkAllPresent,
  usePublishAttendance,
  useSaveAttendanceDraft,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import {
  ATTENDANCE_ERRORS,
  affectedCountFrom,
  unmarkedIdsFrom,
  type AttendanceEntryChange,
  type AttendanceMarking,
  type AttendanceReason,
  type AttendanceStatus,
} from '@/lib/attendanceApi';
import {
  NOT_MARKED,
  describeAttendanceHistory,
  isMarked,
  sameMarking,
  sheetBadge,
  withComment,
  withMarkToggled,
  withReason,
  withStatus,
} from '@/lib/attendanceModel';
import { cx, formatDateTime } from '@/lib/format';
import { AttendanceTable, type AttendanceRow } from './AttendanceTable';
import { LessonDatePicker } from './LessonDatePicker';
import { hhmm } from './lessonHistory';

const COMMENT_MAX = 500;

/**
 * Лист посещаемости урока (Figma «Посещаемость», node 2086:5291 и соседние состояния).
 *
 * <b>Просмотр и правка — режимы одного экрана</b>, как в макете: лист открывается на
 * чтение, «Редактировать» включает управление. Так открытие урока не выглядит
 * приглашением что-то в нём поменять, а случайный клик по чипу не меняет отметку
 * у живых данных класса.
 *
 * <b>Что разрешено, решает бэкенд.</b> `canFill` и `canPublish` приходят
 * посчитанными (`attendance-read-contract.md` §4): страница не проверяет ни время
 * урока, ни отмену, ни роль — иначе кнопка и сервер разошлись бы в понимании одного
 * правила, и первым это увидел бы пользователь с неактивной кнопкой.
 *
 * <b>Админ здесь полноправен.</b> Учебную часть урока он не правит (LESSON-002 §5.1),
 * но посещаемость — правит: этого требует ATTENDANCE-001 §19, и роль автора уходит
 * в аудит.
 */
export function LessonAttendancePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const id = Number(lessonId);
  const validId = Number.isFinite(id) && id > 0 ? id : null;

  // Идентификатор из адресной строки может быть не числом — до бэкенда такой урок
  // не доходит, и ждать от него ответа нечего.
  if (validId === null) return <NoAccessState onBack={() => navigate('/lesson-schedule')} />;

  // `key` — не украшение: при переходе на другую дату того же занятия роут остаётся
  // прежним, компонент не размонтируется, и несохранённые правки уехали бы на
  // соседний урок. Состав класса там тот же самый, так что перепутанные строки
  // никак не проявились бы до сохранения.
  return <AttendanceSheetScreen key={validId} lessonId={validId} />;
}

function AttendanceSheetScreen({ lessonId: id }: { lessonId: number }) {
  const navigate = useNavigate();
  const validId = id;

  const lessonQuery = useLesson(validId);
  const sheetQuery = useAttendanceSheet(validId);
  const lesson = lessonQuery.data;
  const sheet = sheetQuery.data;

  const canSeeHistory = Boolean(
    lesson?.capabilities?.some(
      (capability) => capability === 'VIEW_TEACHER_HISTORY' || capability === 'VIEW_ADMIN_HISTORY',
    ),
  );
  const historyQuery = useAttendanceHistory(validId, canSeeHistory);

  const saveDraft = useSaveAttendanceDraft(id);
  const publish = usePublishAttendance(id);
  const markAll = useMarkAllPresent(id);

  const [editing, setEditing] = useState(false);
  // Правки живут отдельно от листа: лист правят несколько человек, и слить своё в
  // общую копию значило бы потерять признак того, что именно нужно отправить.
  const [drafts, setDrafts] = useState<Record<number, AttendanceMarking>>({});
  const [unmarked, setUnmarked] = useState<ReadonlySet<number>>(new Set());
  const [conflict, setConflict] = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [commentFor, setCommentFor] = useState<number | null>(null);

  const rows: AttendanceRow[] = useMemo(() => {
    const entries = sheet?.entries ?? [];
    return entries.map((entry) => ({
      studentProfileId: entry.studentProfileId as number,
      fullName: entry.fullName ?? '',
      marking: drafts[entry.studentProfileId as number] ?? entry.draft ?? NOT_MARKED,
    }));
  }, [sheet, drafts]);

  const savedByStudent = useMemo(() => {
    const map = new Map<number, AttendanceMarking>();
    for (const entry of sheet?.entries ?? []) {
      map.set(entry.studentProfileId as number, entry.draft ?? NOT_MARKED);
    }
    return map;
  }, [sheet]);

  const changed: AttendanceEntryChange[] = rows
    .filter((row) => !sameMarking(row.marking, savedByStudent.get(row.studentProfileId)))
    .map((row) => ({
      studentProfileId: row.studentProfileId,
      status: (row.marking.status ?? 'NOT_MARKED') as AttendanceStatus,
      mark: row.marking.mark ?? undefined,
      reason: row.marking.reason ?? undefined,
      comment: row.marking.comment ?? undefined,
    }));
  const dirty = changed.length > 0;

  // Счётчик по строкам, а не по `sheet.markedCount`: пока правки не сохранены,
  // серверный счётчик отстаёт, и «Опубликовать» вело бы себя не так, как выглядит.
  const markedCount = rows.filter((row) => isMarked(row.marking)).length;
  const totalCount = rows.length;

  if (lessonQuery.isPending || sheetQuery.isPending) return <AttendanceSkeleton />;

  const denied =
    (lessonQuery.error instanceof ApiError && lessonQuery.error.status === 404) ||
    (sheetQuery.error instanceof ApiError &&
      (sheetQuery.error.status === 403 || sheetQuery.error.status === 404));
  if (denied) return <NoAccessState onBack={() => navigate(lessonPath(id))} />;
  if (sheetQuery.isError || !sheet || !lesson) {
    return <LoadFailedState onRetry={() => void sheetQuery.refetch()} />;
  }

  const cancelled = lesson.status === 'CANCELLED' || sheet.state === 'ANNULLED';
  const canFill = Boolean(sheet.canFill);
  const busy = saveDraft.isPending || publish.isPending || markAll.isPending;
  // Заполнять нельзя, а урок ещё не начался — единственная причина, о которой стоит
  // сказать: она пройдёт сама. Остальные («нет прав», «урок отменён») уже названы
  // бейджем и телом страницы.
  const notStartedYet = !canFill && !cancelled && lesson.temporalStatus === 'UPCOMING';
  const meta = [
    [lesson.className, lesson.subgroupName].filter(Boolean).join(' · '),
    lesson.room ? `Каб. ${lesson.room}` : null,
    (lesson.substituteTeacher ?? lesson.teacher)?.fullName,
  ].filter(Boolean);

  function editRow(studentProfileId: number, apply: (marking: AttendanceMarking) => AttendanceMarking) {
    setDrafts((prev) => ({
      ...prev,
      [studentProfileId]: apply(
        prev[studentProfileId] ?? savedByStudent.get(studentProfileId) ?? NOT_MARKED,
      ),
    }));
    // Ответ на «опубликуйте полный лист» снимается с того, кого только что отметили,
    // а не со всех сразу.
    setUnmarked((prev) => {
      if (!prev.has(studentProfileId)) return prev;
      const next = new Set(prev);
      next.delete(studentProfileId);
      return next;
    });
  }

  /**
   * Разбор отказа. Три кода — не сбой, а состояние экрана: у каждого свой ответ, и
   * показать их одинаковым «что-то пошло не так» значило бы спрятать подсказку,
   * которую бэкенд уже дал.
   */
  function handleFailure(error: unknown) {
    if (!(error instanceof ApiError)) {
      setActionError('Не удалось сохранить посещаемость');
      return;
    }
    switch (error.code) {
      case ATTENDANCE_ERRORS.versionConflict:
      case ATTENDANCE_ERRORS.sheetConflict:
        setConflict(error.message);
        return;
      case ATTENDANCE_ERRORS.incomplete:
        setUnmarked(new Set(unmarkedIdsFrom(error.details)));
        setActionError(error.message);
        return;
      case ATTENDANCE_ERRORS.bulkOverwrite:
        setBulkConfirm(affectedCountFrom(error.details));
        return;
      default:
        setActionError(error.message);
    }
  }

  function accept() {
    setDrafts({});
    setUnmarked(new Set());
    setConflict(null);
    setBulkConfirm(null);
    setActionError(null);
  }

  async function onSaveDraft(): Promise<number | null> {
    if (!dirty) return sheet?.version ?? null;
    setActionError(null);
    try {
      const saved = await saveDraft.mutateAsync({
        entries: changed,
        expectedVersion: sheet?.version ?? null,
      });
      accept();
      return saved.version ?? null;
    } catch (error) {
      handleFailure(error);
      return null;
    }
  }

  /**
   * Публикация всегда идёт от сохранённого черновика: бэкенд публикует то, что лежит
   * в листе, а не то, что видно на экране. Поэтому несохранённые правки сначала
   * уходят черновиком — иначе «Опубликовать» опубликовало бы прошлую версию, ничего
   * об этом не сказав.
   */
  async function onPublish() {
    const version = await onSaveDraft();
    if (dirty && version === null) return;
    setActionError(null);
    try {
      await publish.mutateAsync({ expectedVersion: version });
      accept();
      setEditing(false);
    } catch (error) {
      handleFailure(error);
    }
  }

  async function onMarkAll(confirmOverwrite: boolean) {
    setActionError(null);
    try {
      await markAll.mutateAsync({
        expectedVersion: sheet?.version ?? null,
        confirmOverwrite,
      });
      accept();
    } catch (error) {
      handleFailure(error);
    }
  }

  /** Чужие правки забираются целиком: слить их молча нельзя, а решать за человека,
   *  чья версия важнее, — тем более. Свои несохранённые при этом теряются осознанно. */
  async function onRefresh() {
    accept();
    await sheetQuery.refetch();
  }

  const commentRow = rows.find((row) => row.studentProfileId === commentFor) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to={lessonPath(id)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:text-navy-800"
        >
          <ArrowLeft className="size-4" />К уроку
        </Link>
        {/* Переключатель дат того же занятия: посещаемость смотрят и за прошлые
            недели, а уходить ради этого в расписание — терять контекст урока. */}
        <LessonDatePicker
          lesson={lesson}
          onPick={(nextLessonId) =>
            navigate(`/lesson-schedule/lessons/${nextLessonId}/attendance`)
          }
        />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-lesson-hero p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-lg font-bold text-slate-900">{lesson.subjectName}</h1>
            <span className="shrink-0 rounded-md bg-slate-200 px-2.5 py-1 text-11 font-bold text-slate-600">
              {sheetBadge(sheet, { cancelled })}
            </span>
            <LessonTimingBadge cancelled={cancelled} temporalStatus={lesson.temporalStatus} />
          </div>
          <span className="shrink-0 text-sm font-semibold text-slate-600">
            {hhmm(lesson.startTime)} – {hhmm(lesson.endTime)}
          </span>
        </div>
        {meta.length > 0 && <p className="text-13 text-slate-600">{meta.join(' · ')}</p>}
      </section>

      {/* Порядок не косметический: конфликт блокирует работу, восстановление
          объясняет, почему лист снова черновик, напоминание — самое общее из трёх. */}
      {conflict ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-navy-100 bg-navy-50 px-4 py-3">
          <span className="flex min-w-0 items-center gap-3">
            <Info className="size-5 shrink-0 text-navy-700" />
            <span className="text-13 font-medium text-navy-700">{conflict}</span>
          </span>
          <Button variant="secondary" size="sm" onClick={() => void onRefresh()}>
            Обновить
          </Button>
        </div>
      ) : cancelled ? (
        <NoticeBar tone="solid" icon={<EyeOff className="size-5" />}>
          Урок отменён — посещаемость недоступна
          {lesson.cancellationComment ? ` · Причина: ${lesson.cancellationComment}` : ''}
        </NoticeBar>
      ) : sheet.restoredAt ? (
        <NoticeBar icon={<AlertTriangle className="size-4 text-brand-600" />}>
          Урок восстановлен — посещаемость требует повторной публикации
        </NoticeBar>
      ) : dirty ? (
        <NoticeBar icon={<AlertTriangle className="size-4 text-brand-600" />}>
          Сохраните черновик или опубликуйте посещаемость
        </NoticeBar>
      ) : sheet.reminder ? (
        <NoticeBar icon={<AlertTriangle className="size-4 text-brand-600" />}>
          Заполните посещаемость по текущему уроку
        </NoticeBar>
      ) : null}

      {actionError && (
        <p className="rounded-xl bg-danger-bg px-4 py-3 text-13 font-semibold text-red-600">
          {actionError}
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-raised">
        <div className="flex min-h-[28px] items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">Список учеников</h2>
          {editing && canFill && totalCount > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => void onMarkAll(false)} disabled={busy}>
              Все присутствуют
            </Button>
          ) : (
            totalCount > 0 && (
              <span className="text-13 font-semibold text-slate-500">
                Отмечено {markedCount} из {totalCount}
              </span>
            )
          )}
        </div>

        {notStartedYet && (
          <p className="rounded-lg bg-slate-100 px-4 py-2.5 text-13 font-medium text-slate-600">
            Отметка станет доступна с начала урока
          </p>
        )}

        {cancelled ? (
          <EmptyBody icon={<EyeOff className="size-12" />} framed={false}>
            {sheet.state === 'ANNULLED'
              ? 'Ранее опубликованные данные скрыты от ученика и родителя, но сохранены в истории.'
              : 'Урок отменён — посещаемость по нему не заполняется.'}
          </EmptyBody>
        ) : totalCount === 0 ? (
          <EmptyBody icon={<Users className="size-8" />} title="В уроке отсутствуют ученики.">
            Проверьте состав класса или подгруппы у Admin.
          </EmptyBody>
        ) : (
          <AttendanceTable
            rows={rows}
            editable={editing && canFill}
            highlighted={unmarked}
            onStatusChange={(studentId, status) =>
              editRow(studentId, (marking) => withStatus(marking, status))
            }
            onMarkToggle={(studentId) => editRow(studentId, withMarkToggled)}
            onReasonChange={(studentId, reason: AttendanceReason | null) =>
              editRow(studentId, (marking) => withReason(marking, reason))
            }
            onCommentOpen={setCommentFor}
          />
        )}
      </section>

      {!cancelled && (
        <div className="flex items-center justify-between gap-4">
          {editing ? (
            <>
              <Button variant="secondary" onClick={() => void onSaveDraft()} disabled={!dirty || busy}>
                Сохранить черновик
              </Button>
              <span className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    accept();
                  }}
                  disabled={busy}
                >
                  {dirty ? 'Отменить правки' : 'Выйти из правки'}
                </Button>
                <Button
                  onClick={() => void onPublish()}
                  loading={publish.isPending}
                  disabled={busy || totalCount === 0 || markedCount !== totalCount}
                >
                  Опубликовать
                </Button>
              </span>
            </>
          ) : (
            <>
              <span />
              <Button
                variant="secondary"
                onClick={() => setEditing(true)}
                disabled={!canFill || totalCount === 0}
              >
                Редактировать
              </Button>
            </>
          )}
        </div>
      )}

      <CollapsibleCard
        icon={<Clock className="size-[18px] text-slate-900" />}
        title={`История изменений${historyQuery.data ? ` (${historyQuery.data.totalElements ?? 0})` : ''}`}
        disabled={!canSeeHistory}
        defaultOpen
      >
        {historyQuery.isPending ? (
          <p className="py-3 text-13 text-slate-400">Загружаем журнал…</p>
        ) : historyQuery.isError ? (
          <p className="py-3 text-13 text-slate-500">Не удалось загрузить историю изменений</p>
        ) : (historyQuery.data?.content ?? []).length === 0 ? (
          <p className="py-3 text-13 text-slate-400">Изменений пока не было</p>
        ) : (
          <ul className="flex flex-col">
            {(historyQuery.data?.content ?? []).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 border-b border-slate-200 py-2.5 last:border-b-0"
              >
                <span className="min-w-0 text-13 text-slate-900">
                  {describeAttendanceHistory(entry)}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleCard>

      <CommentModal
        row={commentRow}
        editable={editing && canFill}
        onClose={() => setCommentFor(null)}
        onSave={(value) => {
          if (commentFor != null) editRow(commentFor, (marking) => withComment(marking, value));
          setCommentFor(null);
        }}
      />

      <ConfirmDialog
        open={bulkConfirm != null}
        title="Все присутствуют?"
        message={
          <>
            Все индивидуальные отметки будут заменены на «Присутствовал». Продолжить?
            {bulkConfirm ? (
              <span className="mt-2 block text-slate-500">
                Затронуто отметок: {bulkConfirm}
              </span>
            ) : null}
          </>
        }
        confirmLabel="Продолжить"
        loading={markAll.isPending}
        onClose={() => setBulkConfirm(null)}
        onConfirm={() => void onMarkAll(true)}
      />
    </div>
  );
}

function lessonPath(lessonId: number): string {
  return `/lesson-schedule/lessons/${lessonId}`;
}

/** Бейдж времени урока из шапки: отмена важнее времени — «прошёл» на ней врало бы. */
function LessonTimingBadge({
  cancelled,
  temporalStatus,
}: {
  cancelled: boolean;
  temporalStatus: string | undefined;
}) {
  const badge = cancelled
    ? { label: 'Отменён', className: 'bg-cancelled-bg text-cancelled-fg' }
    : temporalStatus === 'ONGOING'
      ? { label: 'Идёт сейчас', className: 'bg-brand-500 text-white' }
      : temporalStatus === 'FINISHED'
        ? { label: 'Прошёл', className: 'bg-slate-200 text-slate-600' }
        : temporalStatus === 'UPCOMING'
          ? { label: 'Предстоящий', className: 'bg-slate-200 text-slate-600' }
          : null;
  if (!badge) return null;
  return (
    <span className={cx('shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold', badge.className)}>
      {badge.label}
    </span>
  );
}

/**
 * Тело вместо таблицы (Figma `empty-state-info`). Не `CenteredState` с кнопкой
 * «Повторить»: повторять нечего, страница рабочая — в ней просто нет списка.
 */
function EmptyBody({
  icon,
  title,
  framed = true,
  children,
}: {
  icon: React.ReactNode;
  title?: string;
  framed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center">
      {framed ? (
        <span className="flex size-16 items-center justify-center rounded-full bg-neutral-bg text-slate-400">
          {icon}
        </span>
      ) : (
        <span className="text-slate-400">{icon}</span>
      )}
      <span className="flex max-w-state-text-wide flex-col gap-2">
        {title && <span className="text-base font-bold text-slate-600">{title}</span>}
        <span className="text-13 text-slate-400">{children}</span>
      </span>
    </div>
  );
}

/**
 * Комментарий к отметке. Отдельным окном, а не полем в строке: 500 символов в
 * ячейку таблицы не помещаются, а в макете на их месте стоит иконка.
 */
function CommentModal({
  row,
  editable,
  onClose,
  onSave,
}: {
  row: AttendanceRow | null;
  editable: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  const [openedFor, setOpenedFor] = useState<number | null>(null);

  // Каждое открытие начинается с актуального значения: окно переиспользуется всеми
  // строками, а состояние в нём одно.
  if (row && openedFor !== row.studentProfileId) {
    setOpenedFor(row.studentProfileId);
    setValue(row.marking.comment ?? '');
  }
  if (!row && openedFor !== null) setOpenedFor(null);

  return (
    <Modal
      open={row != null}
      onClose={onClose}
      title={row?.fullName ?? 'Комментарий'}
      subtitle="Комментарий к отметке"
      size="sm"
      footer={
        editable ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={() => onSave(value)}>Сохранить</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        )
      }
    >
      <textarea
        className="input-base min-h-[120px] w-full resize-y"
        maxLength={COMMENT_MAX}
        readOnly={!editable}
        value={value}
        placeholder={editable ? 'Например: предупредил заранее' : 'Комментария нет'}
        onChange={(event) => setValue(event.target.value)}
      />
      {editable && (
        <p className="mt-2 text-right text-xs text-slate-400">
          {value.length}/{COMMENT_MAX}
        </p>
      )}
    </Modal>
  );
}

function AttendanceSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Загрузка посещаемости">
      <div className="h-4 w-72 rounded bg-slate-200" />
      <div className="h-24 rounded-2xl bg-slate-200/70" />
      <div className="h-96 rounded-2xl bg-slate-200/50" />
      <div className="h-20 rounded-2xl bg-slate-200/50" />
    </div>
  );
}

function CenteredState({
  icon,
  title,
  description,
  action,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
  tone: 'neutral' | 'danger';
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-40 text-center">
      <div
        className={cx(
          'flex size-20 items-center justify-center rounded-full',
          tone === 'danger' ? 'bg-danger-bg text-red-500' : 'bg-slate-100 text-slate-400',
        )}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-lg font-bold text-slate-900">{title}</p>
        <p className="max-w-state-text-wide text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function NoAccessState({ onBack }: { onBack: () => void }) {
  return (
    <CenteredState
      tone="neutral"
      icon={<LockKeyhole className="size-8" />}
      title="У вас нет доступа к посещаемости этого урока"
      description="Лист видят администратор и учителя урока."
      action={
        <Button variant="secondary" onClick={onBack}>
          Вернуться к уроку
        </Button>
      }
    />
  );
}

function LoadFailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <CenteredState
      tone="danger"
      icon={<AlertTriangle className="size-8" />}
      title="Не удалось загрузить посещаемость"
      description="Попробуйте обновить страницу"
      action={
        <Button variant="secondary" onClick={onRetry}>
          Повторить
        </Button>
      }
    />
  );
}
