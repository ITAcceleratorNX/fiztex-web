import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Рисунок поверх страницы — увеличение вставки в тексте (ТЗ §4 «просмотр в увеличенном виде»).
 *
 * Наложение, а не новая вкладка: та же причина, что у `QuestionFigure`, — во время попытки
 * уход со страницы античит считает нарушением, и «рассмотреть схему» не должно им становиться.
 */
export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 p-4"
      onClick={onClose}
    >
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" onClick={(event) => event.stopPropagation()} />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-xl bg-white/10 p-2 text-white transition hover:bg-white/20"
        title="Закрыть"
        aria-label="Закрыть"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}
