import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return <nav aria-label="Навигационная цепочка">
    <ol className="flex flex-wrap items-center gap-2 text-13">
      {items.map((item, index) => <Fragment key={`${item.label}-${index}`}>
        {index > 0 && <li aria-hidden="true"><ChevronRight className="size-3 text-slate-400" /></li>}
        <li className="min-w-0 break-words">{item.to
          ? <Link to={item.to} className="rounded font-medium text-muted hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700">{item.label}</Link>
          : <span aria-current="page" className="font-semibold text-navy-700">{item.label}</span>}
        </li>
      </Fragment>)}
    </ol>
  </nav>;
}
