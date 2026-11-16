import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Check, ClipboardCheck, Lock, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Select } from '@/components/ui/Select';
import { EmptyBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import {
  useAssessmentLimits,
  useAssessmentResults,
  useCancelAssessmentWork,
  useConductAssessmentWork,
  useCreateAssessmentWork,
  useRescheduleAssessmentWork,
  useRescheduleCandidates,
  useUpdateAssessmentWork,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { AssessmentKind, AssessmentWork } from '@/lib/assessmentWorksApi';
import {
  KIND_LABELS,
  LOCKED_HINT,
  MAX_LOCKED_HINT,
  REMINDER_OPTIONS,
  activeWorks,
  CONDUCTED_MOVE_HINT,
  canCancel,
  canReschedule,
  isLockedByResults,
  kindUnavailableReason,
  maxScoreProblem,
  nextWorkHint,
  reminderLabel,
  workStateLabel,
  workTitle,
} from '@/lib/assessmentWorkModel';
import { formatWeekdayDayMonth } from '@/lib/format';
import type { Lesson } from '@/lib/lessonsApi';
import { hhmm } from './lessonHistory';

/**
 * Работа СОР/СОЧ в карточке урока (Figma `phyztex`, Desktop D2, D4–D11).
 *
 * <p><b>Всё решает сервер:</b> лимиты, «можно ли перенести», статусы и право. Панель показывает
 * недоступное с причиной, а ограничения вроде «после первого балла» берёт из `hasResults`.
 * Статус «Проведена» — только явное действие учителя, от даты урока он не зависит.
 *
 * <p>Учитель управляет работой (`canEdit`), остальные роли видят её только на чтение.
 */
export function AssessmentWorkPanel({ lesson, canEdit }: { lesson: Lesson; canEdit: boolean }) {
  const works = activeWorks(lesson.assessmentWorks);
  const [assignOpen, setAssignOpen] = useState(false);
  const canAssign = canEdit && lesson.status === 'ACTIVE' && lesson.academicPeriodStatus === 'ACTIVE';

  if (works.length === 0) {
    if (!canAssign) return null;
    return (
      <>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-slate-300 px-5 py-4">
          <p className="text-13 text-muted">
            По КТП на этом уроке нет суммативной работы. Назначьте её вручную, если она проходит вне плана.
          </p>
          <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setAssignOpen(true)}>
            Назначить СОР/СОЧ
          </Button>
        </div>
        {assignOpen && <AssignModal lesson={lesson} onClose={() => setAssignOpen(false)} />}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {works.map((work) => (
        <WorkBlock key={work.id} work={work} lesson={lesson} canEdit={canEdit} />
      ))}
    </div>
  );
}

function WorkBlock({ work, lesson, canEdit }: { work: AssessmentWork; lesson: Lesson; canEdit: boolean }) {
  const toast = useToast();
  const conduct = useConductAssessmentWork();
  const update = useUpdateAssessmentWork();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [maxText, setMaxText] = useState(String(work.maxScore ?? ''));
  const [maxError, setMaxError] = useState<string | null>(null);

  const locked = isLockedByResults(work);
  const manage = canEdit && work.id != null;
  // Сколько учеников отмечено — лист результатов; запрашиваем, только когда баллы уже есть.
  const results = useAssessmentResults(manage && locked ? (work.id as number) : null);
  const audience = (results.data?.students ?? []).filter((row) => row.inAudience !== false).length;
  const state = workStateLabel(work);
  const subtitle =
    locked
      ? audience > 0
        ? `Выставлено ${work.resultsCount ?? 0} из ${audience} учеников`
        : `Выставлено баллов: ${work.resultsCount ?? 0}`
      : work.status === 'CONDUCTED'
        ? 'Баллы ещё не выставлены — их вносят в журнале'
        : 'Ученики и родители видят её в расписании';

  async function run(action: () => Promise<unknown>, fallback: string) {
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : fallback);
    }
  }

  async function saveMax() {
    const problem = maxScoreProblem(maxText);
    setMaxError(problem);
    if (problem || Number(maxText) === work.maxScore) return;
    await run(
      () => update.mutateAsync({ workId: work.id as number, maxScore: Number(maxText), expectedVersion: work.version }),
      'Не удалось изменить максимум',
    ).finally(() => setMaxText(String(work.maxScore ?? '')));
  }

  async function saveReminder(days: number) {
    await run(
      () => update.mutateAsync({ workId: work.id as number, reminderDaysBefore: days, expectedVersion: work.version }),
      'Не удалось изменить напоминание',
    );
  }

  const journalLink = `/grades?${new URLSearchParams({
    classId: String(lesson.classId ?? ''),
    subjectId: String(lesson.subjectId ?? ''),
    ...(lesson.subgroupId ? { subgroupId: String(lesson.subgroupId) } : {}),
    periodId: String(lesson.academicPeriodId ?? ''),
  }).toString()}`;

  return (
    <section
      aria-label={`${workTitle(work)}: ${state}`}
      className="flex flex-col gap-4 rounded-xl bg-info-bg p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-navy-700">
            {locked ? <Check className="size-5" /> : <ClipboardCheck className="size-5" />}
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">
              <span className="mr-2 rounded bg-navy-700 px-1.5 py-0.5 text-10 font-bold uppercase text-white">
                {workTitle(work)}
              </span>
              {state === 'Запланирована' ? 'Работа запланирована' : state}
            </p>
            <p className="mt-0.5 text-13 text-muted">{subtitle}</p>
          </div>
        </div>
        {manage && !locked && work.status === 'PLANNED' && (
          <Button
            variant="primary"
            size="sm"
            icon={<Check className="size-4" />}
            loading={conduct.isPending}
            onClick={() => void run(() => conduct.mutateAsync(work.id as number), 'Не удалось отметить проведение')}
          >
            Отметить как проведён
          </Button>
        )}
        {locked && (
          <Link
            to={journalLink}
            className="shrink-0 rounded-lg bg-white px-4 py-2 text-13 font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Открыть в журнале
          </Link>
        )}
      </div>

      {work.needsReschedule && (
        <NoticeBar tone="warning" icon={<TriangleAlert className="size-4" />}>
          Урок работы отменён или изменён. Выберите новый урок — иначе ученики не получат напоминание.
        </NoticeBar>
      )}

      <div className="flex flex-wrap items-stretch gap-3">
        <div className="min-w-[180px] flex-1 rounded-lg bg-white px-4 py-3">
          <p className="text-10 font-bold uppercase text-muted">Максимальный балл</p>
          {manage && !locked ? (
            <>
              <TextInput
                inputMode="numeric"
                aria-label="Максимальный балл"
                aria-invalid={maxError != null}
                className="mt-1 w-24"
                value={maxText}
                disabled={update.isPending}
                onChange={(event) => setMaxText(event.target.value)}
                onBlur={() => void saveMax()}
              />
              {maxError && <p role="alert" className="mt-1 text-11 text-danger-fg">{maxError}</p>}
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold text-slate-900" title={locked ? MAX_LOCKED_HINT : undefined}>
              {work.maxScore}
            </p>
          )}
        </div>
        <div className="min-w-[220px] flex-1 rounded-lg bg-white px-4 py-3">
          <p className="text-10 font-bold uppercase text-muted">Напоминание ученикам и родителям</p>
          {manage && work.status === 'PLANNED' ? (
            <Select
              aria-label="Напоминание ученикам и родителям"
              className="mt-1"
              value={String(work.reminderDaysBefore ?? 1)}
              disabled={update.isPending}
              onChange={(event) => void saveReminder(Number(event.target.value))}
            >
              {REMINDER_OPTIONS.map((option) => (
                <option key={option.days} value={String(option.days)}>{option.label}</option>
              ))}
              {!REMINDER_OPTIONS.some((option) => option.days === work.reminderDaysBefore) && (
                <option value={String(work.reminderDaysBefore)}>{reminderLabel(work.reminderDaysBefore)}</option>
              )}
            </Select>
          ) : (
            <p className="mt-1 text-sm font-semibold text-slate-900">{reminderLabel(work.reminderDaysBefore)}</p>
          )}
        </div>
        {manage && (
          <div className="flex min-w-[190px] flex-col justify-center gap-2">
            {locked ? (
              <p className="flex items-start gap-2 text-13 text-muted" title={LOCKED_HINT}>
                <Lock className="mt-0.5 size-4 shrink-0" />
                {LOCKED_HINT}
              </p>
            ) : (
              <>
                <span className="flex items-center gap-4">
                  {canReschedule(work) && (
                    <Button variant="link" size="inline" onClick={() => setMoveOpen(true)}>Изменить дату</Button>
                  )}
                  {canCancel(work) && (
                    <button
                      type="button"
                      onClick={() => setCancelOpen(true)}
                      className="text-sm font-semibold text-danger-fg hover:underline"
                    >
                      Отменить {KIND_LABELS[work.kind ?? 'SOR']}
                    </button>
                  )}
                </span>
                {!canReschedule(work) && <p className="text-11 text-muted">{CONDUCTED_MOVE_HINT}</p>}
              </>
            )}
          </div>
        )}
      </div>

      {cancelOpen && <CancelModal work={work} onClose={() => setCancelOpen(false)} />}
      {moveOpen && <RescheduleModal work={work} lesson={lesson} onClose={() => setMoveOpen(false)} />}
    </section>
  );
}

