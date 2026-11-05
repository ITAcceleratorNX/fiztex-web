import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'danger-outline' | 'link' | 'soft' | 'navy' | 'success-soft' | 'warning-soft' | 'neutral-soft';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'text' | 'inline' | 'badge';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  endIcon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-300',
  secondary:
    'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-400',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:bg-red-300',
  'danger-ghost': 'bg-transparent text-red-600 hover:bg-red-50 active:bg-red-100 disabled:text-slate-400',
  // Разрушительное действие в шапке, которое не главное на экране (Figma `phyztex` 2460:2129
  // «Отклонить заявку»): белая кнопка с красной подписью и розовой рамкой.
  'danger-outline': 'bg-white text-red-700 ring-1 ring-inset ring-planning-danger-border hover:bg-planning-danger active:bg-red-50 disabled:text-slate-400',
  // Действие словом — в строке таблицы или списка («Сброс PIN», «Открыть», 2460:1845 / 2460:2564).
  // Используется с размерами `text` (13) и `inline` (14).
  link: 'bg-transparent text-navy-700 hover:text-navy-900 hover:underline disabled:text-slate-400 disabled:no-underline',
  // Второстепенное действие на сером, без рамки — «Вернуться ко входу» (2460:4758).
  soft: 'bg-field-filled text-planning-ink hover:bg-planning-row-line active:bg-planning-line disabled:text-slate-400',
  // Figma `btn-primary` — фирменный navy. Отдельный вариант, а не замена `primary`:
  // какая кнопка основная, оранжевая или синяя, — открытый продуктовый вопрос
  // (см. CLAUDE.md «Расхождения макета и кода»), а экранам, где макет прямо рисует
  // синюю кнопку действия («Показать QR»), она нужна уже сейчас.
  navy: 'bg-navy-700 text-white shadow-sm hover:bg-navy-800 active:bg-navy-900 disabled:bg-navy-400',
  'success-soft': 'bg-planning-success text-planning-success-fg ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100',
  'warning-soft': 'bg-orange-50 text-amber-700 ring-1 ring-inset ring-orange-200 hover:bg-orange-100',
  'neutral-soft': 'bg-planning-row-line text-slate-600 ring-1 ring-inset ring-planning-line hover:bg-slate-200',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  // Кнопка формы входа: 56 в высоту, круглая, кегль 16 (2460:4665 «Войти»).
  lg: 'h-14 px-6 text-base',
  icon: 'size-11 shrink-0 p-0 text-sm',
  'icon-sm': 'size-7 shrink-0 p-0 text-13',
  text: 'h-auto p-0 text-13',
  inline: 'h-auto p-0 text-sm',
  badge: 'h-7 px-2.5 text-xs',
};

/**
 * Классы кнопки без самого элемента.
 *
 * Нужны там, где по семантике должна быть ссылка, а не кнопка: переход на другой
 * маршрут обязан оставаться `<a>` (средний клик, «открыть в новой вкладке»,
 * скринридер). Экспортируем именно классы, чтобы у ссылки и кнопки не разъехался
 * вид — вместо копирования той же строки утилит по месту.
 */
export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cx(
    'inline-flex items-center justify-center font-semibold transition',
    size === 'badge' || size === 'icon-sm' ? 'rounded-lg' : size === 'lg' ? 'rounded-full' : 'rounded-xl',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  endIcon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      <span
        className={cx(
          'inline-flex items-center',
          (loading || (icon != null && icon !== false) || endIcon != null) && (size === 'sm' || size === 'badge' ? 'gap-1.5' : 'gap-2'),
        )}
      >
        <span
          className={cx(
            'inline-flex size-4 shrink-0 items-center justify-center',
            !loading && !icon && 'hidden',
          )}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
        </span>
        {children}
        {endIcon}
      </span>
    </button>
  );
}
