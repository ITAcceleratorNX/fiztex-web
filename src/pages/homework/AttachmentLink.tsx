import { useEffect, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { PhotoViewer } from '@/components/review/PhotoViewer';
import { cx } from '@/lib/format';
import type { Attachment } from '@/lib/homeworkApi';

/**
 * Вложение работы или фотография проверки.
 *
 * Содержимое отдаётся потоком под авторизацией, поэтому ни `<img src>`, ни обычная ссылка
 * на эндпоинт не работают — в них нет заголовка. Файл забирается запросом и живёт как
 * object URL, который обязательно освобождается при размонтировании: иначе просмотр
 * десятка работ подряд оставит в памяти десяток картинок.
 */
export function AttachmentChip({
  attachment,
  load,
}: {
  attachment: Attachment;
  load: (id: number) => Promise<Blob>;
}) {
  const [busy, setBusy] = useState(false);

  async function open() {
    if (attachment.id == null || busy) return;
    setBusy(true);
    try {
      const blob = await load(attachment.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      // Вкладка уже держит содержимое, ссылка больше не нужна.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className={cx(
        'inline-flex items-center gap-1.5 rounded bg-info-bg px-2 py-1 text-11 text-link transition',
        busy ? 'opacity-60' : 'hover:underline',
      )}
    >
      <Paperclip className="size-3" aria-hidden />
      {attachment.fileName ?? `Файл ${attachment.id}`}
    </button>
  );
}

/** Фотография проверки или работы — грузится тем же способом, но показывается картинкой. */
export function AttachmentThumb({
  attachment,
  load,
}: {
  attachment: Attachment;
  load: (id: number) => Promise<Blob>;
}) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (attachment.id == null) return;
    let objectUrl: string | undefined;
    let cancelled = false;
    void load(attachment.id).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, load]);

  return (
    <span className="block size-20 overflow-hidden rounded-lg bg-neutral-bg">
      {url ? (
        <img src={url} alt={attachment.fileName ?? 'Фото'} className="size-full object-cover" />
      ) : null}
    </span>
  );
}

/**
 * Фотографии одной работы: миниатюры, а по нажатию — крупный просмотр с листанием всех
 * снимков, масштабом и возвратом к карточке (QA B2-037). Раньше миниатюра в 80 точек была
 * единственным способом увидеть снимок, и текст и формулы на нём было не разобрать.
 *
 * Просмотр — наложение поверх страницы, а не новая вкладка: учитель остаётся у той же работы
 * того же ученика. Снимки грузятся под авторизацией и живут как object URL, которые
 * освобождаются при уходе со страницы.
 */
export function AttachmentGallery({
  attachments,
  load,
}: {
  attachments: Attachment[];
  load: (id: number) => Promise<Blob>;
}) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const ids = attachments.map((item) => item.id).filter((id): id is number => id != null);
  const key = ids.join(',');

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    setUrls({});
    for (const id of key ? key.split(',').map(Number) : []) {
      void load(id).then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        created.push(url);
        setUrls((prev) => ({ ...prev, [id]: url }));
      }).catch(() => undefined);
    }
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [key, load]);

  // Порядок — тот, в котором ученик прислал снимки: страницы решения читаются подряд.
  const ready = ids.filter((id) => urls[id]).map((id) => ({ id, url: urls[id] }));
  const pending = ids.length - ready.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ready.length > 0 && <PhotoViewer photos={ready} />}
      {pending > 0 && (
        <span className="text-11 text-subtle" aria-live="polite">
          Загружаем фото: {pending}
        </span>
      )}
    </div>
  );
}
