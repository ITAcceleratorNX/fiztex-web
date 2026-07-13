import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { entranceApi, fetchEntrancePhotoBlob } from '@/lib/entranceApi';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/format';
import type { AnswerPhotoRef } from '@/lib/entranceTypes';

type SlotState = 'idle' | 'uploading' | 'error';

function AuthenticatedPhoto({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setFailed(false);
    setSessionExpired(false);
    fetchEntrancePhotoBlob(url)
      .then((blobUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        objectUrl = blobUrl;
        setSrc(blobUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setSessionExpired(true);
        } else {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (sessionExpired) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-amber-50 px-1 text-center text-[10px] font-medium leading-tight text-amber-800 ring-1 ring-amber-200">
        Сессия истекла
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
        ?
      </div>
    );
  }

  if (!src) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200"
    />
  );
}

export function PhotoAnswerBlock({
  attemptId,
  questionId,
  maxPhotos,
  photos,
  disabled,
  onPhotosChange,
  onUploadFailed,
}: {
  attemptId: number;
  questionId: number;
  maxPhotos: number;
  photos: AnswerPhotoRef[];
  disabled?: boolean;
  onPhotosChange: (photos: AnswerPhotoRef[]) => void;
  /** Called when photo upload fails (e.g. offline) — parent may log connection_issue with throttle. */
  onUploadFailed?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [slotState, setSlotState] = useState<SlotState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const atLimit = photos.length >= maxPhotos;

  async function handleFile(file: File | null | undefined) {
    if (!file || disabled || atLimit) return;
    setSlotState('uploading');
    setErrorMessage(null);
    try {
      const uploaded = await entranceApi.uploadAnswerPhoto(attemptId, questionId, file);
      onPhotosChange([...photos, { id: uploaded.id, url: uploaded.url }]);
      setSlotState('idle');
    } catch (err) {
      setSlotState('error');
      const msg = err instanceof ApiError ? err.message : 'Не удалось загрузить фото';
      setErrorMessage(msg);
      onUploadFailed?.();
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    void handleFile(file);
    e.target.value = '';
  }

  async function handleDelete(photoId: number) {
    if (disabled) return;
    try {
      await entranceApi.deleteAnswerPhoto(attemptId, questionId, photoId);
      onPhotosChange(photos.filter((p) => p.id !== photoId));
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Не удалось удалить фото');
      setSlotState('error');
    }
  }

  function openPicker() {
    if (disabled || atLimit) return;
    inputRef.current?.click();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">
          Фото-ответ · {photos.length}/{maxPhotos}
        </p>
        {slotState === 'uploading' && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Загрузка…
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="relative">
            <AuthenticatedPhoto url={photo.url} alt="Фото ответа" />
            {!disabled && (
              <button
                type="button"
                title="Удалить фото"
                onClick={() => void handleDelete(photo.id)}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        {!atLimit && !disabled && (
          <button
            type="button"
            onClick={openPicker}
            disabled={slotState === 'uploading'}
            className={cx(
              'flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-white text-slate-500 transition',
              'hover:border-brand-400 hover:text-brand-600 disabled:opacity-50',
            )}
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px] font-medium">Добавить</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onInputChange}
      />

      <p className="mt-2 text-xs text-slate-500">
        <Camera className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
        На телефоне откроется камера, на компьютере — выбор файла. Допустимы JPEG, PNG, WebP.
      </p>

      {slotState === 'error' && errorMessage && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p>{errorMessage}</p>
            <p className="mt-1 text-amber-700">
              Если проблема повторяется, обратитесь к сотруднику школы.
            </p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={openPicker}>
              Повторить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
