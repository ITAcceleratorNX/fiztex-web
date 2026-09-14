import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud, XCircle } from 'lucide-react';
import { cx } from '@/lib/format';
import { FileTypeBadge } from './FileTypeBadge';

/**
 * Поле выбора одного файла: зона «перетащите или нажмите», а после выбора — карточка файла
 * с форматом и крестиком (Figma `Upload dropzone` 2149:3299 и `Attached file` 2149:3439).
 *
 * Компонент только выбирает файл. Что считать допустимым, решает форма: `accept` сужает
 * системный диалог, но перетаскивание его обходит, а настоящую проверку формата всё равно
 * делает сервер по сигнатуре.
 */
export function FileDropzone({
  file,
  onChange,
  accept,
  formatsLabel,
  disabled = false,
  error = false,
  id,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  /** Подпись под приглашением, например «PDF, DOCX». */
  formatsLabel?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function take(files: FileList | null | undefined) {
    // FileList живой: после сброса `value` он пустеет, поэтому файл забирается раньше.
    // Сброс нужен, чтобы повторный выбор того же файла снова вызвал onChange.
    const picked = files?.[0] ?? null;
    if (input.current) input.current.value = '';
    if (picked) onChange(picked);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) take(event.dataTransfer.files);
  }

  const hiddenInput = (
    <input
      ref={input}
      type="file"
      accept={accept}
      className="hidden"
      disabled={disabled}
      onChange={(event) => take(event.target.files)}
    />
  );

  if (file) {
    return (
      <div
        className={cx(
          'flex items-center gap-2.5 rounded-xl border bg-slate-50 px-3 py-2.5',
          error ? 'border-red-300' : 'border-slate-200',
        )}
      >
        {hiddenInput}
        <FileTypeBadge format={extensionOf(file.name)} variant="soft" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700" title={file.name}>
          {file.name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label="Убрать файл"
          className="shrink-0 text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed"
        >
          <XCircle className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      {hiddenInput}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-4 transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50',
          'disabled:cursor-not-allowed disabled:opacity-60',
          dragging
            ? 'border-brand-400 bg-brand-50'
            : error
              ? 'border-red-300 bg-slate-50'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400',
        )}
      >
        <UploadCloud className="size-5 text-slate-400" aria-hidden />
        <span className="text-13 text-slate-400">Перетащите файл или нажмите для загрузки</span>
        {formatsLabel && <span className="text-xs text-slate-300">{formatsLabel}</span>}
      </button>
    </>
  );
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1) : '';
}
