import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { TimeInput } from '@/components/ui/TimeInput';
import { cx } from '@/lib/format';
import {
  breakAfterMinutes,
  emptyPeriodDraft,
  type PeriodDraft,
  type PeriodValidation,
} from './periodDraft';

export function LessonPeriodsEditor({
  rows,
  validation,
  onChange,
  onRequestDelete,
  disabled,
}: {
  rows: PeriodDraft[];
  validation: PeriodValidation;
  onChange: (next: PeriodDraft[]) => void;
  /** Called when user removes a row that exists on server (needs confirm). Return rows without that key if allowed. */
  onRequestDelete: (row: PeriodDraft) => void;
  disabled?: boolean;
}) {
  const sorted = [...rows].sort((a, b) => a.lessonNumber - b.lessonNumber);

  function updateRow(key: string, patch: Partial<PeriodDraft>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const last = sorted[sorted.length - 1];
    onChange([...rows, emptyPeriodDraft(last)]);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">Уроки</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={addRow}
          disabled={disabled}
        >
          Добавить урок
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 font-semibold">№</th>
              <th className="px-3 py-2.5 font-semibold">Начало</th>
              <th className="px-3 py-2.5 font-semibold">Конец</th>
              <th className="px-3 py-2.5 font-semibold">Перемена после</th>
              <th className="w-12 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                  Добавьте хотя бы один урок
                </td>
              </tr>
            )}
            {sorted.map((row, index) => {
              const err = validation.byKey[row.key];
              const hasError =
                Boolean(err?.endBeforeStart) ||
                Boolean(err?.duplicateNumber) ||
                (err?.overlapWithKeys?.length ?? 0) > 0;
              const breakMins = breakAfterMinutes(sorted, index);
              const breakLabel =
                breakMins == null
                  ? '—'
                  : breakMins < 0
                    ? `пересечение ${Math.abs(breakMins)} мин`
                    : `${breakMins} мин`;

              return (
                <tr
                  key={row.key}
                  className={cx(
                    'border-b border-slate-50 last:border-0',
                    hasError && 'bg-red-50/60',
                  )}
                >
                  <td className="px-3 py-2 align-top">
                    <TextInput
                      type="number"
                      min={1}
                      value={row.lessonNumber}
                      disabled={disabled}
                      error={Boolean(err?.duplicateNumber)}
                      className="w-16"
                      onChange={(e) =>
                        updateRow(row.key, { lessonNumber: Number(e.target.value) || 1 })
                      }
                    />
                    {err?.duplicateNumber && (
                      <p className="mt-1 text-[11px] text-red-500">Дубль номера</p>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <TimeInput
                      value={row.startTime}
                      disabled={disabled}
                      error={Boolean(err?.endBeforeStart) || Boolean(err?.overlapWithKeys?.length)}
                      className="w-24"
                      onChange={(startTime) => updateRow(row.key, { startTime })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <TimeInput
                      value={row.endTime}
                      disabled={disabled}
                      error={Boolean(err?.endBeforeStart) || Boolean(err?.overlapWithKeys?.length)}
                      className="w-24"
                      onChange={(endTime) => updateRow(row.key, { endTime })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && index === sorted.length - 1 && !disabled) {
                          e.preventDefault();
                          addRow();
                        }
                      }}
                    />
                    {err?.endBeforeStart && (
                      <p className="mt-1 text-[11px] text-red-500">Конец позже начала</p>
                    )}
                    {err?.overlapWithKeys && err.overlapWithKeys.length > 0 && (
                      <p className="mt-1 text-[11px] text-red-500">Пересечение с другим уроком</p>
                    )}
                  </td>
                  <td
                    className={cx(
                      'px-3 py-2 align-middle text-slate-500',
                      breakMins != null && breakMins < 0 && 'font-medium text-red-600',
                    )}
                  >
                    {breakLabel}
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <button
                      type="button"
                      disabled={disabled}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      aria-label="Удалить урок"
                      onClick={() => onRequestDelete(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Касание конец = начало следующего не считается пересечением. Стрелки ↑↓ на времени —
        шаг 5 минут.
      </p>
    </div>
  );
}
