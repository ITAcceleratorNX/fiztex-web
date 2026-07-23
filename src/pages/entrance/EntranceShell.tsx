import type { ReactNode } from 'react';
import { FileText, Home, LogOut, User } from 'lucide-react';
import { Logo, PhysTechMark } from '@/components/layout/Logo';
import { cx } from '@/lib/format';
import { APP_NAME } from '@/lib/branding';

type ShellVariant = 'default' | 'auth' | 'portal' | 'session' | 'plain';
type NavKey = 'home' | 'tests' | 'profile' | 'exit';

/**
 * Shell for the applicant entrance flow (mobile Figma).
 * - `auth` — navy full-bleed (code entry)
 * - `portal` — light list + floating logo + bottom nav
 * - `session` — light attempt / instruction / success chrome
 * - `plain` — bare light page (confirm)
 * - `default` — legacy light chrome
 */
export function EntranceShell({
  children,
  size = 'md',
  variant = 'default',
  applicantName,
  onExit,
  navActive = 'tests',
  showLogo = true,
}: {
  children: ReactNode;
  size?: 'md' | 'lg';
  variant?: ShellVariant;
  applicantName?: string;
  onExit?: () => void;
  navActive?: NavKey;
  showLogo?: boolean;
}) {
  if (variant === 'auth') {
    return (
      <div className="relative flex min-h-[100dvh] items-start justify-center overflow-hidden bg-navy-700 px-6 pb-10 pt-10 sm:items-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-20 size-[400px] rounded-full bg-brand-500/30 blur-[100px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <main className="relative z-10 w-full">{children}</main>
      </div>
    );
  }

  if (variant === 'plain') {
    return <div className="min-h-[100dvh] bg-[#f8fafc]">{children}</div>;
  }

  if (variant === 'portal') {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#fafbfc]">
        <div className="mx-auto w-full max-w-[390px] flex-1 px-4 pb-28 pt-3">
          {showLogo ? (
            <div className="mb-4 flex h-14 items-center justify-center rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.02)]">
              <Logo className="h-8 w-auto" />
            </div>
          ) : null}
          {children}
        </div>
        <MobileBottomNav active={navActive} onExit={onExit} applicantName={applicantName} />
      </div>
    );
  }

  if (variant === 'session') {
    return (
      <div className="min-h-[100dvh] bg-[#f8fafc]">
        <div className="mx-auto w-full max-w-[390px]">{children}</div>
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

function MobileBottomNav({
  active,
  onExit,
  applicantName,
}: {
  active: NavKey;
  onExit?: () => void;
  applicantName?: string;
}) {
  const item = (key: NavKey, icon: ReactNode, action?: () => void) => {
    const isActive = active === key;
    return (
      <button
        type="button"
        onClick={action}
        aria-label={key}
        title={key === 'profile' ? applicantName : undefined}
        className="flex h-12 w-[72px] items-center justify-center"
      >
        <span className={isActive ? 'text-brand-500' : 'text-[#64748b]'}>{icon}</span>
      </button>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <div className="flex h-[72px] w-[min(358px,calc(100%-32px))] items-center justify-between rounded-[28px] bg-white px-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        {item('home', <Home className="size-6" strokeWidth={2} />)}
        {item('tests', <FileText className="size-6" strokeWidth={2} />)}
        {item('profile', <User className="size-6" strokeWidth={2} />)}
        {item('exit', <LogOut className="size-6" strokeWidth={2} />, onExit)}
      </div>
    </nav>
  );
}
