import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import {
  useMyAvailability,
  useSubmitAvailabilityProposal,
  useWithdrawAvailabilityProposal,
} from '@/platform/hooks/useTeacherAvailability';
import { AvailabilityProposalCard } from '@/platform/pages/schedule/AvailabilityProposalCard';
import {
  AddIntervalForm,
  IntervalListEditor,
  PreferredShiftControl,
  WorkingDayChips,
  WorkingHoursControl,
} from '@/platform/pages/schedule/availabilityControls';
import { workingHoursLabel } from '@/platform/pages/schedule/availabilityGrid';
import {
  availabilityToDraft,
  draftToProposalBody,
  emptyAvailabilityDraft,
  proposalToDraft,
  rowErrorMessage,
  sameDraft,
  sortDays,
  validateAvailabilityDraft,
  type AvailabilityDraft,
} from '@/platform/pages/schedule/availabilityValidation';

/**
 * «Моё рабочее время» — учитель сам говорит, когда он свободен.
 *
 * Экран ничего не утверждает: он отправляет заявку, а часы меняет админ, приняв её.
 * Причина не в правах, а в расписании — занятость читает движок конфликтов, и
 * учитель, молча снявший с себя день, оставил бы уже опубликованные уроки без
 * преподавателя.
 *
 * Сетки уроков здесь нет намеренно: строки той сетки — периоды шаблона звонков, а
 * шаблоны лежат под `/api/admin/*`, куда учительскому токену нельзя. Поэтому часы
 * задаются днями, окном и списком интервалов — тем же черновиком, что и у админа.
 */
