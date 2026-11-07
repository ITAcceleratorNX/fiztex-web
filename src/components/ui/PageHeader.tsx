import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cx } from '@/lib/format';
import { Button, buttonClassName } from './Button';

type BackAction = {
  label: string;
  /**
   * `button` — квадратная кнопка со стрелкой слева от заголовка; `link` — строка
   * «← Раздел» над заголовком (Figma `phyztex` 2460:2129 «← Заявки на доступ»).
   */
  appearance?: 'button' | 'link';
} & (
  | { to: string; onClick?: never; disabled?: never }
  | { to?: never; onClick: () => void; disabled?: boolean }
);

const BACK_LINK = 'inline-flex items-center gap-1 self-start text-13 text-planning-subtle transition hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Общая шапка страницы: длинное название переносится, действия не сжимают его.
 *
 * `eyebrow` — подпись раздела над заголовком («Управление школой», 2460:1845). Действия
 * по умолчанию стоят вровень с заголовком; `actionsAlign="end"` опускает их к последней
 * строке шапки, как кнопка «Отклонить заявку» в 2460:2129.
 */
export function PageHeader({ title, description, back, actions, meta, eyebrow, actionsAlign = 'start' }: {
  title: ReactNode;
  description?: ReactNode;
  back?: BackAction;
  actions?: ReactNode;
  meta?: ReactNode;
  eyebrow?: ReactNode;
  actionsAlign?: 'start' | 'end';
}) {
  const backLink = back?.appearance === 'link';
  return <header className={cx('flex min-w-0 flex-col gap-4 xl:flex-row xl:justify-between', actionsAlign === 'end' ? 'xl:items-end' : 'xl:items-start')}>
    <div className="flex min-w-0 flex-1 items-start gap-3">
      {back && !backLink && (back.to != null
        ? <Link to={back.to} aria-label={back.label} title={back.label}
          className={buttonClassName({ variant: 'secondary', size: 'icon' })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        : <Button variant="secondary" size="icon" onClick={back.onClick} disabled={back.disabled}
          aria-label={back.label} title={back.label} icon={<ArrowLeft className="size-4" />} />)}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {back && backLink && (back.to != null
          ? <Link to={back.to} className={BACK_LINK}>
            <ArrowLeft className="size-3.5" aria-hidden="true" />{back.label}
          </Link>
          : <button type="button" onClick={back.onClick} disabled={back.disabled} className={BACK_LINK}>
            <ArrowLeft className="size-3.5" aria-hidden="true" />{back.label}
          </button>)}
        {eyebrow && <p className="text-13 text-planning-subtle">{eyebrow}</p>}
        <h1 className="break-words text-24 font-bold leading-tight text-ink sm:text-28">{title}</h1>
        {description && <p className="max-w-3xl text-sm leading-relaxed text-muted">{description}</p>}
        {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
    </div>
    {actions && <div className="flex max-w-full flex-wrap items-center gap-2 xl:max-w-md xl:justify-end">{actions}</div>}
  </header>;
}
