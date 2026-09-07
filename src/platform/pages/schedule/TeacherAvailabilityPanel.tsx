import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Info } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import { isVersionConflict } from '@/lib/schedule2bApi';
import type { TeacherAvailability, TeacherAvailabilitySummary } from '@/lib/schedule2bTypes';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import {
  useDecideAvailabilityProposal,
  useSaveTeacherAvailability,
  useTeacherAvailability,
} from '@/platform/hooks/useTeacherAvailability';
import { AvailabilityTimelineGrid } from './AvailabilityTimelineGrid';
import {
  AddIntervalForm,
  PreferredShiftControl,
  WorkingDayChips,
  WorkingHoursControl,
} from './availabilityControls';
import { AvailabilityProposalCard } from './AvailabilityProposalCard';
import {
  expandGridPeriods,
  toggleSlot,
  workingHoursLabel,
  type GridPeriod,
} from './availabilityGrid';
import {
  availabilityToDraft,
  emptyAvailabilityDraft,
  draftToPutBody,
  rowErrorMessage,
  sameDraft,
  sortDays,
  validateAvailabilityDraft,
  type AvailabilityDraft,
} from './availabilityValidation';
import { teacherFullName } from './TeacherPickerColumn';

/**
 * Общая обёртка правой колонки (2015:10964).
 *
 * min-w-0 обязателен: без него минимальная ширина сетки распирает
 * flex-строку и на узких экранах карточка уезжает за край вместо того,
 * чтобы отдать прокрутку самой сетке.
 */
function PanelCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-5 rounded-2xl border border-line bg-white p-6">
      {children}
    </div>
  );
}

/** «Занятость не выбрана» (2015:11162) и «список пуст» (2015:11195). */
export function EmptyPanel({ variant }: { variant: 'no-selection' | 'no-teachers' }) {
  if (variant === 'no-teachers') {
    return (
      <PanelCard>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-info-bg">
            <Info className="size-6 text-navy-700" aria-hidden />
          </span>
          <p className="max-w-state-text text-center text-15 font-medium text-subtle">
            Выберите учителя из списка слева, чтобы посмотреть и настроить рабочее время.
          </p>
        </div>
      </PanelCard>
    );
  }

  return (
    <PanelCard>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-2xl border border-line p-12">
        <Calendar className="size-16 text-subtle" strokeWidth={1} aria-hidden />
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-base font-semibold text-ink">Занятость не выбрана</p>
          <p className="max-w-state-text-wide text-sm text-muted">
            Выберите учителя слева, чтобы посмотреть или изменить занятость
          </p>
        </div>
      </div>
    </PanelCard>
  );
}

/**
 * Правая колонка «Занятость учителей»: просмотр (Figma 2015:10964),
 * пустая занятость (2015:11303) и режим правки (2015:11449).
 *
 * Черновик и валидация — общие с формой интервалов: слоты сетки и форма
 * добавления пишут в один AvailabilityDraft.
 */
