import type { ReactNode } from 'react';
import { Logo, PhysTechMark } from '@/components/layout/Logo';
import { cx, initials } from '@/lib/format';
import { APP_NAME } from '@/lib/branding';

type ShellVariant = 'default' | 'auth' | 'portal' | 'session';

/**
 * Shell for the applicant entrance flow.
 * - `auth` — navy full-bleed card (code / confirm)
 * - `portal` — light grid + header/footer (tests list / results)
 * - `session` — navy page + white header (instruction / attempt / finished)
 * - `default` — legacy light chrome
 */
export function EntranceShell({
  children,
  size = 'md',
  variant = 'default',
  applicantName,
  onExit,
}: {
  children: ReactNode;
  size?: 'md' | 'lg';
  variant?: ShellVariant;
  applicantName?: string;
  onExit?: () => void;
}) {
  if (variant === 'auth') {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-700 px-4 py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/25 blur-[120px]"
        />
        <div className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 opacity-[0.18]">
          <PhysTechMark className="h-14 w-14 text-white" />
          <p className="text-2xl font-bold tracking-wide text-white">{APP_NAME}</p>
        </div>
        <main className="relative z-10 w-full max-w-[540px]">{children}</main>
      </div>
    );
  }

  if (variant === 'portal') {
    return (
      <div className="flex min-h-screen flex-col bg-grid">
        <PortalHeader applicantName={applicantName} onExit={onExit} />
        <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-8 sm:px-10">{children}</main>
        <PortalFooter />
      </div>
    );
  }

  if (variant === 'session') {
    return (
      <div className="flex min-h-screen flex-col bg-navy-700">
        <PortalHeader applicantName={applicantName} onExit={onExit} elevated />
        <main
          className={cx(
            'mx-auto w-full flex-1 px-4 py-6 sm:px-8 sm:py-8',
            size === 'lg' ? 'max-w-4xl' : 'max-w-3xl',
          )}
        >
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-700 text-white">
            <PhysTechMark className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-navy-800">{APP_NAME}</p>
            <p className="text-xs text-slate-500">Вступительное тестирование</p>
          </div>
        </div>
      </header>
      <main
        className={cx(
          'mx-auto w-full px-4 py-8 sm:py-10',
          size === 'lg' ? 'max-w-3xl' : 'max-w-md',
        )}
      >
        {children}
      </main>
    </div>
  );
}

function PortalHeader({
  applicantName,
  onExit,
  elevated,
}: {
  applicantName?: string;
  onExit?: () => void;
  elevated?: boolean;
}) {
  const initial = applicantName ? initials(applicantName).slice(0, 1) : 'А';
  return (
    <header
      className={cx(
        'relative z-20 bg-white',
        elevated
          ? 'rounded-b-2xl shadow-[0_4px_16px_rgba(0,0,0,0.08)]'
          : 'shadow-[0_1px_0_rgba(15,23,42,0.06)]',
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-[1100px] items-center justify-between gap-4 px-6 sm:px-10">
        <Logo className="h-8 w-auto" />
        <div className="flex items-center gap-3">
          {applicantName ? (
            <p className="hidden text-sm font-semibold text-navy-700 sm:block">{applicantName}</p>
          ) : null}
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-700 text-sm font-bold text-white">
            {initial}
          </span>
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className="h-9 rounded-lg border border-navy-700/40 bg-white px-3.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
            >
              Выйти
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function PortalFooter() {
  return (
    <footer className="border-t border-slate-200/80 bg-white/60">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <Logo className="h-5 w-auto opacity-70" />
        <p className="text-xs text-slate-400">© 2026 Phystech. Все права защищены.</p>
      </div>
    </footer>
  );
}
