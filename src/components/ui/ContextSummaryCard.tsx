import type { ReactNode } from 'react';

export function ContextSummaryCard({ marker, eyebrow, title, children }: { marker: ReactNode; eyebrow: ReactNode; title: ReactNode; children?: ReactNode }) {
  return <section className="flex items-center gap-6 rounded-xl border border-planning-line bg-surface p-5">
    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-info-bg text-xl font-bold text-navy-700">{marker}</span>
    <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-planning-subtle">{eyebrow}</p><h2 className="mt-1 text-base font-bold text-planning-ink">{title}</h2>{children && <div className="mt-1 text-13 leading-relaxed text-planning-muted">{children}</div>}</div>
  </section>;
}
