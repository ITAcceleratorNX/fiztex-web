import { AlertTriangle, Check } from 'lucide-react';
import { cx, pluralRu } from '@/lib/format';
import type { ClassImportPlan } from '@/lib/scheduleImport/resolveScheduleImport';
import type { ClassImportResult } from '@/platform/services/scheduleImport';

const WEEKDAY_SHORT: Record<string, string> = {
  MONDAY: 'Пн',
  TUESDAY: 'Вт',
  WEDNESDAY: 'Ср',
  THURSDAY: 'Чт',
  FRIDAY: 'Пт',
  SATURDAY: 'Сб',
  SUNDAY: 'Вс',
};

function lessonSummary(plan: ClassImportPlan): string {
  const days = new Set(plan.lessons.map((lesson) => lesson.weekday));
  const subgroups = plan.lessons.filter((lesson) => lesson.targetType === 'SUBGROUP').length;
  const order = Object.keys(WEEKDAY_SHORT).filter((day) => days.has(day));
  return `${order.map((day) => WEEKDAY_SHORT[day]).join(' ')} · по подгруппам: ${subgroups}`;
}

/**
 * Классы файла и что с каждым будет.
 *
 * Выбор поклассный, а не «всё или ничего»: в файле 62 класса, и один неразобранный
 * учитель в пятом не повод не заводить расписание одиннадцатому. Класс с ошибками
 * выбрать нельзя — это и есть обещание «некорректное расписание не создаём».
 */
export function ScheduleImportClasses({
  plans,
  selected,
  onToggle,
  onToggleAll,
  results,
}: {
  plans: ClassImportPlan[];
  selected: Set<string>;
  onToggle: (className: string) => void;
  onToggleAll: (checked: boolean) => void;
  results: Map<string, ClassImportResult>;
}) {
  const ready = plans.filter((plan) => plan.ready);
  const allSelected = ready.length > 0 && ready.every((plan) => selected.has(plan.className));

  return (
    <section className="card overflow-hidden p-0">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="text-13 font-bold text-ink">Классы в файле: {plans.length}</h3>
        <label className="flex items-center gap-2 text-13 text-muted">
          <input
            type="checkbox"
            className="size-4 rounded border-line"
            checked={allSelected}
            disabled={ready.length === 0}
            onChange={(event) => onToggleAll(event.target.checked)}
          />
          Выбрать все готовые ({ready.length})
        </label>
      </header>

      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[640px] text-13">
          <thead className="sticky top-0 bg-gray-50 text-11 uppercase tracking-wide text-muted">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2 text-left font-semibold">Класс</th>
              <th className="w-24 px-3 py-2 text-left font-semibold">Уроков</th>
              <th className="px-3 py-2 text-left font-semibold">Состав</th>
              <th className="px-3 py-2 text-left font-semibold">Состояние</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const result = results.get(plan.className);
              return (
                <tr
                  key={plan.className}
                  className={cx('border-t border-line', !plan.ready && 'bg-red-50/40')}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-line"
                      checked={selected.has(plan.className)}
                      disabled={!plan.ready}
                      onChange={() => onToggle(plan.className)}
                      aria-label={`Импортировать ${plan.className}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold text-ink">
                    {plan.className}
                    {plan.bellTemplateName && (
                      <div className="text-11 font-normal text-muted">{plan.bellTemplateName}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-ink">
                    {plan.lessons.length}
                    {plan.blockedCount > 0 && (
                      <span className="text-red-600"> +{plan.blockedCount}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-11 text-muted">{lessonSummary(plan)}</td>
                  <td className="px-3 py-2">
                    {result ? (
                      <ResultBadge result={result} />
                    ) : plan.ready ? (
                      <span className="inline-flex items-center gap-1 text-11 font-semibold text-success-fg">
                        <Check className="size-3.5" /> Готов
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-11 font-semibold text-red-600">
                        <AlertTriangle className="size-3.5" />
                        {`${plan.blockedCount} ${pluralRu(plan.blockedCount, [
                          'строка требует',
                          'строки требуют',
                          'строк требуют',
                        ])} правки`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResultBadge({ result }: { result: ClassImportResult }) {
  if (result.outcome === 'imported') {
    return (
      <span className="text-11 font-semibold text-success-fg">
        Создано уроков: {result.created}
        {result.message && <span className="block font-normal text-red-600">{result.message}</span>}
      </span>
    );
  }
  if (result.outcome === 'skipped') {
    return <span className="text-11 font-semibold text-muted">{result.message}</span>;
  }
  return <span className="text-11 font-semibold text-red-600">{result.message ?? 'Ошибка'}</span>;
}
