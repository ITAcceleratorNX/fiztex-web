import { cx } from '@/lib/format';

const TONES: Record<string, { solid: string; soft: string }> = {
  PDF: { solid: 'bg-red-600 text-white', soft: 'bg-red-100 text-red-600' },
  DOCX: { solid: 'bg-blue-600 text-white', soft: 'bg-blue-100 text-blue-600' },
};

const NEUTRAL = { solid: 'bg-slate-500 text-white', soft: 'bg-slate-100 text-slate-500' };

/**
 * Формат файла плашкой: PDF красным, DOCX синим (Figma `File type` 2149:3172 — строка
 * таблицы учебников, `PDF badge` 2149:3440 — выбранный файл в форме загрузки).
 *
 * Принимает слово, а не MIME: у загруженного учебника формат определяет сервер по сигнатуре
 * (`TextbookView.format`), у выбранного, но ещё не отправленного файла есть только
 * расширение. Незнакомый формат рисуется нейтрально — плашка не должна обещать цветом то,
 * чего о файле никто не знает.
 */
export function FileTypeBadge({
  format,
  variant = 'solid',
}: {
  format: string | null | undefined;
  /** `solid` — в строке таблицы, `soft` — квадратом рядом с именем файла. */
  variant?: 'solid' | 'soft';
}) {
  const label = (format ?? '').trim().toUpperCase() || 'ФАЙЛ';
  const tone = TONES[label] ?? NEUTRAL;

  if (variant === 'soft') {
    return (
      <span
        className={cx(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-10 font-bold',
          tone.soft,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-1.5 py-1 text-10 font-bold leading-none',
        tone.solid,
      )}
    >
      {label}
    </span>
  );
}
