import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, Clock, Info, Lock, PencilLine, RefreshCw, Send, UserRound, UserX, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CollapsibleCard } from '@/components/ui/CollapsibleCard';
import { Field, TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useAbsenceDayCommand, useMyClassAbsenceDay, type AbsenceDayCommand } from '@/hooks/absenceReasonQueries';
import {
  COMMENT_LIMIT,
  absenceStatusBadge,
  blockerText,
  commandErrorText,
  confirmedSignature,
  dayTitle,
  historyLine,
  isStaleDayError,
  lastRejected,
  lastRequest,
  lessonsCount,
  momentLabel,
  parentSignature,
  pendingResponsesChip,
  pendingResponses,
  quoted,
  relationLabel,
  shortDate,
  timeLabel,
  type AbsenceDay,
  type AbsenceReasonCode,
  type AbsenceResponse,
} from '@/lib/absenceReasonModel';
import { ApiError } from '@/lib/api';
import { REASON_OPTIONS, reasonLabel } from '@/lib/attendanceModel';
import { cx, pluralRu } from '@/lib/format';

type Mode = { kind: 'view' } | { kind: 'set'; initial: AbsenceReasonCode | '' } | { kind: 'reject'; responseId: number };

/** Сколько уроков дня видно сразу (К11, К12): остальные раскрываются ссылкой. */
const VISIBLE_LESSONS = 3;

/**
 * Карточка даты отсутствия (Figma `phyztex` К3–К14): причина, пропущенные уроки, родители и история.
 * Все действия — внутри шторки: форма причины и «что уточнить» открываются в ней же, без окна поверх
 * (заметка дизайнера). Что можно сделать, решает сервер (`actions`): экран только раскладывает
 * кнопки по состоянию дня. `readOnly` — администратор: та же карточка без действий.
 */
