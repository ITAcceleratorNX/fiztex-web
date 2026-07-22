import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cx } from '@/lib/format';
import type { AccountStatus } from '../types';
import { ACCOUNT_STATUS_LABELS } from '../labels';

export function ProfileBreadcrumb({
  items,
}: {
  items: { label: string; to?: string }[];
}) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-xs">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="size-3 text-[#9ca3af]" />}
            {item.to && !last ? (
              <Link to={item.to} className="font-medium text-[#9ca3af] transition hover:text-navy-700">
                {item.label}
              </Link>
            ) : (
              <span className={cx('font-semibold', last ? 'text-navy-700' : 'font-medium text-[#9ca3af]')}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function ProfileStatusBadge({ status }: { status: AccountStatus }) {
  const styles: Record<AccountStatus, string> = {
    ACTIVE: 'bg-[#ecfdf5] text-[#059669]',
    NOT_ACTIVATED: 'bg-amber-50 text-amber-700',
    BLOCKED: 'bg-[#fee2e2] text-[#dc2626]',
    ARCHIVED: 'bg-slate-100 text-slate-500',
  };
  const dots: Record<AccountStatus, string> = {
    ACTIVE: 'bg-[#10b981]',
    NOT_ACTIVATED: 'bg-amber-500',
    BLOCKED: 'bg-[#ef4444]',
    ARCHIVED: 'bg-slate-400',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-[20px] px-2.5 py-1 text-[13px] font-semibold',
        styles[status],
      )}
    >
      <span className={cx('size-1.5 rounded-full', dots[status])} />
      {status === 'ACTIVE' ? 'Активен' : ACCOUNT_STATUS_LABELS[status]}
    </span>
  );
}

export function ProfileCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'rounded-2xl bg-white p-6 shadow-[0px_4px_6px_rgba(0,0,0,0.02)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ProfileCardTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-bold text-[#1a1f36]">{children}</h2>
      {action}
    </div>
  );
}

export function ProfileInfoField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase text-[#9ca3af]">{label}</p>
      <div className="text-sm font-medium text-[#1a1f36]">{value}</div>
    </div>
  );
}

export function ProfileEditButton({
  onClick,
  children = 'Редактировать',
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center rounded-lg border border-brand-500 bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600"
    >
      {children}
    </button>
  );
}

export function ProfileLinkAction({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] font-semibold text-brand-500 transition hover:text-brand-600"
    >
      {children}
    </button>
  );
}

export function SoftBadge({
  children,
  tone = 'green',
}: {
  children: ReactNode;
  tone?: 'green' | 'blue' | 'gray' | 'red';
}) {
  const tones = {
    green: 'bg-[#d1fae5] text-[#059669]',
    blue: 'bg-[#eff6ff] text-[#2563eb]',
    gray: 'bg-[#f3f4f6] text-[#6b7280]',
    red: 'bg-[#fee2e2] text-[#dc2626]',
  };
  return (
    <span className={cx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  );
}

export function IconActionButton({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-5 items-center justify-center rounded border border-navy-700 text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
