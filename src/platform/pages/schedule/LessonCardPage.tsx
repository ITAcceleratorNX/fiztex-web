import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  ArrowLeft,
  BookOpen,
  Clock,
  DoorOpen,
  LockKeyhole,
  Lock,
  Paperclip,
  PencilLine,
  RefreshCw,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { ChangedChip } from '@/components/ui/ChangedChip';
import { CollapsibleCard } from '@/components/ui/CollapsibleCard';
import { LessonStatusChip } from '@/components/ui/LessonStatusChip';
import { ModuleTile, type ModuleTileTone } from '@/components/ui/ModuleTile';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { useAttendanceSheet, useLesson, useLessonHistory, useLessonHomework } from '@/hooks/queries';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import type { AttendanceSheet } from '@/lib/attendanceApi';
import { cx, formatDateTime, formatWeekdayDayMonth, pluralRu } from '@/lib/format';
import type { Homework } from '@/lib/homeworkApi';
import type { Lesson, LessonCapability } from '@/lib/lessonsApi';
import { LessonHomeworkRows } from '@/pages/homework/LessonHomeworkRows';
import { describeHistoryActor, describeHistoryEntry, hhmm } from './lessonHistory';

/**
 * Куда возвращает «К расписанию». У учителя это его собственный экран: админский
 * конструктор читает `/api/admin/*` и под учителем рвёт сессию (см. `routes.ts`).
 */
function schedulePathFor(role: string | undefined): string {
  return role === 'TEACHER' ? ROUTES.mySchedule : '/lesson-schedule';
}

/**
 * Карточка конкретного урока в расписании (Figma 2067:9326 и состояния 9487…10178).
 *
 * Экран показывает <b>фактический</b> урок на дату, а не слот расписания: время,
 * кабинет, предмет и учитель здесь уже с учётом разовых изменений и замены.
 *
 * Права не вычисляются на фронте: что можно делать с уроком, приходит в
 * `capabilities`. Поэтому админ тему и комментарий видит, но не правит (ТЗ §5.1) —
 * карандаши появляются только у того, кто ведёт урок.
 */