export function TeacherAvailabilityPanel({
  teacher,
  periods,
  templateHint,
  onDirtyChange,
}: {
  teacher: TeacherAvailabilitySummary;
  periods: GridPeriod[];
  /** Почему сетки нет: шаблон не выбран или в нём нет уроков. */
  templateHint: string | null;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const toast = useToast();
  const teacherId = teacher.teacherId;
  const query = useTeacherAvailability(teacherId);
  const saveMutation = useSaveTeacherAvailability(teacherId);
  const decision = useDecideAvailabilityProposal(teacherId);

  const [draft, setDraft] = useState<AvailabilityDraft | null>(null);
  const [baseline, setBaseline] = useState<AvailabilityDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [chipError, setChipError] = useState<string | null>(null);
  const [versionConflictOpen, setVersionConflictOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState<string | null>(null);

  const availability = query.data;

  useEffect(() => {
    setDraft(null);
    setBaseline(null);
    setEditing(false);
    setChipError(null);
    setVersionConflictOpen(false);
    setRejectComment(null);
  }, [teacherId]);

  // Сервер — источник правды, пока пользователь не начал править.
  useEffect(() => {
    if (!availability || availability.teacherId !== teacherId || editing) return;
    const next = availability.exists ? availabilityToDraft(availability) : null;
    setDraft(next);
    setBaseline(next);
  }, [availability, teacherId, editing]);

  const dirty = useMemo(
    () => (draft && baseline ? !sameDraft(draft, baseline) : Boolean(draft) !== Boolean(baseline)),
    [draft, baseline],
  );

  useEffect(() => {
    onDirtyChange?.(editing && dirty);
  }, [editing, dirty, onDirtyChange]);

  const validation = useMemo(
    () =>
      draft
        ? validateAvailabilityDraft(draft)
        : { byKey: {}, dayChipErrors: {}, hasErrors: false },
    [draft],
  );
  const intervalError = useMemo(() => {
    for (const error of Object.values(validation.byKey)) {
      const message = rowErrorMessage(error);
      if (message) return message;
    }
    return null;
  }, [validation]);

  // Хуки до любых early return — иначе при смене loading→data меняется их порядок.
  const gridPeriods = useMemo(() => expandGridPeriods(periods, draft), [periods, draft]);

  function startEditing(seed: AvailabilityDraft | null) {
    setDraft(seed ?? emptyAvailabilityDraft());
    setEditing(true);
    setChipError(null);
  }

  function cancelEditing() {
    setDraft(baseline);
    setEditing(false);
    setChipError(null);
  }

  function reloadFromServer() {
    setVersionConflictOpen(false);
    setEditing(false);
    setDraft(null);
    setBaseline(null);
    void query.refetch();
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

  async function onSave() {
    if (!draft) return;
    if (validateAvailabilityDraft(draft).hasErrors) {
      toast.error('Исправьте ошибки в интервалах перед сохранением');
      return;
    }
    try {
      const saved = await saveMutation.mutateAsync(draftToPutBody(draft));
      const next = availabilityToDraft(saved);
      setDraft(next);
      setBaseline(next);
      setEditing(false);
      setChipError(null);
      toast.success('График утверждён');
    } catch (err) {
      if (isVersionConflict(err)) {
        setVersionConflictOpen(true);
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить график');
    }
  }

  async function decide(action: 'approve' | 'reject') {
    try {
      if (action === 'approve') {
        await decision.approve.mutateAsync();
        toast.success('Заявка утверждена — часы учителя обновлены');
      } else {
        await decision.reject.mutateAsync(rejectComment?.trim() || null);
        toast.success('Заявка отклонена');
      }
      setRejectComment(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось обработать заявку');
    }
  }

  if (query.isLoading) {
    return (
      <PanelCard>
        <LoadingBlock label="Загрузка графика…" />
      </PanelCard>
    );
  }

  if (query.isError) {
    return (
      <PanelCard>
        <ErrorBlock
          message={
            query.error instanceof Error ? query.error.message : 'Не удалось загрузить график'
          }
          onRetry={() => void query.refetch()}
        />
      </PanelCard>
    );
  }

  const shownDraft = draft;
  const hours = shownDraft ? workingHoursLabel(shownDraft) : null;
  const gridDays = shownDraft ? shownDraft.workingDays : [];
  const canSave = Boolean(shownDraft) && dirty && !validation.hasErrors;

  return (
    <PanelCard>
      <PanelHeader
        teacher={teacher}
        editing={editing}
        canEdit={Boolean(availability)}
        onEdit={() => startEditing(baseline)}
      />

      {availability?.pendingProposal && (
        <AvailabilityProposalCard
          proposal={availability.pendingProposal}
          tone="pending"
          title="Учитель просит изменить рабочее время"
          note={
            editing
              ? 'Решение по заявке — после выхода из режима правки.'
              : 'Утверждение перезапишет занятость этими часами.'
          }
          actions={
            editing ? null : (
              <ProposalDecisionActions
                pending={decision.approve.isPending || decision.reject.isPending}
                comment={rejectComment}
                onCommentChange={setRejectComment}
                onApprove={() => void decide('approve')}
                onReject={() => void decide('reject')}
              />
            )
          }
        />
      )}

      <div className="flex flex-col gap-3">
        <WorkingDayChips
          value={gridDays}
          editable={editing}
          disabled={saveMutation.isPending}
          onChange={setWorkingDays}
        />
        {chipError && <p className="text-11 text-red-500">{chipError}</p>}

        <div className="flex flex-wrap items-center gap-3">
          {editing && shownDraft ? (
            <WorkingHoursControl
              draft={shownDraft}
              disabled={saveMutation.isPending}
              onChange={setDraft}
            />
          ) : (
            <p className="flex items-center gap-1.5 text-13 text-muted">
              <Clock className="size-3.5 shrink-0 text-subtle" aria-hidden />
              {hours ? `Рабочие часы: ${hours}` : 'Рабочие часы не настроены'}
            </p>
          )}
          <PreferredShiftControl
            value={shownDraft?.preferredShift ?? null}
            editable={editing}
            disabled={saveMutation.isPending}
            onChange={(preferredShift) =>
              shownDraft && setDraft({ ...shownDraft, preferredShift })
            }
          />
        </div>
      </div>

      {!shownDraft ? (
        <EmptyAvailability
          disabled={saveMutation.isPending}
          onFill={() => startEditing(emptyAvailabilityDraft())}
        />
      ) : templateHint ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-gray-50 p-12 text-center">
          <Calendar className="size-8 text-subtle" aria-hidden />
          <p className="max-w-state-text text-13 text-muted">{templateHint}</p>
        </div>
      ) : gridDays.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-gray-50 p-12 text-center">
          <Calendar className="size-8 text-subtle" aria-hidden />
          <p className="max-w-state-text text-13 text-muted">
            Не выбран ни один рабочий день — отметьте дни выше, чтобы задать занятость.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <AvailabilityTimelineGrid
            periods={gridPeriods}
            days={gridDays}
            draft={shownDraft}
            editable={editing}
            disabled={saveMutation.isPending}
            onToggle={(day, period) => setDraft(toggleSlot(shownDraft, day, period))}
          />
          {intervalError && <p className="text-11 text-red-500">{intervalError}</p>}
        </div>
      )}

      {editing && shownDraft && (
        <AddIntervalForm
          workingDays={shownDraft.workingDays}
          disabled={saveMutation.isPending}
          onAdd={(row) =>
            setDraft({ ...shownDraft, intervals: [...shownDraft.intervals, row] })
          }
        />
      )}

      {editing ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={cancelEditing}
            className="rounded-lg border-1.5 border-brand-500 px-5 py-2.5 text-sm font-semibold text-brand-500 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
          >
            Отменить
          </button>
          <button
            type="button"
            disabled={!canSave || saveMutation.isPending}
            onClick={() => void onSave()}
            className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:bg-disabled"
          >
            {saveMutation.isPending ? 'Сохранение…' : 'Утвердить'}
          </button>
        </div>
      ) : (
        <StatusFooter availability={availability} />
      )}

      <ConfirmDialog
        open={versionConflictOpen}
        onClose={() => setVersionConflictOpen(false)}
        onConfirm={reloadFromServer}
        title="График изменён"
        message="График доступности изменил другой администратор. Загрузите актуальную версию — перезаписать молча нельзя."
        confirmLabel="Загрузить актуальный"
        cancelLabel="Остаться"
      />
    </PanelCard>
  );
}

function PanelHeader({
  teacher,
  editing,
  canEdit,
  onEdit,
}: {
  teacher: TeacherAvailabilitySummary;
  editing: boolean;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-ink">{teacherFullName(teacher)}</h2>
          {teacher.subjects.map((subject) => (
            <span key={subject} className="rounded bg-gray-100 px-2 py-0.5 text-11 text-muted">
              {subject}
            </span>
          ))}
        </div>
        <Link
          to={`/teachers/${teacher.accountId}`}
          className="w-fit text-13 font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
        >
          Открыть карточку учителя →
        </Link>
      </div>

      {editing ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-link bg-info-bg px-4 py-2 text-13 font-semibold text-link">
          <span aria-hidden className="size-2 rounded-full bg-link" />
          Режим редактирования
        </p>
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={onEdit}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-13 font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:bg-disabled"
        >
          Редактировать
        </button>
      )}
    </div>
  );
}

/** «Данные о занятости пока не заполнены» (2015:11332). */
function EmptyAvailability({ disabled, onFill }: { disabled: boolean; onFill: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-line bg-gray-50 p-12">
      <span className="rounded-full bg-gray-100 p-4">
        <Calendar className="size-8 text-subtle" aria-hidden />
      </span>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-base font-bold text-ink">Данные о занятости пока не заполнены</p>
        <p className="max-w-state-text text-13 text-muted">
          Задайте рабочие дни, часы и индивидуальные интервалы для составления точного школьного
          расписания.
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onFill}
        className="rounded-lg bg-brand-500 px-5 py-2.5 text-13 font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:bg-disabled"
      >
        Заполнить занятость
      </button>
    </div>
  );
}

