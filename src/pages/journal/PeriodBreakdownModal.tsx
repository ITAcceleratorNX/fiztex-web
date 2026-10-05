import { AlertTriangle, Sigma } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { ErrorBlock } from '@/components/ui/StateBlock';
import { usePeriodBreakdown } from '@/hooks/queries';
import { cx, formatWeekdayDayMonth } from '@/lib/format';
import type { BreakdownWork, ComponentSummary, PeriodBreakdown } from '@/lib/gradingApi';
import { GRADE_TYPE_LABELS, gradeValueLabel } from '@/lib/gradesModel';
import type { GradeType } from '@/lib/gradesApi';
import { COMPONENT_SHORT, formatPercent, resultStatusHint } from '@/lib/gradingModel';

/**
 * Расшифровка результата периода (GRADES-003 §6, ТЗ «прозрачность расчёта»): из каких
 * работ, по какой формуле и через какой порог получена рекомендация — и что решил учитель.
 *
 * <p>Ничего не досчитывает: формула приходит строкой, доли и вклады — числами. Окно
 * открывается из той же строки журнала или итогов, и число в нём обязано совпасть с числом
 * в строке — поэтому оно берётся из того же расчёта на сервере, а не собирается здесь.
 */
export function PeriodBreakdownModal({
  query,
  studentName,
  onClose,
}: {
  query: { studentProfileId: number; subjectId: number; academicPeriodId: number } | null;
  studentName?: string | null;
  onClose: () => void;
}) {
  const breakdown = usePeriodBreakdown(query);

  return (
    <Modal
      open={query != null}
      onClose={onClose}
      size="xl"
      title={studentName ? `Расчёт: ${studentName}` : 'Расчёт результата'}
      subtitle={breakdown.data?.periodName ?? undefined}
    >
      {breakdown.isPending ? (
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
      ) : breakdown.isError || !breakdown.data ? (
        <ErrorBlock message="Не удалось загрузить расчёт" onRetry={() => void breakdown.refetch()} />
      ) : (
        <BreakdownBody data={breakdown.data} />
      )}
    </Modal>
  );
}

function BreakdownBody({ data }: { data: PeriodBreakdown }) {
  const result = data.result;
  const works = data.works ?? [];
  const hint = resultStatusHint(result);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
        <p className="flex items-center gap-2 text-11 font-bold uppercase text-muted">
          <Sigma className="size-4" />
          Формула · {data.policy?.name}
        </p>
        <p className="text-15 font-semibold text-ink">{data.formula}</p>
        {hint && <p className="text-13 text-slate-500">{hint}</p>}
      </section>

      <div className="grid grid-cols-3 gap-3">
        {(result?.components ?? []).map((component) => (
          <ComponentCard key={component.code} component={component} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line px-4 py-3">
        <Stat label="Процент" value={formatPercent(result?.percent)} />
        <Stat label="Округлено" value={result?.roundedPercent != null ? `${result.roundedPercent}%` : '—'} />
        <Stat
          label="Рекомендация"
          value={result?.recommendedValue != null ? String(result.recommendedValue) : '—'}
          caption={result?.bandLabel ?? undefined}
        />
        <Stat
          label="Итог учителя"
          value={data.finalGrade?.value != null ? String(data.finalGrade.value) : '—'}
          caption={
            data.finalGrade
              ? data.finalGrade.status === 'PUBLISHED'
                ? 'опубликован'
                : 'черновик'
              : 'не выставлен'
          }
        />
      </div>

      {data.recommendationChanged && (
        <NoticeBar tone="warning" icon={<AlertTriangle className="size-4" />}>
          Оценки периода изменили после выставления итога — рекомендация сейчас другая. Итог
          остаётся решением учителя и сам не меняется.
        </NoticeBar>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-13 font-bold text-ink">Работы периода · {works.length}</h3>
        {works.length === 0 ? (
          <p className="text-13 text-slate-500">Работ в баллах за период нет.</p>
        ) : (
          <table className="w-full text-13">
            <thead>
              <tr className="border-b border-line text-left text-11 font-bold uppercase text-slate-400">
                <th className="py-2 pr-3">Дата</th>
                <th className="py-2 pr-3">Работа</th>
                <th className="py-2 pr-3">Вид</th>
                <th className="py-2 pr-3 text-center">Компонент</th>
                <th className="py-2 text-right">Балл</th>
              </tr>
            </thead>
            <tbody>
              {works.map((work) => (
                <WorkRow key={work.gradeId} work={work} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(data.policy?.bands ?? []).length > 0 && (
        <p className="text-11 text-slate-500">
          Пороги:{' '}
          {(data.policy?.bands ?? [])
            .map((band) => `с ${band.minPercent}% — ${band.value}${band.label ? ` (${band.label.toLowerCase()})` : ''}`)
            .join(' · ')}
        </p>
      )}
    </div>
  );
}

function ComponentCard({ component }: { component: ComponentSummary }) {
  const counted = component.contribution != null;
  return (
    <div className={cx('flex flex-col gap-1 rounded-xl border border-line p-3', !counted && 'opacity-70')}>
      <p className="text-11 font-bold uppercase text-muted">
        {component.code ? COMPONENT_SHORT[component.code] : '—'} · вес {formatWeight(component)}
      </p>
      <p className="text-15 font-bold text-ink">{formatPercent(component.percent)}</p>
      <p className="text-11 text-slate-500">
        {component.workCount
          ? `${trim(component.scoreSum)} из ${trim(component.maxSum)} · работ: ${component.workCount}`
          : 'Работ нет'}
      </p>
      <p className="text-11 text-slate-500">
        {counted ? `Вклад: ${formatPercent(component.contribution)}` : 'В процент не входит'}
      </p>
    </div>
  );
}

function WorkRow({ work }: { work: BreakdownWork }) {
  return (
    <tr className={cx('border-b border-line last:border-b-0', work.component == null && 'text-slate-400')}>
      <td className="py-2 pr-3 whitespace-nowrap">{work.date ? formatWeekdayDayMonth(work.date) : '—'}</td>
      <td className="max-w-[220px] truncate py-2 pr-3" title={work.title ?? undefined}>
        {work.title || '—'}
      </td>
      <td className="py-2 pr-3">{work.gradeType ? GRADE_TYPE_LABELS[work.gradeType as GradeType] : '—'}</td>
      <td className="py-2 pr-3 text-center">
        {work.component ? COMPONENT_SHORT[work.component] : 'не учит.'}
      </td>
      <td className="py-2 text-right font-semibold">{gradeValueLabel(work)}</td>
    </tr>
  );
}

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <span className="flex min-w-[110px] flex-col">
      <span className="text-11 font-bold uppercase text-slate-400">{label}</span>
      <span className="text-15 font-bold text-ink">{value}</span>
      {caption && <span className="text-11 text-slate-500">{caption}</span>}
    </span>
  );
}

/** Вес с пересчётом показывает оба числа: «25 → 50%», иначе непонятно, откуда вклад. */
function formatWeight(component: ComponentSummary): string {
  const base = trim(component.weightPercent);
  const effective = component.effectiveWeightPercent;
  if (effective == null || Number(effective) === Number(component.weightPercent)) return `${base}%`;
  return `${base}% → ${formatPercent(effective)}`;
}

function trim(value: number | undefined | null): string {
  if (value == null) return '0';
  const text = String(value);
  return (text.includes('.') ? text.replace(/\.?0+$/, '') : text).replace('.', ',');
}
