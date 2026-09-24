import { useEffect, useRef } from 'react';
import { Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Markdown } from '@/components/ui/Markdown';

/**
 * Шпаргалка на весь экран — читать на уроке или вывести классу на проектор.
 *
 * Оверлей внутри страницы, а не новая вкладка: текст приходит под авторизацией и уже лежит
 * в кэше, а отдельный маршрут ради «показать то же самое крупнее» — лишний адрес. Устроен
 * как QR-оверлей посещаемости: Esc и крестик закрывают, фокус не уходит за его пределы,
 * страница под ним не прокручивается.
 */
export function LessonAiNoteReader({
  title,
  subtitle,
  text,
  onCopy,
  onClose,
}: {
  title: string;
  subtitle?: string;
  text: string;
  onCopy: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-surface animate-fade-in motion-reduce:animate-none"
    >
      <header className="flex items-center gap-4 border-b border-line px-6 py-4 sm:px-10">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-15 font-bold text-ink">{title}</h2>
          {subtitle && <p className="truncate text-13 text-muted">{subtitle}</p>}
        </div>
        <Button variant="secondary" onClick={onCopy}>
          <Copy className="size-4" aria-hidden />
          Копировать
        </Button>
        <button
          type="button"
          data-autofocus
          onClick={onClose}
          aria-label="Закрыть"
          className="rounded-lg p-2 text-subtle transition hover:bg-slate-100 hover:text-ink"
        >
          <X className="size-5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
        <Markdown source={text} math size="large" className="mx-auto" />
      </div>
    </div>
  );
}
