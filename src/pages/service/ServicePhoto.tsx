import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cx } from '@/lib/format';
import { serviceRequestsApi, type ServiceRequestPhoto } from '@/lib/serviceRequestsApi';

/**
 * Снимок заявки.
 *
 * Содержимое отдаётся потоком под авторизацией, поэтому `<img src>` на эндпоинт не
 * навести — в теге нет заголовка. Файл забирается запросом и живёт как object URL,
 * который обязательно освобождается при размонтировании: иначе просмотр десятка заявок
 * подряд оставит в памяти десяток картинок.
 */
export function ServicePhotoThumb({
  requestId,
  photo,
  size = 'sm',
  onOpen,
}: {
  requestId: number;
  photo: ServiceRequestPhoto;
  size?: 'sm' | 'md';
  onOpen?: () => void;
}) {
  const url = usePhotoUrl(requestId, photo.id);
  const box = size === 'md' ? 'size-24' : 'size-10';

  const content = url ? (
    <img src={url} alt={photo.fileName ?? 'Фото заявки'} className="size-full object-cover" />
  ) : (
    <span className="flex size-full items-center justify-center text-subtle">
      <ImageOff className="size-4" aria-hidden />
    </span>
  );

  if (!onOpen) {
    return (
      <span className={cx('block overflow-hidden rounded-lg bg-neutral-bg', box)}>{content}</span>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Открыть ${photo.fileName ?? 'фотографию'}`}
      className={cx(
        'block overflow-hidden rounded-lg bg-neutral-bg transition hover:opacity-90',
        box,
      )}
    >
      {content}
    </button>
  );
}

/**
 * Первый снимок и счётчик остальных — колонка «Фото» в списке (SERVICE-DESIGN-001 §3).
 * «+2» вместо второй и третьей миниатюры: в строке таблицы на них нет места, но знать,
 * что снимков больше одного, нужно.
 */
export function ServicePhotoCell({
  requestId,
  photos,
}: {
  requestId: number;
  photos: ServiceRequestPhoto[];
}) {
  const [first] = photos;
  if (!first) return <span className="text-subtle">—</span>;
  const extra = photos.length - 1;

  return (
    <span className="relative inline-block">
      <ServicePhotoThumb requestId={requestId} photo={first} />
      {extra > 0 && (
        <span className="absolute -bottom-1 -right-1 rounded-full bg-link px-1.5 text-10 font-bold leading-4 text-white">
          +{extra}
        </span>
      )}
    </span>
  );
}

/** Просмотр снимка во весь экран — наложением, а не новой вкладкой (§11). */
export function ServicePhotoViewer({
  requestId,
  photo,
  onClose,
}: {
  requestId: number;
  photo: ServiceRequestPhoto;
  onClose: () => void;
}) {
  const url = usePhotoUrl(requestId, photo.id);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.fileName ?? 'Фотография заявки'}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-8"
    >
      {url && <img src={url} alt={photo.fileName ?? ''} className="max-h-full max-w-full rounded-lg" />}
    </div>
  );
}

function usePhotoUrl(requestId: number, photoId: number | undefined): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (photoId == null) return;
    let objectUrl: string | undefined;
    let cancelled = false;
    void serviceRequestsApi
      .photo(requestId, photoId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        // Недоступный снимок не должен ронять страницу: на его месте останется заглушка.
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestId, photoId]);

  return url;
}
