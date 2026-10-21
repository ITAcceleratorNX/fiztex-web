import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Figma workspace section/detail hierarchy, independent of the feature's data. */
export function WorkspacePageHeader({ title, backTo, backLabel, section = false, description, meta, status, actions }: {
  title: ReactNode; backTo: string; backLabel: string; section?: boolean; description?: ReactNode;
  meta?: ReactNode; status?: ReactNode; actions?: ReactNode;
}) {
  const breadcrumb = <div className="flex items-center gap-4">
    <Link to={backTo} aria-label={backLabel} title={backLabel} className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"><ArrowLeft className="size-4" /></Link>
    <div className="min-w-0"><Link to="/workspace" className="text-11 font-semibold uppercase text-slate-500 hover:text-navy-700">Рабочее пространство</Link>
      {section && <h1 className="mt-1 text-26 font-bold leading-tight text-planning-ink">{title}</h1>}
    </div>
  </div>;
  return <header className={section ? 'space-y-8' : 'space-y-6'}>
    <div className="flex flex-wrap items-center justify-between gap-4">{breadcrumb}{section && actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}</div>
    {!section && <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1"><h1 className="text-28 font-extrabold leading-tight text-planning-ink">{title}</h1>{meta && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-planning-muted">{meta}</div>}</div>
      <div className="flex flex-wrap items-center gap-3">{status}{actions}</div>
    </div>}
    {description && <p className="text-15 leading-relaxed text-planning-muted">{description}</p>}
  </header>;
}
