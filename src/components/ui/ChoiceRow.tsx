import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export function ChoiceRow({ icon, title, description, onClick, disabled = false, selected }: {
  icon: ReactNode;
  title: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={selected}
    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border bg-white px-3 py-2 text-left transition hover:border-navy-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-navy-700 bg-navy-50' : 'border-slate-200'}`}
  >
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-navy-700">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
      {description && <span className="mt-0.5 block truncate text-xs text-slate-500">{description}</span>}
    </span>
    <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
  </button>;
}
