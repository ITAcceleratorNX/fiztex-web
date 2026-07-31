import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/format';
import { isWorkingDaysInUseError } from '@/lib/scheduleSettingsApi';
import type { Weekday, WeekdayLessonCount } from '@/lib/scheduleSettingsTypes';
import { useUpdateWorkingDays, useWorkingDays } from '@/platform/hooks/useScheduleSettings';
import { WEEKDAY_LABELS, WEEKDAY_SHORT_LABELS, WEEKDAYS_ORDER } from '@/platform/labels';

/** Винительный падеж для заголовка «Отключить среду?» (2015:9985). */
const WEEKDAY_ACCUSATIVE: Record<Weekday, string> = {
  MONDAY: 'понедельник',
  TUESDAY: 'вторник',
  WEDNESDAY: 'среду',
  THURSDAY: 'четверг',
  FRIDAY: 'пятницу',
  SATURDAY: 'субботу',
  SUNDAY: 'воскресенье',
};

const WEEKDAY_PREPOSITIONAL: Record<Weekday, string> = {
  MONDAY: 'В понедельник',
  TUESDAY: 'Во вторник',
  WEDNESDAY: 'В среду',
  THURSDAY: 'В четверг',
  FRIDAY: 'В пятницу',
  SATURDAY: 'В субботу',
  SUNDAY: 'В воскресенье',
};

function sortDays(days: Weekday[]): Weekday[] {
  return WEEKDAYS_ORDER.filter((d) => days.includes(d));
}

function sameDays(a: Weekday[], b: Weekday[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((d) => set.has(d));
}

function countsFromConfirmation(details: unknown): WeekdayLessonCount[] {
  return Array.isArray(details) ? (details as WeekdayLessonCount[]) : [];
}

function pluralLessons(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'урок';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'урока';
  return 'уроков';
}

/**
 * Карточка «Рабочие дни» (Figma 2015:9731; несохранённое состояние — 2015:9850,
 * подтверждение — 2015:9985).
 */
export function WorkingDaysCard({ yearId }: { yearId: number }) {
  const toast = useToast();
  const query = useWorkingDays(yearId);
  const mutation = useUpdateWorkingDays(yearId);

  const [days, setDays] = useState<Weekday[]>([]);
  const [baseline, setBaseline] = useState<Weekday[]>([]);
  const [version, setVersion] = useState<number | null>(null);

  useEffect(() => {
    if (!query.data || query.data.academicYearId !== yearId) return;
    const sorted = sortDays(query.data.days);
    setDays(sorted);
    setBaseline(sorted);
    setVersion(query.data.version);
  }, [query.data, yearId]);

  const dirty = useMemo(() => !sameDays(days, baseline), [days, baseline]);
  const impactCounts = countsFromConfirmation(mutation.confirmation?.error.details);
  const removed = useMemo(() => baseline.filter((d) => !days.includes(d)), [baseline, days]);

  function applyResult(result: { days: Weekday[]; version: number | null }) {
    const sorted = sortDays(result.days);
    setDays(sorted);
    setBaseline(sorted);
    setVersion(result.version);
  }

  async function onSave() {
    try {
      applyResult(
        await mutation.mutateAsync({
          academicYearId: yearId,
          days: sortDays(days),
          confirmImpact: false,
          version,
        }),
      );
      toast.success('Учебные дни сохранены');
    } catch (err) {
      // 409 c раскладкой уроков по дням открывает модалку — это не ошибка.
      if (isWorkingDaysInUseError(err)) return;
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  }

  async function onConfirmImpact() {
    try {
      const result = await mutation.confirm();
      if (!result) return;
      applyResult(result);
      toast.success('Учебные дни сохранены');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  }

  if (query.isLoading) {
    return (
      <section className="rounded-2xl border border-line bg-white p-6">
        <LoadingBlock label="Загрузка учебных дней…" />
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="rounded-2xl border border-line bg-white p-6">
        <ErrorBlock
          message={
            query.error instanceof Error ? query.error.message : 'Не удалось загрузить учебные дни'
          }
          onRetry={() => void query.refetch()}
        />
      </section>
    );
  }

  const canSave = dirty && days.length > 0 && !mutation.isPending;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
      <h2 className="text-base font-semibold text-ink">Рабочие дни</h2>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ul className="flex flex-wrap gap-2" aria-label="Учебные дни недели">
          {WEEKDAYS_ORDER.map((day) => {
            const on = days.includes(day);
            return (
              <li key={day}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={mutation.isPending}
                  onClick={() =>
                    setDays((prev) =>
                      sortDays(prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]),
                    )
                  }
                  className={cx(
                    'flex h-12 w-16 items-center justify-center rounded-lg text-sm transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    on
                      ? 'bg-navy-700 font-bold text-white'
                      : 'border border-line bg-white font-medium text-muted hover:bg-gray-50',
                  )}
                >
                  <span className="sr-only">
                    {WEEKDAY_LABELS[day]} — {on ? 'учебный день' : 'выходной'}
                  </span>
                  <span aria-hidden>{WEEKDAY_SHORT_LABELS[day]}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-4">
          {dirty && (
            <p className="flex items-center gap-1.5 text-13 text-muted">
              <span aria-hidden className="size-1.5 rounded-full bg-brand-500" />
              Есть несохранённые изменения
            </p>
          )}
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void onSave()}
            className={cx(
              'rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
              canSave
                ? 'bg-navy-700 hover:bg-navy-800'
                : 'cursor-not-allowed bg-disabled',
            )}
          >
            {mutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {days.length === 0 && (
        <p className="text-13 text-no-lessons-fg">Оставьте хотя бы один учебный день.</p>
      )}

      <WorkingDaysConfirm
        open={mutation.confirmation != null}
        removed={removed}
        counts={impactCounts}
        loading={mutation.isPending}
        onClose={() => mutation.dismissConfirmation()}
        onConfirm={() => void onConfirmImpact()}
      />
    </section>
  );
}

/**
 * Один снимаемый день — текст ровно из макета; несколько — перечисление,
 * иначе пришлось бы врать про «этот день».
 */
function WorkingDaysConfirm({
  open,
  removed,
  counts,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  removed: Weekday[];
  counts: WeekdayLessonCount[];
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const single = removed.length === 1 ? removed[0]! : null;
  const singleCount = single
    ? (counts.find((row) => row.weekday === single)?.lessonCount ?? 0)
    : 0;
  const total = counts.reduce((sum, row) => sum + Number(row.lessonCount), 0);

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      danger
      confirmLabel={single ? 'Отключить' : 'Применить всё равно'}
      cancelLabel="Отменить"
      title={single ? `Отключить ${WEEKDAY_ACCUSATIVE[single]}?` : 'На днях есть уроки'}
      message={
        single ? (
          <p>
            {WEEKDAY_PREPOSITIONAL[single]} уже есть {singleCount} {pluralLessons(singleCount)} в
            расписаниях. Если вы отключите этот день, он будет скрыт из сетки расписания.
          </p>
        ) : (
          <div className="space-y-2">
            <p>
              На снимаемых днях есть {total} {pluralLessons(total)} в расписаниях этого года — они
              будут скрыты из сетки.
            </p>
            {counts.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-muted">
                {counts.map((row) => (
                  <li key={row.weekday}>
                    {WEEKDAY_LABELS[row.weekday]}: {row.lessonCount}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      }
    />
  );
}