/** «Назначить СОР/СОЧ» (D5–D7): вид, максимум, напоминание; недоступное — с причиной. */
function AssignModal({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const create = useCreateAssessmentWork();
  const limitsQuery = useAssessmentLimits(
    lesson.classId != null && lesson.subjectId != null && lesson.academicPeriodId != null
      ? {
          classId: lesson.classId,
          subjectId: lesson.subjectId,
          academicPeriodId: lesson.academicPeriodId,
          subgroupId: lesson.subgroupId,
        }
      : null,
  );
  const limits = limitsQuery.data;
  const sorProblem = kindUnavailableReason('SOR', limits);
  const sochProblem = kindUnavailableReason('SOCH', limits);
  const [chosen, setKind] = useState<AssessmentKind>('SOR');
  // Недоступный вид выбрать нельзя: если выбранный закрыт лимитом, а другой свободен — берём другой.
  const kind: AssessmentKind =
    chosen === 'SOR' && sorProblem && !sochProblem ? 'SOCH' : chosen === 'SOCH' && sochProblem && !sorProblem ? 'SOR' : chosen;
  const [maxText, setMaxText] = useState('20');
  const [reminder, setReminder] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const kindProblem = kind === 'SOR' ? sorProblem : sochProblem;
  const maxProblem = maxScoreProblem(maxText);
  const blocked = kindProblem ?? maxProblem;

  async function save() {
    if (blocked) return;
    setError(null);
    try {
      await create.mutateAsync({
        lessonId: lesson.id as number, kind, maxScore: Number(maxText), reminderDaysBefore: reminder,
      });
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Не удалось назначить работу');
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!create.isPending) onClose();
      }}
      title="Назначить СОР/СОЧ"
      subtitle={[lesson.subjectName, lesson.className, lesson.date ? formatWeekdayDayMonth(lesson.date) : null,
        lesson.lessonNumber ? `${lesson.lessonNumber} урок` : null].filter(Boolean).join(' · ')}
      footer={
        <>
          <Button variant="secondary" disabled={create.isPending} onClick={onClose}>Отмена</Button>
          <Button loading={create.isPending} disabled={blocked != null} onClick={() => void save()}>Сохранить</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-13 text-muted">
          По КТП на этом уроке нет суммативной работы. Назначьте её вручную, если она проходит вне плана.
        </p>
        {limitsQuery.isPending && <LoadingBlock label="Проверяем лимиты…" />}
        <Field label="Тип работы">
          <SegmentedTabs
            ariaLabel="Тип работы"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'SOR', label: 'СОР', disabled: sorProblem != null },
              { value: 'SOCH', label: 'СОЧ', disabled: sochProblem != null },
            ]}
          />
        </Field>
        {(sorProblem || sochProblem) && (
          <NoticeBar tone="warning" icon={<TriangleAlert className="size-4" />}>
            <span className="flex flex-col gap-1">
              {sorProblem && <span>{sorProblem}</span>}
              {sochProblem && <span>{sochProblem}</span>}
            </span>
          </NoticeBar>
        )}
        {nextWorkHint(kind, limits) && <p className="-mt-3 text-11 text-muted">{nextWorkHint(kind, limits)}</p>}
        <Field label="Максимальный балл" error={maxProblem && maxText !== '20' ? maxProblem : undefined}>
          <TextInput inputMode="numeric" className="w-28" value={maxText} onChange={(e) => setMaxText(e.target.value)} />
        </Field>
        <Field label="Напомнить ученикам и родителям">
          <SegmentedTabs
            ariaLabel="Напоминание"
            value={String(reminder)}
            onChange={(next) => setReminder(Number(next))}
            options={REMINDER_OPTIONS.map((option) => ({ value: String(option.days), label: option.label }))}
          />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
      </div>
    </Modal>
  );
}