/**
 * Утвердить / отклонить. Причина отказа — поле рядом, а не отдельное окно:
 * админ решает по той же карточке, которую читает, и уводить его в модалку
 * ради одной строки значит прятать от него саму заявку.
 */
function ProposalDecisionActions({
  pending,
  comment,
  onCommentChange,
  onApprove,
  onReject,
}: {
  pending: boolean;
  comment: string | null;
  onCommentChange: (next: string | null) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (comment != null) {
    return (
      <div className="flex w-full flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-11 font-semibold text-muted">Причина отказа (необязательно)</span>
          <textarea
            value={comment}
            rows={2}
            maxLength={500}
            disabled={pending}
            onChange={(e) => onCommentChange(e.target.value)}
            className="w-full rounded-lg border border-line bg-white p-2.5 text-13 text-ink outline-none transition focus:border-navy-700 disabled:bg-gray-50"
            placeholder="Учитель увидит это на своём экране"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onReject}
            className="rounded-lg bg-red-500 px-4 py-2 text-13 font-semibold text-white transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:bg-disabled"
          >
            {pending ? 'Отклонение…' : 'Отклонить заявку'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onCommentChange(null)}
            className="rounded-lg border border-line bg-white px-4 py-2 text-13 font-semibold text-muted transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
          >
            Отменить
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={onApprove}
        className="rounded-lg bg-brand-500 px-4 py-2 text-13 font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:bg-disabled"
      >
        {pending ? 'Утверждение…' : 'Утвердить заявку'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => onCommentChange('')}
        className="rounded-lg border border-line bg-white px-4 py-2 text-13 font-semibold text-muted transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 disabled:opacity-60"
      >
        Отклонить
      </button>
    </>
  );
}

function StatusFooter({ availability }: { availability: TeacherAvailability | undefined }) {
  const approved = availability?.exists === true && availability.status === 'APPROVED';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-13 text-muted">Текущий статус занятости:</p>
      <span
        className={cx(
          'rounded-md px-2.5 py-1 text-13 font-semibold',
          approved ? 'bg-success-bg text-success-fg' : 'bg-attention-bg text-attention-fg',
        )}
      >
        {approved ? 'Утверждено' : 'Проверить'}
      </span>
    </div>
  );
}
