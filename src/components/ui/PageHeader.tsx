import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, buttonClassName } from './Button';

type BackAction = { label: string } & (
  | { to: string; onClick?: never; disabled?: never }
  | { to?: never; onClick: () => void; disabled?: boolean }
);

/** Общая шапка страницы: длинное название переносится, действия не сжимают его. */
export function PageHeader({ title, description, back, actions, meta }: {
  title: ReactNode;
  description?: ReactNode;
  back?: BackAction;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return <header className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
    <div className="flex min-w-0 flex-1 items-start gap-3">
      {back && (back.to != null
        ? <Link to={back.to} aria-label={back.label} title={back.label}
          className={buttonClassName({ variant: 'secondary', size: 'icon' })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        : <Button variant="secondary" size="icon" onClick={back.onClick} disabled={back.disabled}
          aria-label={back.label} title={back.label} icon={<ArrowLeft className="size-4" />} />)}
      <div className="min-w-0 flex-1 space-y-2">
        <h1 className="break-words text-24 font-bold leading-tight text-ink sm:text-28">{title}</h1>
        {description && <p className="max-w-3xl text-sm leading-relaxed text-muted">{description}</p>}
        {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
    </div>
    {actions && <div className="flex max-w-full flex-wrap items-center gap-2 xl:max-w-md xl:justify-end">{actions}</div>}
  </header>;
}
