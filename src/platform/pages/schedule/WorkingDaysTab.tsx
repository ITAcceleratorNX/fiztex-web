import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { WeekdayPicker } from '@/components/ui/WeekdayPicker';
import { useToast } from '@/context/ToastContext';
import { isWorkingDaysInUseError } from '@/lib/scheduleSettingsApi';
import type { Weekday, WeekdayLessonCount } from '@/lib/scheduleSettingsTypes';
import { useUpdateWorkingDays, useWorkingDays } from '@/platform/hooks/useScheduleSettings';
import { WEEKDAY_LABELS, WEEKDAYS_ORDER } from '@/platform/labels';

const PRESET_WEEKDAYS: Weekday[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const PRESET_WEEKDAYS_SAT: Weekday[] = [...PRESET_WEEKDAYS, 'SATURDAY'];

function sameDays(a: Weekday[], b: Weekday[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((d) => set.has(d));
}

function sortDays(days: Weekday[]): Weekday[] {
  return WEEKDAYS_ORDER.filter((d) => days.includes(d));
}

function countsFromConfirmation(
  details: unknown,
): WeekdayLessonCount[] {
  return Array.isArray(details) ? (details as WeekdayLessonCount[]) : [];
}

export function WorkingDaysTab({ yearId }: { yearId: number }) {
  const toast = useToast();
  const query = useWorkingDays(yearId);
  const mutation = useUpdateWorkingDays(yearId);

  const [days, setDays] = useState<Weekday[]>(PRESET_WEEKDAYS);
  const [baseline, setBaseline] = useState<Weekday[]>(PRESET_WEEKDAYS);
  const [version, setVersion] = useState<number | null>(null);
  const [source, setSource] = useState<'DB' | 'DEFAULT'>('DEFAULT');

  useEffect(() => {
    if (!query.data || query.data.academicYearId !== yearId) return;
    const sorted = sortDays(query.data.days);
    setDays(sorted);
    setBaseline(sorted);
    setVersion(query.data.version);
    setSource(query.data.source);
  }, [query.data, yearId]);

  const dirty = useMemo(() => !sameDays(days, baseline), [days, baseline]);
  const impactCounts = countsFromConfirmation(mutation.confirmation?.error.details);
  const totalLessons = impactCounts.reduce((sum, row) => sum + Number(row.lessonCount), 0);

  async function onSave() {
    try {
      const result = await mutation.mutateAsync({
        academicYearId: yearId,
        days: sortDays(days),
        confirmImpact: false,
        version,
      });
      const sorted = sortDays(result.days);
      setDays(sorted);
      setBaseline(sorted);
      setVersion(result.version);
      setSource(result.source);
      toast.success('Учебные дни сохранены');
    } catch (err) {
      if (isWorkingDaysInUseError(err)) return;
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  }

  async function onConfirmImpact() {
    try {
      const result = await mutation.confirm();
      if (!result) return;
      const sorted = sortDays(result.days);
      setDays(sorted);
      setBaseline(sorted);
      setVersion(result.version);
      setSource(result.source);
      toast.success('Учебные дни сохранены');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Рабочие дни недели для всего учебного года. Меняйте с осторожностью, если на
        убираемых днях уже есть уроки в расписаниях.
      </p>

      {query.isLoading && <LoadingBlock label="Загрузка учебных дней…" />}
      {query.isError && (
        <ErrorBlock
          message={
            query.error instanceof Error ? query.error.message : 'Не удалось загрузить учебные дни'
          }
          onRetry={() => void query.refetch()}
        />
      )}

      {!query.isLoading && !query.isError && (
        <div className="card max-w-2xl space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {source === 'DEFAULT' && (
              <Badge tone="amber">
                Настройка по умолчанию — ещё не сохранялась для этого года
              </Badge>
            )}
            {source === 'DB' && <Badge tone="green">Сохранено для года</Badge>}
          </div>

          <WeekdayPicker value={days} onChange={setDays} disabled={mutation.isPending} />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => setDays(PRESET_WEEKDAYS)}
            >
              Пн–Пт
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => setDays(PRESET_WEEKDAYS_SAT)}
            >
              Пн–Сб
            </Button>
          </div>

          <div className="flex justify-end">
            <Button
              disabled={!dirty || days.length === 0 || mutation.isPending}
              loading={mutation.isPending}
              onClick={() => void onSave()}
            >
              Сохранить
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={mutation.confirmation != null}
        onClose={() => mutation.dismissConfirmation()}
        title="На днях есть уроки"
        confirmLabel="Применить всё равно"
        loading={mutation.isPending}
        message={
          <div className="space-y-2">
            <p>
              На убираемых днях есть {totalLessons > 0 ? totalLessons : 'N'} уроков в расписаниях
              этого года — они станут невалидными для редактирования.
            </p>
            {impactCounts.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-slate-500">
                {impactCounts.map((row) => (
                  <li key={row.weekday}>
                    {WEEKDAY_LABELS[row.weekday]}: {row.lessonCount}
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
        onConfirm={() => void onConfirmImpact()}
      />
    </div>
  );
}
