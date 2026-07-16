import { useEffect, useMemo, useRef, useState } from 'react';
import { Ban, Check, Clock, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { TimeInput } from '@/components/ui/TimeInput';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { formatDateTime, cx } from '@/lib/format';
import { isVersionConflict } from '@/lib/schedule2bApi';
import type { PreferredShift, TeacherAvailability, TeacherRef } from '@/lib/schedule2bTypes';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import {
  useSaveTeacherAvailability,
  useTeacherAvailability,
} from '@/platform/hooks/useTeacherAvailability';
import { WEEKDAY_LABELS, WEEKDAY_SHORT_LABELS, WEEKDAYS_ORDER } from '@/platform/labels';
import {
  availabilityToDraft,
  compareIntervals,
  draftToPutBody,
  emptyAvailabilityDraft,
  emptyIntervalDraft,
  rowErrorMessage,
  sameDraft,
  sortDays,
  validateAvailabilityDraft,
  type AvailabilityDraft,
  type IntervalDraft,
} from './availabilityValidation';

function groupIntervalsByDay(intervals: IntervalDraft[]): Array<{ day: Weekday; rows: IntervalDraft[] }> {
  const sorted = [...intervals].sort(compareIntervals);
  const groups: Array<{ day: Weekday; rows: IntervalDraft[] }> = [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.day === row.dayOfWeek) last.rows.push(row);
    else groups.push({ day: row.dayOfWeek, rows: [row] });
  }
  return groups;
}

/** Drop chip errors for days that no longer have intervals (after delete/move). */
function pruneChipErrors(
  errors: Partial<Record<Weekday, string>>,
  intervals: IntervalDraft[],
): Partial<Record<Weekday, string>> {
  const referenced = new Set(intervals.map((i) => i.dayOfWeek));
  let changed = false;
  const next: Partial<Record<Weekday, string>> = {};
  for (const [day, message] of Object.entries(errors) as Array<[Weekday, string]>) {
    if (referenced.has(day)) next[day] = message;
    else changed = true;
  }
  return changed ? next : errors;
}

function teacherFullName(t: TeacherRef): string {
  return [t.lastName, t.firstName, t.middleName].filter(Boolean).join(' ');
}

function StatusHeaderBadge({ availability }: { availability: TeacherAvailability }) {
  if (!availability.exists) {
    return (
      <Badge tone="gray" dot>
        не задан
      </Badge>
    );
  }
  if (availability.status === 'APPROVED') {
    return (
      <Badge tone="green" dot>
        утверждён
      </Badge>
    );
  }
  return (
    <Badge tone="gray" dot>
      неактивен
    </Badge>
  );
}

