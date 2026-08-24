import { Lock } from 'lucide-react';
import { cx } from '@/lib/format';
import type { ClassFinalGradeRow, ClassFinalGrades } from '@/lib/gradebookApi';
import { formatAverage } from '@/lib/journalModel';

/** Итоговая — только целые 2…5, без знаков (final-grades-contract §3). */
export const FINAL_VALUES = [2, 3, 4, 5] as const;

/**
 * Итоги четверти (Figma 2098:1360).
 *
 * <p>Три числа в строке отвечают на разные вопросы и потому стоят рядом: средний балл —
 * что получилось у ученика, рекомендация — что из этого следует по порогам, итоговая —
 * что решил учитель. Рекомендация не подставляется в итог никогда (контракт §4): решение
 * остаётся решением, даже когда совпадает с арифметикой.
 *
 * <p>Пустой средний и пустая рекомендация — законное состояние (оценок за четверть нет),
 * и руками выставить итог это не мешает.
 */
export function QuarterFinalsTable({
  finals,
  highlighted,
  busyStudentId,
  onPick,
}: {
  finals: ClassFinalGrades;
  /** Кого не хватило для публикации — сервер называет их поимённо. */
  highlighted: ReadonlySet<number>;
  busyStudentId: number | null;
  onPick: (row: ClassFinalGradeRow, value: number) => void;
}) {
  const canManage = Boolean(finals.canManage);
  const rows = finals.rows ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="w-[320px] px-6 py-3 text-left text-11 font-bold uppercase text-slate-400">
              ФИО Ученика
            </th>
            <th className="px-6 py-3 text-center text-11 font-bold uppercase text-slate-400">
              Средний балл
            </th>
            <th className="px-6 py-3 text-center text-11 font-bold uppercase text-slate-400">
              Рекомендованная оценка
            </th>
            <th className="px-6 py-3 text-center text-11 font-bold uppercase text-slate-400">
              Итоговая оценка
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const studentId = row.studentProfileId as number;
            const locked = Boolean(row.yearLocked);
            const value = row.finalGrade?.value ?? null;

            return (
              <tr
                key={studentId}
                className={cx(
                  'border-b border-slate-200 last:border-b-0',
                  highlighted.has(studentId) && 'bg-danger-bg/60',
                )}
              >
                <td className="px-6 py-3 text-slate-900">
                  <span className="flex items-center gap-2">
                    <span className="truncate">{row.studentName}</span>
                    {row.currentMember === false && (
                      <span
                        title="Ученик больше не числится в этом классе — итог за эту четверть остаётся здесь"
                        className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-10 font-semibold text-slate-500"
                      >
                        выбыл
                      </span>
                    )}
                  </span>
                </td>

                <td className="px-6 py-3 text-center font-semibold text-slate-900">
                  {formatAverage(row.average)}
                </td>

                <td className="px-6 py-3">
                  <span className="flex justify-center">
                    {row.recommendedValue != null ? (
                      <span className="flex size-[26px] items-center justify-center rounded-lg bg-slate-100 text-13 font-bold text-slate-600">
                        {row.recommendedValue}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </span>
                </td>

                <td className="px-6 py-3">
                  <span className="flex items-center justify-center gap-3">
                    {locked ? (
                      <span
                        className="flex items-center gap-2 text-13 font-semibold text-slate-500"
                        title="Годовая оценка опубликована — четвертные по этому предмету закрыты"
                      >
                        <Lock className="size-4" />
                        {value ?? '—'}
                      </span>
                    ) : canManage ? (
                      <FinalValuePicker
                        value={value}
                        busy={busyStudentId === studentId}
                        onPick={(next) => onPick(row, next)}
                      />
                    ) : (
                      <span className="text-15 font-bold text-slate-900">{value ?? '—'}</span>
                    )}
                    {row.finalGrade?.status === 'PUBLISHED' && (
                      <span className="rounded bg-success-bg px-2 py-0.5 text-10 font-bold uppercase text-success-fg">
                        опубл.
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Выбор итоговой прямо в строке (макет 2098:1382): четыре значения всегда на виду, без
 * лишнего нажатия. Уже выставленная оценка остаётся выбранной — повторное нажатие по ней
 * ничего не меняет, а нажатие по соседней меняет значение сразу.
 */
function FinalValuePicker({
  value,
  busy,
  onPick,
}: {
  value: number | null;
  busy: boolean;
  onPick: (value: number) => void;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-lg border border-slate-200 p-0.5',
        busy && 'pointer-events-none opacity-60',
      )}
    >
      {FINAL_VALUES.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(option)}
            className={cx(
              'size-[26px] rounded-md text-13 font-bold transition',
              selected
                ? 'bg-navy-700 text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-navy-700',
            )}
          >
            {option}
          </button>
        );
      })}
    </span>
  );
}