export function MyAvailabilityPage() {
  const toast = useToast();
  const query = useMyAvailability();
  const submitMutation = useSubmitAvailabilityProposal();
  const withdrawMutation = useWithdrawAvailabilityProposal();

  useDocumentTitle('Моё рабочее время');

  const [draft, setDraft] = useState<AvailabilityDraft | null>(null);
  const [baseline, setBaseline] = useState<AvailabilityDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState('');
  const [chipError, setChipError] = useState<string | null>(null);

  const data = query.data;
  const availability = data?.availability;
  const pending = availability?.pendingProposal ?? null;
  const busy = submitMutation.isPending || withdrawMutation.isPending;

  /**
   * Пока учитель не начал править, экран показывает серверное состояние — и
   * заявка в нём главнее утверждённых часов: продолжать правку логично с того,
   * что уже попросили, а не с того, что пока в силе.
   */
  useEffect(() => {
    if (!data || editing) return;
    const next = pending
      ? proposalToDraft(pending)
      : data.availability.exists
        ? availabilityToDraft(data.availability)
        : null;
    setDraft(next);
    setBaseline(next);
  }, [data, editing, pending]);

  const validation = useMemo(
    () => (draft ? validateAvailabilityDraft(draft) : { byKey: {}, dayChipErrors: {}, hasErrors: false }),
    [draft],
  );

  const dirty = useMemo(
    () => (draft && baseline ? !sameDraft(draft, baseline) : Boolean(draft) !== Boolean(baseline)),
    [draft, baseline],
  );

  function startEditing() {
    setDraft(baseline ?? emptyAvailabilityDraft());
    setComment(pending?.teacherComment ?? '');
    setChipError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(baseline);
    setEditing(false);
    setChipError(null);
  }

  function setWorkingDays(proposed: Weekday[]) {
    if (!draft) return;
    const check = validateAvailabilityDraft(draft, { proposedWorkingDays: proposed });
    const blocked = Object.values(check.dayChipErrors)[0];
    if (blocked) {
      setChipError(blocked);
      return;
    }
    setChipError(null);
    setDraft({ ...draft, workingDays: sortDays(proposed) });
  }

  async function onSubmit() {
    if (!draft) return;
    if (validation.hasErrors) {
      toast.error('Исправьте ошибки в интервалах перед отправкой');
      return;
    }
    try {
      await submitMutation.mutateAsync(draftToProposalBody(draft, comment));
      setEditing(false);
      setChipError(null);
      toast.success('Заявка отправлена администратору');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось отправить заявку');
    }
  }

  async function onWithdraw() {
    try {
      await withdrawMutation.mutateAsync();
      setEditing(false);
      setComment('');
      toast.success('Заявка отозвана');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось отозвать заявку');
    }
  }

  if (query.isLoading) {
    return <LoadingBlock label="Загрузка рабочего времени…" />;
  }

  if (query.isError || !data || !availability) {
    return (
      <ErrorBlock
        message={
          query.error instanceof Error ? query.error.message : 'Не удалось загрузить рабочее время'
        }
        onRetry={() => void query.refetch()}
      />
    );
  }

  const hours = draft ? workingHoursLabel(draft) : null;
  const approvedHours = availability.exists
    ? workingHoursLabel(availabilityToDraft(availability))
    : null;
  const showRejection =
    !pending && data.lastDecision?.status === 'REJECTED' ? data.lastDecision : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-28 font-bold text-ink">Моё рабочее время</h1>
          <p className="max-w-2xl text-13 text-muted">
            Укажите дни и часы, в которые вам можно ставить уроки. Расписание изменится после
            того, как заявку утвердит администратор.
          </p>
        </div>
        {!editing && (
          <Button
            variant="primary"
            disabled={!data.canSubmit || busy}
            onClick={startEditing}
          >
            {pending ? 'Изменить заявку' : 'Изменить рабочее время'}
          </Button>
        )}
      </div>

      {!data.canSubmit && (
        <p className="rounded-xl border border-line bg-gray-50 p-4 text-13 text-muted">
          Карточка учителя в архиве — отправить заявку нельзя. Обратитесь к администратору.
        </p>
      )}

      {pending && (
        <AvailabilityProposalCard
          proposal={pending}
          tone="pending"
          title="Заявка на рассмотрении"
          note="Пока администратор не принял решение, в расписании действуют прежние часы."
          actions={
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void onWithdraw()}>
              {withdrawMutation.isPending ? 'Отзываем…' : 'Отозвать заявку'}
            </Button>
          }
        />
      )}

      {showRejection && (
        <AvailabilityProposalCard
          proposal={showRejection}
          tone="rejected"
          title="Прошлая заявка отклонена"
          note={
            showRejection.decidedAt
              ? `Решение принято ${formatDateTime(showRejection.decidedAt)}`
              : undefined
          }
        />
      )}

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">
            {editing ? 'Что отправить администратору' : 'Утверждённое рабочее время'}
          </h2>
          {!editing && (
            <span className="flex items-center gap-1.5 text-13 text-muted">
              <Clock className="size-3.5 shrink-0 text-subtle" aria-hidden />
              {approvedHours ? `Часы: ${approvedHours}` : 'Часы не заданы'}
            </span>
          )}
        </div>

        {!editing && !availability.exists ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-13 text-muted">
            Рабочее время ещё не утверждено. Отправьте заявку — администратор увидит её на экране
            занятости учителей.
          </p>
        ) : (
          <>
            <WorkingDayChips
              value={(editing ? draft?.workingDays : baseline?.workingDays) ?? []}
              editable={editing}
              disabled={busy}
              onChange={setWorkingDays}
            />
            {chipError && <p className="text-11 text-red-500">{chipError}</p>}

            <div className="flex flex-wrap items-center gap-3">
              {editing && draft ? (
                <WorkingHoursControl draft={draft} disabled={busy} onChange={setDraft} />
              ) : (
                <p className="flex items-center gap-1.5 text-13 text-muted">
                  <Clock className="size-3.5 shrink-0 text-subtle" aria-hidden />
                  {hours ? `Рабочие часы: ${hours}` : 'Рабочие часы не настроены'}
                </p>
              )}
              <PreferredShiftControl
                value={draft?.preferredShift ?? null}
                editable={editing}
                disabled={busy}
                onChange={(preferredShift) => draft && setDraft({ ...draft, preferredShift })}
              />
            </div>

            {draft && (
              <IntervalListEditor
                intervals={draft.intervals}
                errorOf={(key) => rowErrorMessage(validation.byKey[key])}
                disabled={busy || !editing}
                onRemove={(key) =>
                  setDraft({ ...draft, intervals: draft.intervals.filter((i) => i.key !== key) })
                }
              />
            )}
          </>
        )}

        {editing && draft && (
          <>
            <AddIntervalForm
              workingDays={draft.workingDays}
              disabled={busy}
              onAdd={(row) => setDraft({ ...draft, intervals: [...draft.intervals, row] })}
            />

            <label className="flex flex-col gap-1">
              <span className="text-11 font-semibold text-muted">
                Комментарий администратору (необязательно)
              </span>
              <textarea
                value={comment}
                rows={2}
                maxLength={500}
                disabled={busy}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Например: по средам веду кружок в другой школе"
                className="w-full rounded-lg border border-line bg-white p-2.5 text-13 text-ink outline-none transition focus:border-navy-700 disabled:bg-gray-50"
              />
            </label>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="secondary" disabled={busy} onClick={cancelEditing}>
                Отменить
              </Button>
              <Button
                variant="primary"
                disabled={busy || !draft || validation.hasErrors || !dirty}
                onClick={() => void onSubmit()}
              >
                {submitMutation.isPending ? 'Отправка…' : 'Отправить на согласование'}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
