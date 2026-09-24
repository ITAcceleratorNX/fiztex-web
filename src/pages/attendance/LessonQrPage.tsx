import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarCheck, ChevronLeft, Clock, DoorOpen, LockKeyhole, QrCode, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LessonStatusChip } from '@/components/ui/LessonStatusChip';
import { QrPoster } from '@/components/ui/QrPoster';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useLesson, useLiveAttendanceQr, useOpenAttendanceQr } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import type { AttendanceQrSession } from '@/lib/attendanceQrApi';
import { scopeKey } from '@/lib/attendanceJournalModel';
import type { Lesson } from '@/lib/lessonsApi';
import { ROUTES } from '@/lib/routes';
import { hhmm } from '@/pages/schedule/myWeek';

/**
 * Код урока для класса (Figma 2170:4035).
 *
 * <p><b>Открытие — одно, и только если кода ещё не было.</b> `POST …/qr` и открывает, и
 * перевыпускает: повторный вызов погасил бы код, который класс прямо сейчас сканирует.
 * Поэтому страница сама открывает код лишь в состоянии `NONE`; закрытый код открывается
 * заново только кнопкой (ATTENDANCE-TEACHER-001 §0 п.5).
 *
 * <p><b>Уход со страницы код не гасит</b> — как и уход из листа урока: сбой сети или
 * обновление вкладки не должны обрывать отметку посреди урока. Код умрёт со звонком на
 * сервере. Кнопки «Закрыть» в макете нет, и её здесь нет.
 *
 * <p>Счётчик приходит тем же ответом, а обновляется опросом (`useLiveAttendanceQr`): скан
 * версию листа не двигает, и иначе его не увидеть.
 */
export function LessonQrPage() {
  useDocumentTitle('QR-код урока');
  const toast = useToast();
  const { lessonId } = useParams<{ lessonId: string }>();
  const id = Number(lessonId);
  const validId = Number.isFinite(id) && id > 0 ? id : null;

  const lessonQuery = useLesson(validId);
  const qrQuery = useLiveAttendanceQr(validId);
  const openQr = useOpenAttendanceQr(id);
  const session = qrQuery.data;

  const autoOpened = useRef(false);
  useEffect(() => {
    if (!session || autoOpened.current || openQr.isPending) return;
    if (session.status === 'NONE' && session.canOpen) {
      autoOpened.current = true;
      openQr.mutate(undefined, {
        onError: () => {
          toast.error('Не удалось открыть код');
          void qrQuery.refetch();
        },
      });
    }
  }, [session, openQr, qrQuery, toast]);

  const lesson = lessonQuery.data;
  const monthLink = lesson ? monthJournalLink(lesson) : ROUTES.myAttendanceMonth;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to={ROUTES.myAttendance}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-navy-800"
        >
          <ChevronLeft className="size-4" aria-hidden />К списку уроков
        </Link>
        <Link
          to={monthLink}
          className="inline-flex items-center gap-2 rounded-lg border-1.5 border-slate-200 px-4 py-2 text-13 font-medium text-slate-500 transition hover:bg-slate-50"
        >
          <CalendarCheck className="size-4" aria-hidden />
          Посещаемость за месяц
        </Link>
      </div>

      {lesson && <LessonHeader lesson={lesson} />}

      <section className="flex min-h-96 flex-col items-center justify-center gap-6 py-10">
        <QrBody
          lesson={lesson}
          lessonMissing={lessonQuery.error instanceof ApiError && lessonQuery.error.status === 404}
          session={session}
          error={qrQuery.error}
          loading={qrQuery.isPending}
          openFailed={openQr.isError}
          reopening={openQr.isPending}
          onRetry={() => void qrQuery.refetch()}
          onReopen={() =>
            openQr.mutate(undefined, {
              onError: () => {
                toast.error('Не удалось открыть код');
                void qrQuery.refetch();
              },
            })
          }
        />
      </section>
    </div>
  );
}