/** «Отменить СОР» (D9): предупреждение об уведомлении, тема и цели урока из КТП остаются. */
function CancelModal({ work, onClose }: { work: AssessmentWork; onClose: () => void }) {
  const cancel = useCancelAssessmentWork();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const title = KIND_LABELS[work.kind ?? 'SOR'];

  async function confirm() {
    setError(null);
    try {
      await cancel.mutateAsync({
        workId: work.id as number, reason: reason.trim() || undefined, expectedVersion: work.version,
      });
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Не удалось отменить работу');
    }
  }

  return (
    <Modal
      open
      size="sm"
      onClose={() => {
        if (!cancel.isPending) onClose();
      }}
      title={`Отменить ${title}?`}
      footer={
        <>
          <Button variant="secondary" disabled={cancel.isPending} onClick={onClose}>Не отменять</Button>
          <Button variant="danger" loading={cancel.isPending} onClick={() => void confirm()}>Отменить {title}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-slate-600">
        <p>
          Ученики и родители получат уведомление об отмене. Тема и цели урока из КТП останутся,
          колонка работы уйдёт из журнала.
        </p>
        <Field label="Причина (необязательно)">
          <TextArea value={reason} maxLength={500} disabled={cancel.isPending} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
      </div>
    </Modal>
  );
}

/** «Изменить дату» (D8): другой урок той же связки класс — предмет — подгруппа — четверть. */
function RescheduleModal({ work, lesson, onClose }: { work: AssessmentWork; lesson: Lesson; onClose: () => void }) {
  const candidates = useRescheduleCandidates(lesson, true);
  const reschedule = useRescheduleAssessmentWork();
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = (candidates.data?.content ?? [])
    .filter(
      (item) =>
        item.id != null &&
        item.id !== lesson.id &&
        item.status === 'ACTIVE' &&
        item.subjectId === lesson.subjectId &&
        item.academicPeriodId === lesson.academicPeriodId &&
        (item.subgroupId ?? null) === (lesson.subgroupId ?? null),
    )
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

  async function confirm() {
    if (picked == null) return;
    setError(null);
    try {
      await reschedule.mutateAsync({ workId: work.id as number, lessonId: picked, expectedVersion: work.version });
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Не удалось перенести работу');
    }
  }

  return (
    <Modal
      open
      scrollable
      onClose={() => {
        if (!reschedule.isPending) onClose();
      }}
      title="Изменить дату"
      subtitle={`${workTitle(work)} · выберите другой урок ${lesson.subjectName ?? ''} ${lesson.className ?? ''}`.trim()}
      footer={
        <>
          <Button variant="secondary" disabled={reschedule.isPending} onClick={onClose}>Отмена</Button>
          <Button loading={reschedule.isPending} disabled={picked == null} onClick={() => void confirm()}>Перенести</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-13 text-muted">
          Ученики и родители получат уведомление о переносе. Перенос возможен, пока не выставлен ни один балл.
        </p>
        {candidates.isPending ? (
          <LoadingBlock label="Загружаем уроки…" />
        ) : options.length === 0 ? (
          <EmptyBlock icon={<CalendarClock className="size-7" />} title="Нет подходящих уроков" />
        ) : (
          <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Урок для переноса">
            {options.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 has-[:checked]:border-navy-700 has-[:checked]:bg-navy-50">
                  <input
                    type="radio"
                    name="target-lesson"
                    checked={picked === item.id}
                    onChange={() => setPicked(item.id as number)}
                  />
                  <span className="text-sm font-semibold text-slate-900">{formatWeekdayDayMonth(item.date)}</span>
                  <span className="text-13 text-muted">
                    {hhmm(item.startTime)}–{hhmm(item.endTime)}
                    {item.lessonNumber ? ` · ${item.lessonNumber} урок` : ''}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
      </div>
    </Modal>
  );
}