export function LessonCardPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const id = Number(lessonId);
  const lessonQuery = useLesson(Number.isFinite(id) && id > 0 ? id : null);
  const { admin } = useAuth();
  const schedulePath = schedulePathFor(admin?.role);

  const lesson = lessonQuery.data;
  const canSeeHistory = hasAny(lesson, ['VIEW_ADMIN_HISTORY', 'VIEW_TEACHER_HISTORY']);
  const historyQuery = useLessonHistory(id, Boolean(lesson) && canSeeHistory);

  if (lessonQuery.isPending) return <LessonCardSkeleton />;

  // 404 на уроке означает «нет связи с уроком» — знание id доступа не даёт (ТЗ §6.12).
  if (lessonQuery.error instanceof ApiError && lessonQuery.error.status === 404) {
    return <NoAccessState />;
  }
  if (lessonQuery.isError || !lesson) {
    return <LoadFailedState onRetry={() => void lessonQuery.refetch()} />;
  }

  const changed = new Set(lesson.changedFields ?? []);
  const canEditTeaching = hasAny(lesson, ['EDIT_TEACHING_PART']);
  const periodClosed = lesson.academicPeriodStatus != null && lesson.academicPeriodStatus !== 'ACTIVE';
  const historyRows = historyQuery.data?.content ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to={schedulePath}
          className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:text-navy-800"
        >
          <ArrowLeft className="size-4" />
          К расписанию
        </Link>
        <span className="text-sm font-medium text-slate-600">
          {formatWeekdayDayMonth(lesson.date)}
        </span>
      </div>

      {periodClosed && (
        <NoticeBar tone="solid" icon={<Lock className="size-5" />}>
          Учебный период закрыт — только просмотр
        </NoticeBar>
      )}

      <LessonHero lesson={lesson} changed={changed} />

      <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
        <TeachingField
          label="Тема урока"
          editable={canEditTeaching && !periodClosed}
          empty={!lesson.topic}
          emptyLabel="Тема не указана"
        >
          <p className="text-base font-semibold text-slate-900">{lesson.topic}</p>
        </TeachingField>

        <hr className="border-slate-200" />

        <TeachingField
          label="Комментарий для учеников"
          editable={canEditTeaching && !periodClosed}
          empty={!lesson.comment?.body}
          emptyLabel="Комментария пока нет"
        >
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {lesson.comment?.body}
          </p>
        </TeachingField>

        {lesson.comment?.createdByName && (
          <>
            <hr className="border-slate-200" />
            <p className="text-xs text-slate-400">
              {lesson.comment.createdByName} · изменено {formatDateTime(lesson.comment.updatedAt)}
            </p>
          </>
        )}
      </section>

      <LessonHomeworkCard
        lesson={lesson}
        canManage={canEditTeaching}
        canCreate={canEditTeaching && !periodClosed}
      />

      <LessonModules lesson={lesson} />

      <CollapsibleCard
        icon={<Clock className="size-[18px] text-slate-900" />}
        title={`История изменений${historyRows.length > 0 ? ` (${historyRows.length})` : ''}`}
        disabled={!canSeeHistory}
        defaultOpen
      >
        {historyQuery.isPending ? (
          <p className="py-3 text-13 text-slate-400">Загружаем журнал…</p>
        ) : historyQuery.isError ? (
          <p className="py-3 text-13 text-slate-500">Не удалось загрузить историю изменений</p>
        ) : historyRows.length === 0 ? (
          <p className="py-3 text-13 text-slate-400">Изменений пока не было</p>
        ) : (
          <ul className="flex flex-col">
            {historyRows.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1.5 border-b border-slate-200 py-3 last:border-b-0"
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="flex min-w-0 items-start gap-2">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-slate-300" />
                    <span className="text-sm text-slate-900">{describeHistoryEntry(entry)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </span>
                <span className="pl-4 text-xs text-slate-600">{describeHistoryActor(entry)}</span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleCard>
    </div>
  );
}

function LessonHero({ lesson, changed }: { lesson: Lesson; changed: Set<string> }) {
  // При действующей замене урок ведёт заместитель — его и показываем в шапке,
  // а основного учителя называет баннер ниже.
  const acting = lesson.substituteTeacher ?? lesson.teacher;
  const target = [lesson.className, lesson.subgroupName].filter(Boolean).join(' · ');

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-lesson-hero p-8">
      <div className="flex items-center justify-between gap-4">
        <LessonStatusChip status={lesson.status} temporalStatus={lesson.temporalStatus} />
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">
            {hhmm(lesson.startTime)} – {hhmm(lesson.endTime)}
          </span>
          {changed.has('TIME') && <ChangedChip title="Время отличается от расписания" />}
        </span>
      </div>

      <h1 className="text-32 font-extrabold text-slate-900">{lesson.subjectName}</h1>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
        {target && (
          <span className="flex items-center gap-2">
            <Users className="size-4 shrink-0 text-slate-500" />
            {target}
          </span>
        )}
        <span className="flex items-center gap-2">
          <DoorOpen className="size-4 shrink-0 text-slate-500" />
          {lesson.room ? `Каб. ${lesson.room}` : 'Кабинет не указан'}
          {changed.has('ROOM') && <ChangedChip title="Кабинет отличается от расписания" />}
        </span>
        {acting?.fullName && (
          <span className="flex items-center gap-2">
            <User className="size-4 shrink-0 text-slate-500" />
            {acting.fullName}
          </span>
        )}
      </div>

      {lesson.substituteTeacher && lesson.teacher?.fullName && (
        <NoticeBar icon={<RefreshCw className="size-4 text-brand-600" />}>
          Замена вместо {lesson.teacher.fullName}
        </NoticeBar>
      )}

      {lesson.status === 'CANCELLED' && lesson.cancellationComment && (
        <p className="text-13 text-slate-600">
          <span className="font-semibold text-slate-900">Причина отмены:</span>{' '}
          {lesson.cancellationComment}
        </p>
      )}
    </section>
  );
}

function TeachingField({
  label,
  editable,
  empty,
  emptyLabel,
  children,
}: {
  label: string;
  editable: boolean;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-11 font-bold uppercase text-slate-400">{label}</p>
        {empty ? <p className="text-sm text-slate-400">{emptyLabel}</p> : children}
      </div>
      {editable && (
        <button
          type="button"
          title="Редактирование доступно учителю урока"
          className="shrink-0 text-slate-400 transition hover:text-brand-500"
        >
          <PencilLine className="size-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Материалы и оценки — отдельные учебные модули, их на бэкенде ещё нет
 * (LESSON-002 §5.1, §8: capability заведена, модуль вне скоупа). Плитки стоят на
 * своих местах из макета, но не притворяются рабочими переходами.
 *
 * ДЗ из этого списка ушло: модуль реализован (FE-Teacher-002), и плитка ведёт в него.
 */
const PENDING_MODULES: Array<{ title: string; icon: React.ReactNode; tone: ModuleTileTone }> = [
  { title: 'Материалы', icon: <Paperclip className="size-[18px]" />, tone: 'violet' },
  { title: 'Оценки', icon: <Award className="size-[18px]" />, tone: 'blue' },
];

/**
 * Состояние листа строкой на плитке. Счётчик показывается только у черновика: у
 * опубликованного он совпал бы с составом класса и ничего не добавил, а у пустого
 * листа «0 из 25» звучит как ошибка, а не как «ещё не начинали».
 */
function attendanceTileValue(
  sheet: AttendanceSheet | undefined,
  cancelled: boolean,
): string {
  if (cancelled || sheet?.state === 'ANNULLED') return 'Недоступна — урок отменён';
  if (!sheet) return 'Нет доступа';
  if (sheet.state === 'PUBLISHED') {
    return sheet.hasUnpublishedChanges ? 'Есть неопубликованные правки' : 'Опубликована';
  }
  if (sheet.state === 'DRAFT') return `Черновик · ${sheet.markedCount ?? 0} из ${sheet.totalCount ?? 0}`;
  return 'Не заполнена';
}

/**
 * Домашние задания урока прямо на карточке (HOMEWORK-005.1 §4 с фильтром по уроку).
 *
 * По уроку в расписании кликают, чтобы узнать «что задано», — и до сих пор ответом была
 * плитка с постоянной подписью, то есть ещё один переход вслепую. Список здесь короткий и
 * весь про один урок, поэтому живёт на карточке, а не за нажатием.
 *
 * Экран заданий урока никуда не делся: он остаётся местом, где задание создают, и ссылка
 * ведёт туда же, куда вела плитка.
 *
 * Права не вычисляются: `VIEW_STUDENTS` — то самое право, которым бэкенд отличает
 * администратора и учителей урока от ученика с родителем (см. `useLessonHomework`).
 */
function LessonHomeworkCard({
  lesson,
  canManage,
  canCreate,
}: {
  lesson: Lesson;
  canManage: boolean;
  canCreate: boolean;
}) {
  const canRead = hasAny(lesson, ['VIEW_STUDENTS']);
  const query = useLessonHomework(lesson.id ?? null, canRead);
  const rows = query.data ?? [];
  const lessonPath = `/lesson-schedule/lessons/${lesson.id}`;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-11 font-bold uppercase text-slate-400">
          <BookOpen className="size-4 text-slate-400" />
          Домашнее задание
          {rows.length > 0 && <span className="text-slate-500">· {rows.length}</span>}
        </p>
        {canRead && (
          <Link
            to={`${lessonPath}/homework`}
            className="text-13 font-semibold text-navy-700 hover:text-navy-800"
          >
            {canCreate ? 'Все задания и создание' : 'Все задания'}
          </Link>
        )}
      </div>

      {!canRead ? (
        <p className="text-sm text-slate-400">Задания урока видны его учителю и администратору</p>
      ) : query.isPending ? (
        <p className="text-sm text-slate-400">Загружаем задания…</p>
      ) : query.isError ? (
        <p className="flex items-center gap-3 text-sm text-slate-500">
          Не удалось загрузить задания урока
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="font-semibold text-navy-700 underline hover:text-navy-800"
          >
            Повторить
          </button>
        </p>
      ) : rows.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">К этому уроку заданий нет</p>
          {canCreate && (
            <Link
              to={`/homework/new?lessonId=${lesson.id}`}
              className={buttonClassName({ variant: 'secondary', size: 'sm' })}
            >
              Создать задание
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <LessonHomeworkRows rows={rows} lessonId={lesson.id} canOpen={canManage} />
        </div>
      )}
    </section>
  );
}

/**
 * Подпись плитки ДЗ: сколько заданий и сколько из них ещё не опубликовано. Черновик
 * назван отдельно потому, что для учеников его пока не существует — «3 задания» на уроке,
 * где опубликовано одно, ввело бы в заблуждение самого учителя.
 */
function homeworkTileValue(rows: Homework[]): string {
  if (rows.length === 0) return 'Заданий нет';
  const drafts = rows.filter((row) => row.status === 'DRAFT').length;
  const total = `${rows.length} ${pluralRu(rows.length, ['задание', 'задания', 'заданий'])}`;
  return drafts > 0 ? `${total} · ${drafts} в черновике` : total;
}

function LessonModules({ lesson }: { lesson: Lesson }) {
  const navigate = useNavigate();
  const canViewAttendance = hasAny(lesson, ['VIEW_ATTENDANCE']);
  const canReadHomework = hasAny(lesson, ['VIEW_STUDENTS']);
  // Лист запрашивается только при праве на него: без VIEW_ATTENDANCE бэкенд ответит
  // 403, и ходить за гарантированной ошибкой ради выключенной плитки незачем.
  const sheetQuery = useAttendanceSheet(lesson.id ?? null, canViewAttendance);
  // Тот же запрос, что у секции выше: react-query отдаёт обеим один кэш, а не два ответа.
  const homeworkQuery = useLessonHomework(lesson.id ?? null, canReadHomework);

  return (
    <div className="flex flex-wrap items-stretch gap-4">
      <ModuleTile
        icon={<UserCheck className="size-[18px]" />}
        tone="teal"
        title="Посещаемость"
        value={
          !canViewAttendance
            ? 'Нет доступа'
            : sheetQuery.isPending
              ? 'Загружаем…'
              : attendanceTileValue(sheetQuery.data, lesson.status === 'CANCELLED')
        }
        disabled={!canViewAttendance}
        onClick={() => navigate(`/lesson-schedule/lessons/${lesson.id}/attendance`)}
      />
      <ModuleTile
        icon={<BookOpen className="size-[18px]" />}
        tone="orange"
        title="Домашнее задание"
        value={
          !canReadHomework
            ? 'Открыть задания урока'
            : homeworkQuery.isPending
              ? 'Загружаем…'
              : homeworkTileValue(homeworkQuery.data ?? [])
        }
        onClick={() => navigate(`/lesson-schedule/lessons/${lesson.id}/homework`)}
      />
      {PENDING_MODULES.map((module) => (
        <ModuleTile
          key={module.title}
          icon={module.icon}
          tone={module.tone}
          title={module.title}
          value="Модуль в разработке"
          disabled
        />
      ))}
    </div>
  );
}

function LessonCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Загрузка урока">
      <div className="h-4 w-72 rounded bg-slate-200" />
      <div className="h-44 rounded-2xl bg-slate-200/70" />
      <div className="h-56 rounded-2xl bg-slate-200/50" />
      <div className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 flex-1 rounded-2xl bg-slate-200/50" />
        ))}
      </div>
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

function NoAccessState() {
  const navigate = useNavigate();
  const { admin } = useAuth();
  return (
    <CenteredState
      tone="neutral"
      icon={<LockKeyhole className="size-8" />}
      title="У вас нет доступа к этому уроку"
      description="Этот урок относится к другому классу или закреплен за другим преподавателем."
      action={
        <Button variant="secondary" onClick={() => navigate(schedulePathFor(admin?.role))}>
          Вернуться к расписанию
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
      title="Не удалось загрузить урок"
      description="Попробуйте обновить страницу"
      action={
        <Button variant="secondary" onClick={onRetry}>
          Повторить
        </Button>
      }
    />
  );
}

function hasAny(lesson: Lesson | undefined, wanted: LessonCapability[]): boolean {
  const capabilities = lesson?.capabilities;
  if (!capabilities) return false;
  return wanted.some((capability) => capabilities.includes(capability));
}