function WorkingDaysChips({
  value,
  onChange,
  chipErrors,
  disabled,
}: {
  value: Weekday[];
  onChange: (next: Weekday[]) => void;
  chipErrors: Partial<Record<Weekday, string>>;
  disabled?: boolean;
}) {
  const selected = new Set(value);

  function toggle(day: Weekday) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(WEEKDAYS_ORDER.filter((d) => next.has(d)));
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Рабочие дни учителя">
      {WEEKDAYS_ORDER.map((day) => {
        const on = selected.has(day);
        const err = chipErrors[day];
        return (
          <div key={day} className="flex flex-col items-start gap-1">
            <button
              type="button"
              disabled={disabled}
              aria-pressed={on}
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? `day-err-${day}` : undefined}
              onClick={() => toggle(day)}
              className={cx(
                'min-w-[3.25rem] rounded-xl px-3 py-3 text-sm font-semibold transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                err && 'ring-2 ring-red-400',
                on
                  ? 'bg-brand-500 text-white shadow-sm hover:bg-brand-600'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {WEEKDAY_SHORT_LABELS[day]}
            </button>
            {err && (
              <p id={`day-err-${day}`} className="max-w-[7rem] text-[11px] leading-tight text-red-500">
                {err}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: IntervalDraft['type'];
  onChange: (next: IntervalDraft['type']) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-lg ring-1 ring-slate-200"
      role="group"
      aria-label="Тип интервала"
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === 'AVAILABLE'}
        onClick={() => onChange('AVAILABLE')}
        className={cx(
          'inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          value === 'AVAILABLE'
            ? 'bg-emerald-500 text-white'
            : 'bg-white text-slate-600 hover:bg-slate-50',
        )}
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        Доступен
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === 'UNAVAILABLE'}
        onClick={() => onChange('UNAVAILABLE')}
        className={cx(
          'inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          value === 'UNAVAILABLE'
            ? 'bg-red-500 text-white [background-image:repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(255,255,255,0.25)_3px,rgba(255,255,255,0.25)_6px)]'
            : 'bg-white text-slate-600 hover:bg-slate-50',
        )}
      >
        <Ban className="h-3.5 w-3.5" aria-hidden />
        Недоступен
      </button>
    </div>
  );
}

export function TeacherAvailabilityCard({
  teacherId,
  teacher,
  onDirtyChange,
  onClose,
}: {
  teacherId: number;
  teacher: TeacherRef | null;
  onDirtyChange?: (dirty: boolean) => void;
  onClose?: () => void;
}) {
  const toast = useToast();
  const query = useTeacherAvailability(teacherId);
  const saveMutation = useSaveTeacherAvailability(teacherId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AvailabilityDraft | null>(null);
  const [baseline, setBaseline] = useState<AvailabilityDraft | null>(null);
  const [chipErrors, setChipErrors] = useState<Partial<Record<Weekday, string>>>({});
  const [versionConflictOpen, setVersionConflictOpen] = useState(false);
  const focusDaySelectKey = useRef<string | null>(null);
  const daySelectRefs = useRef<Record<string, HTMLSelectElement | null>>({});

  const availability = query.data;

  useEffect(() => {
    setEditing(false);
    setDraft(null);
    setBaseline(null);
    setChipErrors({});
    setVersionConflictOpen(false);
  }, [teacherId]);

  useEffect(() => {
    if (!availability || availability.teacherId !== teacherId) return;
    if (!availability.exists) {
      if (!editing) {
        setDraft(null);
        setBaseline(null);
      }
      return;
    }
    if (editing) return;
    const next = availabilityToDraft(availability);
    setDraft(next);
    setBaseline(next);
    setEditing(true);
  }, [availability, teacherId, editing]);

  const dirty = useMemo(() => {
    if (!draft || !baseline) return Boolean(draft && !baseline);
    return !sameDraft(draft, baseline);
  }, [draft, baseline]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const validation = useMemo(
    () => (draft ? validateAvailabilityDraft(draft) : { byKey: {}, dayChipErrors: {}, hasErrors: false }),
    [draft],
  );

  // chipErrors are UX-only for failed day toggles — prune when day is no longer referenced.
  useEffect(() => {
    if (!draft) return;
    setChipErrors((prev) => pruneChipErrors(prev, draft.intervals));
  }, [draft]);

  useEffect(() => {
    const key = focusDaySelectKey.current;
    if (!key) return;
    const el = daySelectRefs.current[key];
    if (el) {
      el.focus();
      focusDaySelectKey.current = null;
    }
  }, [draft?.intervals]);

  function startEmptyDraft() {
    // baseline=null → dirty until first successful save (exists=false → PUT creates APPROVED).
    setDraft(emptyAvailabilityDraft());
    setBaseline(null);
    setEditing(true);
    setChipErrors({});
  }

  function reloadFromServer() {
    setVersionConflictOpen(false);
    setEditing(false);
    setDraft(null);
    setBaseline(null);
    setChipErrors({});
    void query.refetch().then((result) => {
      const data = result.data;
      if (!data?.exists) {
        setEditing(false);
        return;
      }
      const next = availabilityToDraft(data);
      setDraft(next);
      setBaseline(next);
      setEditing(true);
    });
  }

  function setWorkingDays(proposed: Weekday[]) {
    if (!draft) return;
    const check = validateAvailabilityDraft(draft, { proposedWorkingDays: proposed });
    if (Object.keys(check.dayChipErrors).length > 0) {
      setChipErrors(check.dayChipErrors);
      return;
    }
    setChipErrors({});
    setDraft({ ...draft, workingDays: sortDays(proposed) });
  }

  function updateInterval(key: string, patch: Partial<IntervalDraft>) {
    if (!draft) return;
    const intervals = draft.intervals.map((row) => (row.key === key ? { ...row, ...patch } : row));
    setDraft({ ...draft, intervals });
    setChipErrors((prev) => pruneChipErrors(prev, intervals));
  }

  function removeInterval(key: string) {
    if (!draft) return;
    const intervals = draft.intervals.filter((row) => row.key !== key);
    setDraft({ ...draft, intervals });
    setChipErrors((prev) => pruneChipErrors(prev, intervals));
  }

  function addInterval() {
    if (!draft) return;
    const defaultDay = draft.workingDays[0] ?? 'MONDAY';
    const row = emptyIntervalDraft(defaultDay);
    focusDaySelectKey.current = row.key;
    setDraft({ ...draft, intervals: [...draft.intervals, row] });
  }

  async function onSave() {
    if (!draft) return;
    const check = validateAvailabilityDraft(draft);
    if (check.hasErrors) {
      toast.error('Исправьте ошибки в интервалах перед сохранением');
      return;
    }
    try {
      const saved = await saveMutation.mutateAsync(draftToPutBody(draft));
      const next = availabilityToDraft(saved);
      setDraft(next);
      setBaseline(next);
      setEditing(true);
      setChipErrors({});
      toast.success('График утверждён');
    } catch (err) {
      if (isVersionConflict(err)) {
        setVersionConflictOpen(true);
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить график');
    }
  }

  const title = teacher ? teacherFullName(teacher) : `Учитель #${teacherId}`;
  const intervalGroups = draft ? groupIntervalsByDay(draft.intervals) : [];
  // chipErrors are ephemeral UX for day toggles — do not gate Save on them.
  const canSave = Boolean(draft) && dirty && !validation.hasErrors;

  if (query.isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <LoadingBlock label="Загрузка графика…" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <ErrorBlock
          message={
            query.error instanceof Error ? query.error.message : 'Не удалось загрузить график'
          }
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  if (availability && !availability.exists && !editing) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <CardHeader
          title={title}
          availability={availability}
          onClose={onClose}
        />
        <EmptyBlock
          icon={<Clock className="h-7 w-7" />}
          title="График ещё не задан"
          description="Заполните рабочие дни и интервалы доступности. Сохранение сразу утверждает график."
          action={
            <Button type="button" onClick={startEmptyDraft}>
              Заполнить
            </Button>
          }
        />
      </div>
    );
  }

  if (!draft || !availability) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <LoadingBlock label="Подготовка формы…" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <CardHeader title={title} availability={availability} onClose={onClose} />

      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
        День без интервалов = учитель доступен весь день. Интервалы AVAILABLE сужают окно;
        UNAVAILABLE вырезает окна внутри доступности.
      </p>

      <div className="mt-5 space-y-5">
        <Field label="Рабочие дни" required>
          <WorkingDaysChips
            value={draft.workingDays}
            onChange={setWorkingDays}
            chipErrors={chipErrors}
            disabled={saveMutation.isPending}
          />
        </Field>

        <Field label="Предпочтительная смена">
          <Select
            value={draft.preferredShift ?? ''}
            disabled={saveMutation.isPending}
            onChange={(e) => {
              const raw = e.target.value;
              const preferredShift: PreferredShift | null =
                raw === 'FIRST' || raw === 'SECOND' ? raw : null;
              setDraft({ ...draft, preferredShift });
            }}
          >
            <option value="">Не важно</option>
            <option value="FIRST">1 смена</option>
            <option value="SECOND">2 смена</option>
          </Select>
        </Field>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Интервалы</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={addInterval}
              disabled={saveMutation.isPending}
            >
              Добавить интервал
            </Button>
          </div>

          <div className="space-y-5">
            {intervalGroups.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                Интервалов нет — на рабочих днях учитель доступен весь день
              </div>
            )}
            {intervalGroups.map(({ day, rows }) => (
              <section key={day} aria-labelledby={`intervals-${day}`}>
                <h3
                  id={`intervals-${day}`}
                  className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {WEEKDAY_LABELS[day]}
                </h3>
                <ul className="space-y-3">
                  {rows.map((row) => {
                    const err = validation.byKey[row.key];
                    const message = rowErrorMessage(err);
                    const hasError = Boolean(message);
                    return (
                      <li
                        key={row.key}
                        className={cx(
                          'rounded-xl border p-3 sm:p-3.5',
                          hasError ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white',
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                          <div className="min-w-[7.5rem] flex-1 sm:max-w-[9rem]">
                            <label className="label-base" htmlFor={`day-${row.key}`}>
                              День
                            </label>
                            <select
                              id={`day-${row.key}`}
                              ref={(el) => {
                                daySelectRefs.current[row.key] = el;
                              }}
                              className={cx(
                                'input-base',
                                err?.outsideWorkingDay && 'border-red-300',
                              )}
                              value={row.dayOfWeek}
                              disabled={saveMutation.isPending}
                              onChange={(e) =>
                                updateInterval(row.key, { dayOfWeek: e.target.value as Weekday })
                              }
                            >
                              {WEEKDAYS_ORDER.map((d) => (
                                <option key={d} value={d} disabled={!draft.workingDays.includes(d)}>
                                  {WEEKDAY_SHORT_LABELS[d]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-full sm:w-24">
                            <label className="label-base" htmlFor={`start-${row.key}`}>
                              С
                            </label>
                            <TimeInput
                              id={`start-${row.key}`}
                              value={row.startTime}
                              error={Boolean(err?.endBeforeStart)}
                              disabled={saveMutation.isPending}
                              onChange={(startTime) => updateInterval(row.key, { startTime })}
                            />
                          </div>
                          <div className="w-full sm:w-24">
                            <label className="label-base" htmlFor={`end-${row.key}`}>
                              По
                            </label>
                            <TimeInput
                              id={`end-${row.key}`}
                              value={row.endTime}
                              error={Boolean(err?.endBeforeStart)}
                              disabled={saveMutation.isPending}
                              onChange={(endTime) => updateInterval(row.key, { endTime })}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="label-base">Тип</p>
                            <TypeToggle
                              value={row.type}
                              disabled={saveMutation.isPending}
                              onChange={(type) => updateInterval(row.key, { type })}
                            />
                          </div>
                          <button
                            type="button"
                            aria-label="Удалить интервал"
                            disabled={saveMutation.isPending}
                            onClick={() => removeInterval(row.key)}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {message && <p className="mt-2 text-xs text-red-600">{message}</p>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-400">
          {dirty ? 'Есть несохранённые изменения' : 'Изменений нет'}
        </p>
        <Button
          type="button"
          onClick={() => void onSave()}
          loading={saveMutation.isPending}
          disabled={!canSave || saveMutation.isPending}
        >
          Сохранить и утвердить
        </Button>
      </div>

      <ConfirmDialog
        open={versionConflictOpen}
        onClose={() => setVersionConflictOpen(false)}
        onConfirm={reloadFromServer}
        title="График изменён"
        message="График доступности изменил другой администратор. Загрузите актуальную версию — перезаписать молча нельзя."
        confirmLabel="Загрузить актуальный"
        cancelLabel="Остаться"
      />
    </div>
  );
}

function CardHeader({
  title,
  availability,
  onClose,
}: {
  title: string;
  availability: TeacherAvailability;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
          <StatusHeaderBadge availability={availability} />
        </div>
        {availability.exists && availability.status === 'APPROVED' && availability.approvedAt && (
          <p className="mt-1 text-xs text-slate-500">
            Утверждён {formatDateTime(availability.approvedAt)}
          </p>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="Закрыть карточку"
          onClick={onClose}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
