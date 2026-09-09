import { AlertTriangle, Check, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ProvisioningPlan } from '@/lib/scheduleImport/planProvisioning';
import type {
  ProvisionItemResult,
  ProvisionProgress,
} from '@/platform/services/scheduleImportProvisioning';

export type ProvisionKinds = {
  subject: boolean;
  class: boolean;
  bellTemplate: boolean;
  subgroups: boolean;
};

/**
 * Чего не хватает в школе и что из этого можно завести.
 *
 * Создаётся только то, что файл описывает целиком: классы, предметы, звонки, подгруппы.
 * Учителя здесь нет намеренно — в файле от него две буквы, а карточке нужны фамилия,
 * имя и уникальный телефон. Неизвестные инициалы остаются строкой отчёта, где
 * администратор выбирает из тех, кто в школе уже есть.
 */
export function ScheduleImportProvisioning({
  plan,
  kinds,
  onKindsChange,
  onRun,
  running,
  progress,
  results,
}: {
  plan: ProvisioningPlan;
  kinds: ProvisionKinds;
  onKindsChange: (kinds: ProvisionKinds) => void;
  onRun: () => void;
  running: boolean;
  progress: ProvisionProgress | null;
  results: ProvisionItemResult[];
}) {
  type PlanRow = { kind: keyof ProvisionKinds; title: string; count: number; detail: string };
  const rows: PlanRow[] = ([
    {
      kind: 'class',
      title: 'Классы',
      count: plan.classes.length,
      detail: plan.classes.map((item) => item.name).join(', '),
    },
    {
      kind: 'subject',
      title: 'Предметы',
      count: plan.subjects.length,
      detail: plan.subjects.map((item) => item.name).join(', '),
    },
    {
      kind: 'bellTemplate',
      title: 'Шаблоны звонков',
      count: plan.bellTemplates.length,
      detail: plan.bellTemplates
        .map((item) => `${item.name} (уроков ${item.periods.length}, классов ${item.classNames.length})`)
        .join('; '),
    },
    {
      kind: 'subgroups',
      title: 'Подгруппы',
      count: plan.subgroups.length,
      detail: plan.subgroups
        .slice(0, 8)
        .map((item) => `${item.className}: ${item.labels.join(', ')}`)
        .join('; '),
    },
  ] as PlanRow[]).filter((row) => row.count > 0);

  const somethingToCreate = rows.some((row) => kinds[row.kind]);

  if (rows.length === 0) return null;

  const failures = results.filter((result) => !result.ok);

  return (
    <section className="card overflow-hidden p-0">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Wand2 className="size-4 text-navy-700" />
        <h3 className="text-13 font-bold text-ink">Не хватает в школе</h3>
        <span className="text-11 text-muted">
          Создаётся теми же разделами панели — классы, предметы, звонки, подгруппы
        </span>
      </header>

      {rows.length > 0 && (
        <table className="w-full text-13">
          <tbody>
            {rows.map((row) => (
              <tr key={row.kind} className="border-b border-line align-top">
                <td className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-line"
                    checked={kinds[row.kind]}
                    disabled={running}
                    onChange={(event) =>
                      onKindsChange({ ...kinds, [row.kind]: event.target.checked })
                    }
                    aria-label={`Создать: ${row.title}`}
                  />
                </td>
                <td className="w-44 px-3 py-2.5 font-semibold text-ink">
                  {row.title}
                  <span className="ml-1.5 font-normal text-muted">{row.count}</span>
                </td>
                <td className="px-3 py-2.5 text-11 text-muted">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="text-11 text-muted">
          Уроки после этого не создаются — это отдельный шаг ниже
        </div>
        <div className="flex items-center gap-3">
          {running && progress && (
            <span className="inline-flex items-center gap-2 text-13 text-muted">
              <Loader2 className="size-4 animate-spin" />
              {progress.label}: {progress.done}/{progress.total}
            </span>
          )}
          <Button onClick={onRun} loading={running} disabled={running || !somethingToCreate}>
            Создать недостающее
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-13">
            <Check className="size-4 text-success-fg" />
            <span className="font-semibold text-ink">
              Создано: {results.filter((result) => result.ok).length} из {results.length}
            </span>
          </div>
          {failures.length > 0 && (
            <ul className="mt-2 space-y-1 text-11 text-red-600">
              {failures.map((failure, index) => (
                <li key={`${failure.label}-${index}`} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  <span>
                    {failure.label}: {failure.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