/** Figma `lesson-info`: бейдж и время, предмет, класс с подгруппой и кабинет. */
function LessonHeader({ lesson }: { lesson: Lesson }) {
  const audience = [lesson.className ? `${lesson.className} класс` : null, lesson.subgroupName]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-lesson-hero px-6 py-5 text-center">
      <div className="flex items-center gap-3">
        <LessonStatusChip status={lesson.status} temporalStatus={lesson.temporalStatus} />
        <span className="text-sm font-medium text-slate-800">
          {hhmm(lesson.startTime)} – {hhmm(lesson.endTime)}
        </span>
      </div>
      <h1 className="text-2xl font-semibold text-slate-800">{lesson.subjectName}</h1>
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
        {audience && (
          <span className="flex items-center gap-1.5">
            <Users className="size-4" aria-hidden />
            {audience}
          </span>
        )}
        {lesson.room && (
          <span className="flex items-center gap-1.5">
            <DoorOpen className="size-4" aria-hidden />
            Каб. {lesson.room}
          </span>
        )}
      </div>
    </div>
  );
}

function QrBody({
  lesson,
  lessonMissing,
  session,
  error,
  loading,
  openFailed,
  reopening,
  onRetry,
  onReopen,
}: {
  lesson: Lesson | undefined;
  lessonMissing: boolean;
  session: AttendanceQrSession | undefined;
  error: unknown;
  loading: boolean;
  /** Автооткрытие не прошло — повторить его можно только руками, иначе страница зациклится. */
  openFailed: boolean;
  reopening: boolean;
  onRetry: () => void;
  onReopen: () => void;
}) {
  // 404 — урока не видно вовсе, 403 — виден, но показывать код не положено (право то же,
  // что на заполнение листа, attendance-qr-contract §2). Для учителя оба — «не ваш урок».
  if (lessonMissing || (error instanceof ApiError && (error.status === 403 || error.status === 404))) {
    return (
      <Notice icon={<LockKeyhole className="size-7" />} title="Код может показать только учитель этого урока" />
    );
  }
  if (error) return <ErrorBlock message="Не удалось загрузить код" onRetry={onRetry} />;
  if (loading || !session) return <LoadingBlock label="Загружаем код…" />;
  if (session.status === 'NONE' && session.canOpen) {
    return openFailed && !reopening ? (
      <ErrorBlock message="Не удалось открыть код" onRetry={onReopen} />
    ) : (
      <LoadingBlock label="Открываем код…" />
    );
  }

  if (session.status === 'ACTIVE' && session.payload) {
    return (
      <>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-8">
          <QrPoster payload={session.payload} maxSize={280} />
          <p className="text-base font-medium text-slate-500">
            Отсканировали: {session.scannedCount ?? 0} / {session.totalCount ?? 0}
          </p>
        </div>
        {/* В макете «обновляется каждые 30 секунд», но поворота кода на бэкенде нет —
            решено писать правду (ATTENDANCE-TEACHER-001 §0 п.1). */}
        <p className="text-xs text-slate-400">Код действует до конца урока</p>
      </>
    );
  }

  if (lesson?.status === 'CANCELLED') {
    return <Notice icon={<QrCode className="size-7" />} title="Урок отменён — код не показывается" />;
  }
  if (session.status === 'CLOSED' && session.canOpen) {
    return (
      <Notice
        icon={<QrCode className="size-7" />}
        title="Код закрыт"
        action={
          <Button variant="navy" size="sm" loading={reopening} onClick={onReopen}>
            Показать новый код
          </Button>
        }
      />
    );
  }
  if (lesson?.temporalStatus === 'UPCOMING') {
    return (
      <Notice
        icon={<Clock className="size-7" />}
        title={`Код можно показать с начала урока — с ${hhmm(lesson.startTime)}`}
      />
    );
  }
  return <Notice icon={<Clock className="size-7" />} title="Урок закончился — код больше не действует" />;
}

function Notice({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
        {icon}
      </div>
      <p className="max-w-md text-base font-medium text-slate-500">{title}</p>
      {action}
    </div>
  );
}

/**
 * Журнал месяца сразу на классе и месяце этого урока: учитель пришёл сюда из урока, и
 * заставлять его выбирать тот же класс заново незачем.
 */
function monthJournalLink(lesson: Lesson): string {
  if (lesson.classId == null) return ROUTES.myAttendanceMonth;
  const params = new URLSearchParams({
    scope: scopeKey({ classId: lesson.classId, subgroupId: lesson.subgroupId ?? null }),
  });
  if (lesson.date) params.set('month', lesson.date.slice(0, 7));
  return `${ROUTES.myAttendanceMonth}?${params}`;
}
