import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { QuestionFigure } from './QuestionFigure';
import { ApiError } from '@/lib/api';

export type QuestionImage = { imageId?: string; imageUrl?: string };

/** Upload changes the local draft; its saved version remains immutable. */
export function QuestionImagePicker({ imageUrl, disabled, onUpload, onChange, onBusyChange }: {
  imageUrl?: string;
  disabled: boolean;
  onUpload: (file: File) => Promise<QuestionImage>;
  onChange: (image: QuestionImage) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const callbacks = useRef({ onChange, onBusyChange });
  callbacks.current = { onChange, onBusyChange };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function pick(file?: File) {
    if (!file || busy || disabled) return;
    setError('');
    if (file.size > 10 * 1024 * 1024) { setError('Файл больше 10 МБ'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Допустимые форматы рисунка: JPEG, PNG, WebP'); return;
    }
    setBusy(true);
    callbacks.current.onBusyChange?.(true);
    try {
      const image = await onUpload(file);
      if (mounted.current) callbacks.current.onChange(image);
    } catch (caught) {
      if (mounted.current) setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить рисунок. Попробуйте ещё раз.');
    } finally {
      callbacks.current.onBusyChange?.(false);
      if (mounted.current) {
        setBusy(false);
        if (input.current) input.current.value = '';
      }
    }
  }

  return <div className="mt-4 space-y-2">
    <p className="label-base">Рисунок к вопросу</p>
    <QuestionFigure imageUrl={imageUrl} maxHeightClass="max-h-56" />
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" icon={<ImagePlus className="size-4" />}
        disabled={disabled || busy} loading={busy} onClick={() => input.current?.click()}>
        {imageUrl ? 'Заменить рисунок' : 'Прикрепить рисунок'}
      </Button>
      {imageUrl && <Button type="button" variant="secondary" size="sm" icon={<Trash2 className="size-4" />}
        disabled={disabled || busy} onClick={() => { setError(''); onChange({}); }}>Удалить рисунок</Button>}
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
      aria-label="Файл рисунка к вопросу" disabled={disabled || busy}
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void pick(file); }} />
    <p className="text-13 text-muted">JPEG, PNG или WebP до 10 МБ. Рисунок сохранится вместе с вопросом.</p>
    {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
  </div>;
}
