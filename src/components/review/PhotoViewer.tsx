import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { ReviewPhoto } from '@/lib/types';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function PhotoViewer({ photos }: { photos: ReviewPhoto[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const open = openIdx !== null;
  const photo = openIdx !== null ? photos[openIdx] : null;

  const close = useCallback(() => {
    setOpenIdx(null);
    setZoom(1);
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2))));
  }, []);

  const goPrev = useCallback(() => {
    setOpenIdx((idx) => (idx != null && idx > 0 ? idx - 1 : idx));
    setZoom(1);
  }, []);

  const goNext = useCallback(() => {
    setOpenIdx((idx) => (idx != null && idx < photos.length - 1 ? idx + 1 : idx));
    setZoom(1);
  }, [photos.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === '+' || e.key === '=') adjustZoom(ZOOM_STEP);
      else if (e.key === '-') adjustZoom(-ZOOM_STEP);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close, goPrev, goNext, adjustZoom]);

  function handleWheel(e: { preventDefault: () => void; deltaY: number }) {
    e.preventDefault();
    adjustZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((item, photoIdx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setOpenIdx(photoIdx);
              setZoom(1);
            }}
            className="group relative block overflow-hidden rounded-lg ring-1 ring-slate-200 transition hover:ring-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <img
              src={item.url}
              alt={`Фото ${photoIdx + 1}`}
              className="h-28 w-28 object-cover transition group-hover:opacity-90"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition group-hover:bg-slate-900/20">
              <ZoomIn className="h-5 w-5 text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
            </span>
          </button>
        ))}
      </div>

      {open && photo && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-slate-950/90 backdrop-blur-sm animate-fade-in"
          onClick={close}
        >
          <div
            className="flex shrink-0 items-center justify-between gap-3 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-white/90">
              Фото {openIdx! + 1} из {photos.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => adjustZoom(-ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                aria-label="Уменьшить"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="min-w-[3.5rem] text-center text-sm tabular-nums text-white/90">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => adjustZoom(ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                aria-label="Увеличить"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={close}
                className="ml-2 rounded-lg p-2 text-white/80 transition hover:bg-white/10"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 pb-4"
            onWheel={handleWheel}
            onClick={(e) => e.stopPropagation()}
          >
            {openIdx! > 0 && (
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60 sm:left-4"
                aria-label="Предыдущее фото"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <img
              src={photo.url}
              alt={`Фото ${openIdx! + 1}`}
              draggable={false}
              className="max-h-full max-w-full select-none object-contain transition-transform duration-150 ease-out"
              style={{ transform: `scale(${zoom})` }}
            />
            {openIdx! < photos.length - 1 && (
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60 sm:right-4"
                aria-label="Следующее фото"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