export function AbsenceDayDrawer({
  classId,
  className,
  studentProfileId,
  date,
  fallbackName,
  readOnly = false,
  onClose,
}: {
  classId: number;
  className: string;
  studentProfileId: number;
  date: string;
  fallbackName?: string;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const dayQuery = useMyClassAbsenceDay(classId, studentProfileId, date);
  const command = useAbsenceDayCommand(classId, studentProfileId, date);
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [reason, setReason] = useState<AbsenceReasonCode | ''>('');
  const [comment, setComment] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Итог команды — плашкой внутри шторки над подвалом (К5, К6, К8, К10), а не общим тостом:
  // тост в углу экрана ложился бы на кнопки подвала, а речь о дне, который открыт здесь.
  const [notice, setNotice] = useState<string | null>(null);
  const day = dayQuery.data;

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Новый день — новый разговор: форма прошлого дня не должна всплыть под чужим именем.
  useEffect(() => {
    setMode({ kind: 'view' });
    setError(null);
    setNotice(null);
  }, [studentProfileId, date]);

  function openSetForm(initial: AbsenceReasonCode | '') {
    setReason(initial);
    setComment(initial && day?.reason?.reason === initial ? day.reason.comment ?? '' : '');
    setError(null);
    setMode({ kind: 'set', initial });
  }

  function openRejectForm(responseId: number) {
    setRejectComment('');
    setError(null);
    setMode({ kind: 'reject', responseId });
  }

  async function run(next: AbsenceDayCommand, success: (day: AbsenceDay) => string) {
    if (!day) return;
    setError(null);
    setNotice(null);
    try {
      const updated = await command.mutateAsync({ command: next, version: day.version ?? null });
      setMode({ kind: 'view' });
      setNotice(success(updated));
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.code : undefined;
      setError(commandErrorText(code));
      // Состояние на сервере уже другое — показать его, не трогая введённое в форме.
      if (isStaleDayError(code)) void dayQuery.refetch();
    }
  }

  const lessonsText = (updated: AbsenceDay) => {
    const count = updated.absentLessons?.length ?? 0;
    return `${count} ${pluralRu(count, ['пропущенного урока', 'пропущенных уроков', 'пропущенных уроков'])} ${shortDate(date)}`;
  };

  const title = day?.studentName || fallbackName || 'Ученик';
  const subtitle = `${dayTitle(date)}${className ? ` · ${className}` : ''}`;
  const busy = command.isPending;

  let body: ReactNode;
  let footer: ReactNode = null;
  if (dayQuery.isPending) {
    body = <LoadingBlock label="Загружаем день…" />;
  } else if (dayQuery.isError || !day) {
    body = <ErrorBlock message="Не удалось загрузить день отсутствия." onRetry={() => void dayQuery.refetch()} />;
  } else {
    const actions = day.actions ?? {};
    const pending = pendingResponses(day);
    const lessonCount = day.absentLessons?.length ?? 0;
    body = (
      <div className="space-y-3.5">
        {day.periodClosure && (
          <div className="flex items-start gap-2.5 rounded-drawer-card border border-slate-200 bg-slate-50 px-4 py-3 text-13 leading-relaxed text-slate-600">
            <Lock className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              {day.periodClosure.periodName ? `${day.periodClosure.periodName} закрыта` : 'Учебный период закрыт'}.
              {' '}Отметки посещаемости этого дня уже не меняются, а подтвердить или изменить причину можно.
            </span>
          </div>
        )}
        {error && <StatusNotice tone="error">{error}</StatusNotice>}

        {mode.kind === 'set' && !readOnly ? (
          <ReasonForm
            reason={reason}
            comment={comment}
            lessonCount={lessonCount}
            onReason={setReason}
            onComment={setComment}
          />
        ) : (
          <ReasonBlock
            day={day}
            readOnly={readOnly}
            busy={busy}
            rejecting={mode.kind === 'reject' ? mode.responseId : null}
            rejectComment={rejectComment}
            onRejectComment={setRejectComment}
            onConfirm={(response) => void run({ kind: 'confirm', responseId: response.responseId as number },
              (updated) => `Причина подтверждена. Она появилась у ${lessonsText(updated)}`)}
            onReject={(response) => openRejectForm(response.responseId as number)}
          />
        )}

        {lessonCount === 0 ? (
          <StatusNotice tone="info">
            Пропусков в этот день больше нет: учитель исправил отметки. Причина и история дня сохранены.
          </StatusNotice>
        ) : (
          <LessonsCard day={day} />
        )}
        <ParentsSection day={day} />
        {(day.history?.length ?? 0) > 0 && <HistoryCard day={day} />}
      </div>
    );

    if (!readOnly) {
      if (mode.kind === 'set') {
        footer = (
          <>
            <Button variant="secondary" onClick={() => { setMode({ kind: 'view' }); setError(null); }} disabled={busy}>
              Отмена
            </Button>
            <Button
              loading={busy}
              disabled={!reason || comment.length > COMMENT_LIMIT}
              onClick={() => {
                const changing = day.status === 'CONFIRMED';
                void run({ kind: 'set', reason: reason as AbsenceReasonCode, comment: comment.trim() || undefined },
                  (updated) => changing
                    ? `Причина изменена. Она обновилась у ${lessonsText(updated)}`
                    : `Причина сохранена и подтверждена. Она появилась у ${lessonsText(updated)}`);
              }}
            >
              Сохранить
            </Button>
          </>
        );
      } else if (mode.kind === 'reject') {
        footer = (
          <>
            <Button variant="secondary" onClick={() => { setMode({ kind: 'view' }); setError(null); }} disabled={busy}>
              Отмена
            </Button>
            <Button
              loading={busy}
              disabled={rejectComment.length > COMMENT_LIMIT}
              onClick={() => void run({ kind: 'reject', responseId: mode.responseId, comment: rejectComment.trim() || undefined },
                () => 'Ответ отклонён. Родитель увидит, что нужно уточнить причину')}
            >
              Отклонить ответ
            </Button>
          </>
        );
      } else {
        footer = viewFooter(day, pending, actions, busy, {
          set: openSetForm,
          ask: () => void run({ kind: 'ask' }, (updated) => askedText(updated)),
          confirm: (response) => void run({ kind: 'confirm', responseId: response.responseId as number },
            (updated) => `Причина подтверждена. Она появилась у ${lessonsText(updated)}`),
          reject: (response) => openRejectForm(response.responseId as number),
        });
      }
    }
  }

  if (notice) {
    footer = (
      <>
        <div role="status" className="flex basis-full items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-13 font-semibold leading-snug text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" aria-label="Скрыть" onClick={() => setNotice(null)}
            className="shrink-0 rounded text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {footer}
      </>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      placement="right"
      appearance="drawer"
      size="drawer-narrow"
      title={title}
      subtitle={subtitle}
      footer={footer}
    >
      {body}
    </Modal>
  );
}

function askedText(day: AbsenceDay): string {
  const recipients = lastRequest(day)?.recipients ?? [];
  const names = recipients.map((recipient) => recipient.parentName).filter(Boolean);
  if (names.length === 0) return 'Запрос отправлен родителям';
  return `Запрос отправлен. ${names.join(' и ')} ${names.length > 1 ? 'получат' : 'получит'} уведомление в приложении`;
}

/** Кнопки подвала в обычном режиме — по состоянию дня и флагам сервера (заметка «Действия по состоянию»). */
function viewFooter(
  day: AbsenceDay,
  pending: AbsenceResponse[],
  actions: NonNullable<AbsenceDay['actions']>,
  busy: boolean,
  on: {
    set: (initial: AbsenceReasonCode | '') => void;
    ask: () => void;
    confirm: (response: AbsenceResponse) => void;
    reject: (response: AbsenceResponse) => void;
  },
): ReactNode {
  const canSet = Boolean(actions.canSetReason);
  const requestTitle = blockerText(actions.requestBlockedReason);
  const singlePending = pending.length === 1 && day.status === 'AWAITING_CONFIRMATION' ? pending[0] : null;

  if (singlePending) {
    return (
      <>
        {canSet && <Button variant="ghost" onClick={() => on.set('')} disabled={busy}>Указать другую</Button>}
        {actions.canRejectResponses && (
          <Button variant="danger-outline" onClick={() => on.reject(singlePending)} disabled={busy}>Отклонить</Button>
        )}
        {actions.canConfirmResponses && (
          <Button onClick={() => on.confirm(singlePending)} loading={busy}>Подтвердить</Button>
        )}
      </>
    );
  }
  if (day.status === 'CONFIRMED') {
    return canSet ? (
      <Button variant="secondary" icon={<PencilLine className="size-4" />} onClick={() => on.set(day.reason?.reason ?? '')} disabled={busy}>
        Изменить причину
      </Button>
    ) : null;
  }
  if (pending.length > 1) {
    return canSet ? <Button variant="secondary" onClick={() => on.set('')} disabled={busy}>Указать причину</Button> : null;
  }
  if (day.status === 'CLARIFICATION_NEEDED') {
    return (
      <>
        {canSet && <Button variant="secondary" onClick={() => on.set('')} disabled={busy}>Указать причину</Button>}
        <Button
          icon={<RefreshCw className="size-4" />}
          onClick={on.ask}
          loading={busy}
          disabled={!actions.canRequestParent}
          title={requestTitle}
        >
          Повторить запрос
        </Button>
      </>
    );
  }
  return (
    <>
      <Button
        variant="secondary"
        icon={day.status === 'AWAITING_PARENT' ? <RefreshCw className="size-4" /> : <Send className="size-4" />}
        onClick={on.ask}
        disabled={busy || !actions.canRequestParent}
        title={requestTitle}
      >
        {day.status === 'AWAITING_PARENT' ? 'Повторить запрос' : 'Запросить у родителя'}
      </Button>
      {canSet && <Button onClick={() => on.set('')} disabled={busy}>Указать причину</Button>}
    </>
  );
}

const CARD = 'rounded-drawer-card border px-5 py-4';

function StatusBadges({ day }: { day: AbsenceDay }) {
  const badge = absenceStatusBadge(day.status);
  const chip = pendingResponsesChip(day.status, day.pendingResponseCount);
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <Badge tone={badge.tone} dot>{badge.label}</Badge>
      {chip && <Badge tone="amber" dot>{chip}</Badge>}
    </span>
  );
}

function BlockHeader({ day }: { day: AbsenceDay }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-11 font-bold uppercase tracking-wide text-slate-400">Причина</p>
      <StatusBadges day={day} />
    </div>
  );
}

