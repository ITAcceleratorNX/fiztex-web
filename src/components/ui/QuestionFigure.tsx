import { useEffect, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { cx } from '@/lib/format';

/**
 * Рисунок к вопросу — схема, график, чертёж, без которого задание не решается.
 *
 * <p>Увеличение открывается наложением поверх страницы, а не новой вкладкой: во время попытки
 * уход со страницы фиксируется античитом как нарушение, и «посмотреть чертёж поближе» не должно
 * им становиться.
 */
export function QuestionFigure({
  imageUrl,
  maxHeightClass = 'max-h-72',
}: {
  imageUrl: string | null | undefined;
  maxHeightClass?: string;
}) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zoomed]);

  if (!imageUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        title="Увеличить рисунок"
        className="group relative mt-4 block w-full overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white"
      >
        <img
          src={imageUrl}
          alt="Рисунок к вопросу"
          className={cx('mx-auto w-auto max-w-full object-contain', maxHeightClass)}
        />
        <span className="absolute right-2 top-2 hidden rounded-lg bg-white/90 p-1.5 text-slate-600 shadow-sm group-hover:block">
          <ZoomIn className="size-4" />
        </span>
      </button>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setZoomed(false)}
        >
          <img
            src={imageUrl}
            alt="Рисунок к вопросу"
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute right-4 top-4 rounded-xl bg-white/10 p-2 text-white transition hover:bg-white/20"
            title="Закрыть"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </>
  );
}
