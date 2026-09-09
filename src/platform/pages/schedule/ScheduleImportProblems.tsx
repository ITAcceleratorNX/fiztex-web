import { AlertTriangle, Info } from 'lucide-react';
import { Select } from '@/components/ui/Field';
import { cx } from '@/lib/format';
import type { ImportOverrides, ImportProblem } from '@/lib/scheduleImport/resolveScheduleImport';

/**
 * Отчёт «что требует исправления».
 *
 * Строка отчёта — про значение, а не про ячейку: «учителя КШ нет в справочнике»
 * встречается в 82 уроках, и 82 одинаковых строки прятали бы остальные девять
 * проблем. Адреса ячеек идут примерами в той же строке — по ним правят файл.
 *
 * Там, где решение всё равно за человеком (одни инициалы у двух учителей, предмет
 * не назван в файле), рядом стоит выбор. Это не «починить за администратора», а
 * единственное место, где выбор вообще можно сделать: файл переписывать дольше.
 */
export function ScheduleImportProblems({
  problems,
  overrides,
  onOverride,
}: {
  problems: ImportProblem[];
  overrides: ImportOverrides;
  onOverride: (kind: keyof ImportOverrides, key: string, id: number | null) => void;
}) {
  if (problems.length === 0) return null;

  const errors = problems.filter((problem) => problem.severity === 'error');
  const warnings = problems.filter((problem) => problem.severity === 'warning');

  return (
    <section className="card overflow-hidden p-0">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h3 className="text-13 font-bold text-ink">Требует исправления</h3>
        {errors.length > 0 && (
          <span className="rounded bg-red-50 px-2 py-0.5 text-11 font-semibold text-red-600">
            Ошибок: {errors.length}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="rounded bg-brand-50 px-2 py-0.5 text-11 font-semibold text-brand-600">
            Предупреждений: {warnings.length}
          </span>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-13">
          <thead className="bg-gray-50 text-11 uppercase tracking-wide text-muted">
            <tr>
              <th className="w-9 px-3 py-2" />
              <th className="px-3 py-2 text-left font-semibold">Что не сошлось</th>
              <th className="w-20 px-3 py-2 text-left font-semibold">Уроков</th>
              <th className="px-3 py-2 text-left font-semibold">Где в файле</th>
              <th className="w-64 px-3 py-2 text-left font-semibold">Решение</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((problem) => {
              const key = `${problem.code}|${problem.className ?? ''}|${problem.value}`;
              const chosen = problem.fix
                ? overrides[problem.fix.kind][problem.fix.key]
                : undefined;
              return (
                <tr key={key} className="border-t border-line align-top">
                  <td className="px-3 py-2.5">
                    {problem.severity === 'error' ? (
                      <AlertTriangle className="size-4 text-red-500" aria-label="Ошибка" />
                    ) : (
                      <Info className="size-4 text-brand-500" aria-label="Предупреждение" />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-ink">{problem.message}</div>
                    {problem.className && (
                      <div className="text-11 text-muted">Класс {problem.className}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-ink">{problem.lessonCount}</td>
                  <td className="px-3 py-2.5 text-11 text-muted">
                    {problem.examples.slice(0, 3).map((example) => (
                      <div key={example}>{example}</div>
                    ))}
                    {problem.lessonCount > 3 && <div>…</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    {problem.fix && problem.candidates && problem.candidates.length > 0 ? (
                      <Select
                        value={chosen != null ? String(chosen) : ''}
                        onChange={(event) =>
                          onOverride(
                            problem.fix!.kind,
                            problem.fix!.key,
                            event.target.value ? Number(event.target.value) : null,
                          )
                        }
                        className={cx('w-full', chosen != null && 'border-emerald-300')}
                      >
                        <option value="">Не выбрано</option>
                        {problem.candidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-11 text-muted">
                        {problem.severity === 'warning' ? 'Импорту не мешает' : 'Правится в файле'}
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
