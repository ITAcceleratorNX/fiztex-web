import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { cx } from '@/lib/format';
import type { ConflictCheckReport } from '@/platform/services/schedules';
import { ModalActions, ModalCard, MODAL_PRIMARY, MODAL_SECONDARY } from './ModalCard';

export type PublishStage = 'confirm' | 'success' | 'error';

export interface PublishSummary {
  year: string;
  period: string;
  className: string;
  lessonCount: number;
  /** Готовая строка вида «сегодня в 15:10» для экрана успеха. */
  publishedAt?: string;
}

/**
 * Публикация расписания. Три состояния по макетам:
 * 2015:16715 — без замечаний, 2015:16289 — с предупреждениями (чекбокс),
 * 2015:17138 — опубликовано, 2015:17554 — не удалось.
 *
 * Карточка везде одинаковая: 480, p 32, gap 24.
 */
export function PublishConfirmDialog({
  open,
  stage = 'confirm',
  report,
  summary,
  loading,
  onClose,
  onConfirm,
  onRetry,
}: {
  open: boolean;
  stage?: PublishStage;
  report: ConflictCheckReport | null;
  summary?: PublishSummary;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (confirmedWarningCodes: string[]) => void;
  onRetry?: () => void;
}) {
  const warningCodes = useMemo(() => {
    if (!report) return [] as string[];
    return [...new Set(report.warnings.map((w) => w.code))];
  }, [report]);

  // В макете один чекбокс на все предупреждения, а не по одному на код.
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open, stage]);

  const hasCriticals = (report?.criticals.length ?? 0) > 0;
  const canPublish = !hasCriticals && (warningCodes.length === 0 || confirmed);

  // 2015:17138 — успех
  if (stage === 'success') {
    return (
      <ModalCard
        open={open}
        onClose={onClose}
        labelledBy="publish-title"
        className="max-w-[480px] gap-6 p-8"
      >
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-3xl bg-success-bg">
            <Check className="size-5 text-success-fg" />
          </span>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h2 id="publish-title" className="text-lg font-bold text-ink">
              Расписание опубликовано
            </h2>
            {summary && (
              <p className="text-13 text-muted">
                {[summary.className, summary.period, summary.publishedAt]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cx(MODAL_PRIMARY, 'w-full bg-brand-500 py-2.5 hover:bg-brand-600')}
        >
          Вернуться к расписанию
        </button>
      </ModalCard>
    );
  }

  // 2015:17554 — не удалось опубликовать
  if (stage === 'error') {
    return (
      <ModalCard
        open={open}
        onClose={onClose}
        labelledBy="publish-title"
        className="max-w-[480px] gap-6 p-8"
      >
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-3xl bg-red-50">
            <AlertTriangle className="size-5 text-red-500" />
          </span>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h2 id="publish-title" className="text-lg font-bold text-ink">
              Не удалось опубликовать расписание
            </h2>
            <p className="text-13 text-muted">Попробуйте ещё раз через несколько секунд.</p>
          </div>
        </div>
        <ModalActions>
          <button type="button" onClick={onClose} className={cx(MODAL_SECONDARY, 'text-ink')}>
            Отмена
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className={cx(
              MODAL_PRIMARY,
              'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600',
            )}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Повторить
          </button>
        </ModalActions>
      </ModalCard>
    );
  }

  // 2015:16715 / 2015:16289 — подтверждение
  return (
    <ModalCard
      open={open}
      onClose={onClose}
      labelledBy="publish-title"
      className="max-w-[480px] gap-6 p-8"
    >
      <h2 id="publish-title" className="text-lg font-bold text-ink">
        Опубликовать расписание
      </h2>

      {/* 2015:16718 — summary-block */}
      {summary && (
        <dl className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4 text-13">
          <SummaryRow label="Учебный год" value={summary.year} />
          <SummaryRow label="Период" value={summary.period} />
          <SummaryRow label="Класс" value={summary.className} />
          <SummaryRow label="Уроков" value={String(summary.lessonCount)} />
        </dl>
      )}

      {hasCriticals ? (
        <p className="text-13 text-red-600">
          Есть критические конфликты ({report?.summary.criticalCount}). Исправьте их перед
          публикацией.
        </p>
      ) : warningCodes.length > 0 ? (
        // 2015:16305 — checkbox-container
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="size-[18px] shrink-0 rounded border-gray-300 text-navy-700 focus:ring-navy-700"
          />
          <span className="text-13 text-ink">
            Я подтверждаю публикацию с предупреждениями ({warningCodes.length})
          </span>
        </label>
      ) : null}

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className={cx(MODAL_SECONDARY, 'text-ink')}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={() => onConfirm(warningCodes)}
          disabled={!canPublish || loading}
          className={cx(
            MODAL_PRIMARY,
            'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600',
          )}
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Опубликовать
        </button>
      </ModalActions>
    </ModalCard>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
