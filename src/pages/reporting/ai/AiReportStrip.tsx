import { History, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, buttonClassName } from '@/components/ui/Button';

/**
 * Полоса «AI-сводка об успеваемости» между фильтрами и таблицей (Figma Т1, К1, А1). Своя полоса,
 * а не кнопки в шапке рядом с Excel — там они терялись (заметка дизайнера к Т1). У
 * администрации одна кнопка — «AI-отчёты»: формировать ему нечего.
 */
export function AiReportStrip({ description, historyHref, historyState, onCreate, createDisabledReason, admin = false }: {
  description: string;
  historyHref: string;
  historyState?: unknown;
  onCreate?: () => void;
  /** Почему сформировать нельзя (С5): READ-доступ не даёт генерации. */
  createDisabledReason?: string | null;
  admin?: boolean;
}) {
  return (
    <section aria-label="AI-сводка об успеваемости"
      className="flex flex-wrap items-center gap-4 rounded-2xl border border-ai-panel-line bg-ai-panel px-5 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-navy-700 shadow-sm">
        <Sparkles className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-15 font-semibold text-ink">{admin ? 'AI-отчёты учителей' : 'AI-сводка об успеваемости'}</p>
        <p className="text-13 text-slate-500">{createDisabledReason ?? description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to={historyHref} state={historyState}
          className={buttonClassName({ variant: admin ? 'navy' : 'secondary', size: 'sm' })}>
          <History className="size-4" aria-hidden="true" />
          {admin ? 'AI-отчёты' : 'История AI-отчётов'}
        </Link>
        {!admin && onCreate && (
          <Button variant="navy" size="sm" icon={<Sparkles className="size-4" />} disabled={Boolean(createDisabledReason)} onClick={onCreate}>
            Сформировать AI-сводку
          </Button>
        )}
      </div>
    </section>
  );
}

/** Плашка в шторке ученика (И1): «AI-сводка по ученику за этот период» → форма с подставленным учеником. */
export function AiStudentEntry({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ai-panel-line bg-ai-panel px-4 py-3">
      <span className="flex items-center gap-2 text-13 font-medium text-navy-700">
        <Sparkles className="size-4" aria-hidden="true" />
        AI-сводка по ученику за этот период
      </span>
      <Button variant="navy" size="sm" onClick={onCreate}>Сформировать</Button>
    </div>
  );
}
