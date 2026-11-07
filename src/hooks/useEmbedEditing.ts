import { useCallback, useMemo, useState } from 'react';
import { embedErrorOf, mergeEmbeds, type ContentEmbed } from '@/lib/contentEmbeds';

/**
 * Общее для экранов с `RichTextField` (CONTENT-EMBED-001):
 * - описания вставок = ответ сервера + свежие загрузки — иначе только что вставленный рисунок в
 *   предпросмотре до сохранения был бы «недоступен»;
 * - «идёт загрузка» — экран не даёт сохранять, пока маркер не встал в текст;
 * - вставка, отклонённая сервером при сохранении, — для подсветки нужной карточки.
 */
export function useEmbedEditing(serverEmbeds: ContentEmbed[] | null | undefined) {
  const [uploads, setUploads] = useState<ContentEmbed[]>([]);
  const [busy, setBusy] = useState(0);
  const [rejected, setRejected] = useState<{ field: string; id: string | null } | null>(null);
  const embeds = useMemo(() => mergeEmbeds(serverEmbeds, uploads), [serverEmbeds, uploads]);

  const onUploaded = useCallback((embed: ContentEmbed) => setUploads((previous) => [...previous, embed]), []);
  const onBusyChange = useCallback((value: boolean) => setBusy((count) => Math.max(0, count + (value ? 1 : -1))), []);

  const fieldProps = useCallback((field: string) => ({
    embeds,
    onUploaded,
    onBusyChange,
    invalidEmbedId: rejected?.field === field ? rejected.id : null,
  }), [embeds, onUploaded, onBusyChange, rejected]);

  /** Запомнить отказ по вставке; `true` — это был он. */
  const rememberRejection = useCallback((caught: unknown) => {
    const rejection = embedErrorOf(caught);
    setRejected(rejection);
    return rejection != null;
  }, []);

  return {
    embeds,
    uploading: busy > 0,
    fieldProps,
    rememberRejection,
    clearRejection: useCallback(() => setRejected(null), []),
  };
}
