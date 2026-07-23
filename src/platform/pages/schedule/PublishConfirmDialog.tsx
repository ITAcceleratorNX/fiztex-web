import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { ConflictCheckReport } from '@/platform/services/schedules';

export function PublishConfirmDialog({
  open,
  report,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  report: ConflictCheckReport | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (confirmedWarningCodes: string[]) => void;
}) {
  const warningCodes = useMemo(() => {
    if (!report) return [] as string[];
    return [...new Set(report.warnings.map((w) => w.code))];
  }, [report]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !report) return;
    const next: Record<string, boolean> = {};
    for (const code of warningCodes) next[code] = false;
    setChecked(next);
  }, [open, report, warningCodes]);

  const allConfirmed =
    warningCodes.length === 0 || warningCodes.every((code) => checked[code]);

  const hasCriticals = (report?.criticals.length ?? 0) > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Публикация расписания"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            onClick={() =>
              onConfirm(warningCodes.filter((code) => checked[code]))
            }
            loading={loading}
            disabled={hasCriticals || !allConfirmed}
          >
            Опубликовать
          </Button>
        </>
      }
    >
      {!report ? (
        <p className="text-sm text-slate-600">Нет отчёта проверки.</p>
      ) : hasCriticals ? (
        <p className="text-sm text-red-700">
          Есть критические конфликты ({report.summary.criticalCount}). Исправьте их
          перед публикацией.
        </p>
      ) : warningCodes.length === 0 ? (
        <p className="text-sm text-slate-600">
          Конфликтов нет. Подтвердите публикацию черновика.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Перед публикацией подтвердите все предупреждения:
          </p>
          <ul className="space-y-2">
            {warningCodes.map((code) => {
              const sample = report.warnings.find((w) => w.code === code);
              return (
                <li key={code} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(checked[code])}
                      onChange={(e) =>
                        setChecked((prev) => ({ ...prev, [code]: e.target.checked }))
                      }
                    />
                    <span>
                      <span className="font-medium text-amber-950">{code}</span>
                      {sample?.message && (
                        <span className="mt-0.5 block text-amber-900">{sample.message}</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
