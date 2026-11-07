import { request, requestMultipart } from './api';
import type { ContentEmbed, ContentEmbedPolicy, EmbedKind } from './contentEmbeds';

/**
 * Загрузка файла для вставки в текст (CONTENT-EMBED-001). Описание вставок уже сохранённого
 * текста отсюда не берётся: оно приходит вместе с материалом (`embeds`), который проверил права.
 */
export const contentAssetsApi = {
  policy: (signal?: AbortSignal) => request<ContentEmbedPolicy>('/content-assets/policy', { signal }),
  upload: (file: File, kind: EmbedKind) => {
    const body = new FormData();
    body.append('file', file);
    body.append('kind', kind === 'image' ? 'IMAGE' : 'FILE');
    return requestMultipart<ContentEmbed>('/content-assets', body);
  },
};