/** Блок «Причина»: что известно о причине дня сейчас — по состоянию (К3, К5–К8, К10, К12). */
function ReasonBlock({
  day,
  readOnly,
  busy,
  rejecting,
  rejectComment,
  onRejectComment,
  onConfirm,
  onReject,
}: {
  day: AbsenceDay;
  readOnly: boolean;
  busy: boolean;
  rejecting: number | null;
  rejectComment: string;
  onRejectComment: (value: string) => void;
  onConfirm: (response: AbsenceResponse) => void;
  onReject: (response: AbsenceResponse) => void;
}) {
  const pending = pendingResponses(day);
  const actions = day.actions ?? {};
  // Кнопки у каждого ответа — когда их несколько или ответ пришёл к уже подтверждённой причине:
  // тогда подвал занят другим действием, и решение принимается прямо у ответа.
  const inlineDecisions = !readOnly && (pending.length > 1 || (day.status === 'CONFIRMED' && pending.length > 0));

  if (day.status === 'CONFIRMED' && day.reason) {
    return (
      <div className="space-y-3.5">
        <section className={cx(CARD, 'border-emerald-200 bg-emerald-50')} aria-label="Причина">
          <BlockHeader day={day} />
          <p className="mt-3 text-lg font-bold text-ink">{reasonLabel(day.reason.reason ?? null)}</p>
          {quoted(day.reason.comment) && <p className="mt-1.5 text-sm text-slate-700">{quoted(day.reason.comment)}</p>}
          <p className="mt-2 text-xs text-slate-400">{confirmedSignature(day)}</p>
        </section>
        {pending.length > 0 && (
          <section className={cx(CARD, 'border-amber-200 bg-amber-50')} aria-label="Новые ответы родителей">
            <p className="text-11 font-bold uppercase tracking-wide text-slate-400">
              {pending.length > 1 ? 'Новые ответы родителей' : 'Новый ответ родителя'}
            </p>
            <p className="mt-1 text-13 text-slate-600">Итоговая причина не меняется, пока вы не решите по ответу.</p>
            <ResponseList
              responses={pending}
              inline={inlineDecisions}
              canConfirm={Boolean(actions.canConfirmResponses)}
              canReject={Boolean(actions.canRejectResponses)}
              busy={busy}
              rejecting={rejecting}
              rejectComment={rejectComment}
              onRejectComment={onRejectComment}
              onConfirm={onConfirm}
              onReject={onReject}
            />
          </section>
        )}
      </div>
    );
  }

  if (pending.length > 0) {
    return (
      <section className={cx(CARD, rejecting != null ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50')} aria-label="Причина">
        <BlockHeader day={day} />
        <ResponseList
          responses={pending}
          inline={inlineDecisions}
          canConfirm={Boolean(actions.canConfirmResponses)}
          canReject={Boolean(actions.canRejectResponses)}
          busy={busy}
          rejecting={rejecting}
          rejectComment={rejectComment}
          onRejectComment={onRejectComment}
          onConfirm={onConfirm}
          onReject={onReject}
        />
      </section>
    );
  }

  if (day.status === 'CLARIFICATION_NEEDED') {
    const rejected = lastRejected(day);
    return (
      <section className={cx(CARD, 'border-slate-200 bg-slate-50')} aria-label="Причина">
        <BlockHeader day={day} />
        {rejected && (
          <>
            <p className="mt-3 text-lg font-bold text-slate-400 line-through">{reasonLabel(rejected.reason ?? null)}</p>
            {quoted(rejected.comment) && <p className="mt-1 text-sm text-slate-400">{quoted(rejected.comment)}</p>}
            <ResponseAuthor response={rejected} />
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-bold text-red-700">Отклонено · {momentLabel(rejected.decidedAt)}</p>
              <p className="mt-1 text-13 text-red-800">
                {rejected.decisionComment || 'Классный руководитель попросил уточнить причину.'}
              </p>
            </div>
          </>
        )}
      </section>
    );
  }

  if (day.status === 'AWAITING_PARENT') {
    const request = lastRequest(day);
    return (
      <section className={cx(CARD, 'border-slate-200 bg-slate-50')} aria-label="Причина">
        <BlockHeader day={day} />
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Запрос отправлен {momentLabel(request?.requestedAt)}. Пока родитель не ответил, причину можно указать
          самостоятельно.
        </p>
      </section>
    );
  }

  return (
    <section className={cx(CARD, 'border-slate-200 bg-slate-50')} aria-label="Причина">
      <BlockHeader day={day} />
    </section>
  );
}

function ResponseAuthor({ response }: { response: AbsenceResponse }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
      <UserRound className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      {[parentSignature(response.parentName, response.parentRelationType), momentLabel(response.submittedAt)]
        .filter(Boolean).join(' · ')}
    </p>
  );
}

/** Ответы родителей на проверке: оба видны, ни один не подменяет другой (К12). */
function ResponseList({
  responses,
  inline,
  canConfirm,
  canReject,
  busy,
  rejecting,
  rejectComment,
  onRejectComment,
  onConfirm,
  onReject,
}: {
  responses: AbsenceResponse[];
  inline: boolean;
  canConfirm: boolean;
  canReject: boolean;
  busy: boolean;
  rejecting: number | null;
  rejectComment: string;
  onRejectComment: (value: string) => void;
  onConfirm: (response: AbsenceResponse) => void;
  onReject: (response: AbsenceResponse) => void;
}) {
  return (
    <ul className="mt-2 divide-y divide-amber-200">
      {responses.map((response) => (
        <li key={response.responseId} className="py-3 first:pt-1 last:pb-0">
          <p className="text-lg font-bold text-ink">{reasonLabel(response.reason ?? null)}</p>
          {quoted(response.comment) && <p className="mt-1 text-sm text-slate-700">{quoted(response.comment)}</p>}
          <ResponseAuthor response={response} />
          {rejecting === response.responseId ? (
            <RejectForm value={rejectComment} onChange={onRejectComment} />
          ) : inline && rejecting == null && (canConfirm || canReject) ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canConfirm && (
                <Button variant="secondary" size="sm" onClick={() => onConfirm(response)} disabled={busy}>
                  Подтвердить этот ответ
                </Button>
              )}
              {canReject && (
                <Button variant="ghost" size="sm" onClick={() => onReject(response)} disabled={busy}>
                  Отклонить
                </Button>
              )}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Поле «что уточнить» прямо в блоке «Причина» (К9). Текст необязателен — его увидит родитель. */
function RejectForm({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-ink">
        <PencilLine className="size-4 text-navy-700" aria-hidden="true" /> Отклонение ответа
      </p>
      <Field
        label="Что нужно уточнить"
        className="mt-3"
        hint="Родитель увидит этот текст и сможет отправить новый ответ. Прежний ответ останется в истории."
        error={value.length > COMMENT_LIMIT ? `Не больше ${COMMENT_LIMIT} символов` : undefined}
      >
        <TextArea
          autoFocus
          value={value}
          maxLength={COMMENT_LIMIT + 50}
          placeholder="Например: уточните, что случилось — болезнь, семейные обстоятельства или другое"
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
    </div>
  );
}

/** Форма причины прямо в шторке (К4): своя причина классного руководителя сразу подтверждена. */
function ReasonForm({
  reason,
  comment,
  lessonCount,
  onReason,
  onComment,
}: {
  reason: AbsenceReasonCode | '';
  comment: string;
  lessonCount: number;
  onReason: (value: AbsenceReasonCode | '') => void;
  onComment: (value: string) => void;
}) {
  return (
    <section className={cx(CARD, 'space-y-4 border-navy-700 bg-white')} aria-label="Указать причину">
      <Field label="Причина" required>
        <Select
          value={reason}
          placeholder="Выберите причину"
          onChange={(event) => onReason(event.target.value as AbsenceReasonCode | '')}
        >
          {REASON_OPTIONS.filter((option) => option.value != null).map((option) => (
            <option key={option.value} value={option.value as string}>{option.label}</option>
          ))}
        </Select>
      </Field>
      <Field
        label="Комментарий"
        hint="Необязательно"
        error={comment.length > COMMENT_LIMIT ? `Не больше ${COMMENT_LIMIT} символов` : undefined}
      >
        <TextArea
          value={comment}
          maxLength={COMMENT_LIMIT + 50}
          placeholder="Например: мама позвонила утром — температура"
          onChange={(event) => onComment(event.target.value)}
        />
      </Field>
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-13 leading-relaxed text-blue-900">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Причина сразу считается подтверждённой и появится у {lessonCount === 1 ? 'пропущенного урока' : `всех ${lessonCount} пропущенных уроков`} этой даты.
        </span>
      </div>
    </section>
  );
}

function LessonsCard({ day }: { day: AbsenceDay }) {
  const [expanded, setExpanded] = useState(false);
  const lessons = day.absentLessons ?? [];
  const visible = expanded ? lessons : lessons.slice(0, VISIBLE_LESSONS);
  return (
    <section className={cx(CARD, 'border-slate-200 bg-white')} aria-label="Пропущенные уроки">
      <p className="text-11 font-bold uppercase tracking-wide text-slate-400">Пропущенные уроки · {lessons.length}</p>
      <ul className="mt-1.5 divide-y divide-slate-200">
        {visible.map((lesson) => (
          <li key={lesson.lessonId} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-baseline gap-3">
              <span className="w-10 shrink-0 text-13 text-slate-400">{timeLabel(lesson.startTime)}</span>
              <span className="truncate text-sm font-medium text-ink">{lesson.subjectName}</span>
              {lesson.teacherName && <span className="truncate text-13 text-slate-500">{lesson.teacherName}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {lesson.mark === 'EXCUSED' && <span className="text-xs text-slate-500">освобождён</span>}
              <span className="rounded-md border border-red-600 bg-no-lessons-bg px-2.5 py-0.5 text-xs font-semibold text-red-600">
                Отсутствовал
              </span>
            </span>
          </li>
        ))}
      </ul>
      {lessons.length > VISIBLE_LESSONS && (
        <Button
          variant="link"
          size="text"
          className="mt-2"
          endIcon={<ChevronDown className={cx('size-4 transition', expanded && 'rotate-180')} />}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Свернуть' : `Показать все ${lessonsCount(lessons.length)}`}
        </Button>
      )}
    </section>
  );
}

function ParentsSection({ day }: { day: AbsenceDay }) {
  const guardians = day.guardians ?? [];
  return (
    <section className="px-0.5" aria-label="Родители">
      <p className="text-11 font-bold uppercase tracking-wide text-slate-400">Родители</p>
      {guardians.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <UserX className="size-4 shrink-0 text-slate-400" aria-hidden="true" /> Родитель не привязан к ученику
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {guardians.map((guardian) => (
            <li key={guardian.parentProfileId} className="flex items-center gap-2 text-sm text-ink">
              <UserRound className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span>{guardian.parentName}</span>
              {relationLabel(guardian.relationType) && <span className="text-slate-500">· {relationLabel(guardian.relationType)}</span>}
              {!guardian.reachable && <span className="text-slate-400">· не подключён к приложению</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryCard({ day }: { day: AbsenceDay }) {
  const history = [...(day.history ?? [])].reverse();
  return (
    <CollapsibleCard
      icon={<Clock className="size-[18px] text-slate-900" aria-hidden="true" />}
      title={`История изменений (${history.length})`}
      className="rounded-drawer-card"
    >
      <ul className="divide-y divide-slate-200">
        {history.map((entry) => {
          const line = historyLine(entry);
          return (
            <li key={entry.eventId} className="flex items-start justify-between gap-4 py-2.5 first:pt-0">
              <span className="min-w-0 text-13 text-slate-700">
                <span className="font-semibold text-ink">{line.actor}</span> · {line.action}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{momentLabel(entry.occurredAt)}</span>
            </li>
          );
        })}
      </ul>
    </CollapsibleCard>
  );
}
