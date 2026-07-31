import { AlertTriangle } from 'lucide-react';
import { pluralRu } from '@/lib/format';
import type { TemplateUsage } from '@/lib/scheduleSettingsTypes';

/**
 * Предупреждение при изменении используемого шаблона. Figma 2015:9128
 * «warning-banner» — самостоятельная карточка, не по спеке ModalCard
 * (radius 16, p 40, тень 0 20px 30px rgba(0,0,0,.2), центрирована по тексту).
 */
export function TemplateInUseWarning({
  open,
  usage,
  loading,
  onCancel,
  onConfirmImpact,
  onCopy,
}: {
  open: boolean;
  usage: TemplateUsage | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirmImpact: () => void;
  onCopy: () => void;
}) {
  if (!open) return null;

  const drafts = usage?.draftSchedules ?? 0;
  const published = usage?.publishedSchedules ?? 0;
  const total = drafts + published;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 animate-fade-in" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="template-in-use-title"
        className="relative flex w-full max-w-[480px] flex-col items-center gap-2 rounded-2xl bg-white p-10 shadow-[0_20px_30px_rgba(0,0,0,0.2)] animate-scale-in"
      >
        <span className="flex size-14 items-center justify-center rounded-3xl bg-amber-50">
          <AlertTriangle className="size-6 text-amber-700" />
        </span>
        <p
          id="template-in-use-title"
          className="w-[300px] text-center text-lg font-bold text-amber-800"
        >
          Этот шаблон используется в {total} {pluralRu(total, ['расписании', 'расписаниях', 'расписаниях'])} (
          {drafts} {pluralRu(drafts, ['черновик', 'черновика', 'черновиков'])}, {published}{' '}
          опубликовано)
        </p>
        <div className="flex w-full items-center gap-16 pt-4">
          <button
            type="button"
            onClick={onConfirmImpact}
            disabled={loading}
            className="flex h-[43px] flex-1 items-center justify-center rounded-lg border border-amber-200 bg-white px-3.5 text-13 font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Редактировать всё равно
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={loading}
            className="flex h-[43px] flex-1 items-center justify-center rounded-lg bg-brand-500 px-3.5 text-13 font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-300"
          >
            Создать копию
          </button>
        </div>
      </div>
    </div>
  );
}
