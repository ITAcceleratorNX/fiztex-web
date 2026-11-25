import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { cx } from '@/lib/format';

const tones = {
  info: 'border-blue-200 bg-blue-50 text-13 leading-relaxed text-blue-900',
  warning: 'border-amber-200 bg-amber-50 text-13 leading-relaxed text-amber-900',
  // Предупреждение в оранжевой гамме бренда (Figma `КСП / Плашка` 2212:8008): несохранённый
  // результат, расхождение темы и времени — «обратите внимание», а не «что-то сломалось».
  attention: 'border-brand-200 bg-brand-50 text-13 font-medium leading-relaxed text-orange-800',
  error: 'border-red-200 bg-red-50 text-13 leading-relaxed text-red-900',
  success: 'border-emerald-200 bg-emerald-50 text-13 leading-relaxed text-emerald-900',
  // Пояснение к форме в фирменном navy без рамки (Figma `phyztex` А2 2243:23946 — «Только
  // просмотр. Учитель сможет открыть эти данные…»): не предупреждение, а условие, на котором
  // выдаётся то, что заполняют ниже.
  navy: 'border-navy-50 bg-navy-50 text-13 leading-relaxed text-navy-900',
  // Отказ сохранить форму целиком (А14 2243:28076, А15 2243:28471): плотнее `error` — 14 px
  // тёмно-красным на почти белом, потому что стоит над полями и должен читаться раньше них.
  invalid: 'border-red-100 bg-red-50 text-sm font-medium leading-5 text-red-700',
};

const defaultIcons: Record<keyof typeof tones, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  attention: AlertTriangle,
  error: AlertTriangle,
  success: CheckCircle2,
  navy: Info,
  invalid: AlertTriangle,
};

/**
 * Плашка-сообщение над содержимым. `icon` заменяет значок тона, когда сообщение говорит о
 * своём (глаз «только просмотр», перечёркнутая сеть «нет связи»), а не об общем «внимание».
 */
export function StatusNotice({
  tone = 'info',
  icon,
  className,
  children,
}: {
  tone?: keyof typeof tones;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  const Icon = icon ?? defaultIcons[tone];
  const urgent = tone === 'error' || tone === 'invalid';
  return <div role={urgent ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-xl border px-4 py-3', tones[tone], className)}>
    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><div className="min-w-0 flex-1">{children}</div>
  </div>;
}
