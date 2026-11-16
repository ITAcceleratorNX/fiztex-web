import type { ReactNode } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { cx } from '@/lib/format';

/**
 * Ход фоновой ИИ-задачи (Figma `КСП / Прогресс ИИ` 2212:8024): «ИИ составляет КСП…» с
 * полосами-заглушками на месте будущего текста или ошибка тем же блоком.
 *
 * Полосы, а не спиннер: результат — документ, и заглушка показывает, что появится именно
 * текст, а не «что-то грузится». Кнопок внутри нет: действия при ошибке («Повторить»,
 * «Изменить данные») экран ставит под блоком — их набор зависит от того, что есть в уроке.
 */
export function AiProgressPanel({
  state = 'running',
  title,
  description,
  className,
}: {
  state?: 'running' | 'error';
  title: string;
  description?: ReactNode;
  className?: string;
}) {
  const error = state === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      aria-live="polite"
      className={cx(
        'flex flex-col gap-3 rounded-xl border p-4',
        error ? 'border-red-200 bg-red-50' : 'border-ai-panel-line bg-ai-panel',
        className,
      )}
    >
      <p className={cx('flex items-center gap-2 text-13 font-semibold', error ? 'text-red-700' : 'text-navy-700')}>
        {error ? <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> : <Sparkles className="size-4 shrink-0" aria-hidden="true" />}
        {title}
      </p>
      {!error && (
        <div className="flex flex-col gap-2.5" aria-hidden="true">
          <span className="h-1.5 w-1/2 animate-pulse rounded-full bg-ai-panel-line" />
          <span className="h-1.5 w-2/5 animate-pulse rounded-full bg-ai-panel-line" />
          <span className="h-1.5 w-1/3 animate-pulse rounded-full bg-ai-panel-line" />
        </div>
      )}
      {description && <p className={cx('text-xs', error ? 'text-red-700' : 'text-planning-muted')}>{description}</p>}
    </div>
  );
}
