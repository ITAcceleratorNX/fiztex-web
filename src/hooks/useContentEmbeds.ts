import { useMutation, useQuery } from '@tanstack/react-query';
import { contentAssetsApi } from '@/lib/contentAssetsApi';
import type { EmbedKind } from '@/lib/contentEmbeds';

/**
 * Запросы вставок в текст (CONTENT-EMBED-001) — своим модулем, а не в `queries.ts`.
 *
 * Их зовёт сам компонент DS `RichTextField`, а он стоит на экранах, чьи тесты подменяют
 * `@/hooks/queries` целиком (`vi.mock` со списком нужных экрану хуков). Живи хуки там, каждый
 * такой тест обязан был бы знать о вставках, и новый экран с полем ломал бы чужие тесты.
 */
export const contentEmbedKeys = {
  policy: ['content-embeds', 'policy'] as const,
};

/** Что можно вставить. Политика меняется только с выкаткой — спрашиваем раз за сессию. */
export function useContentEmbedPolicy(enabled = true) {
  return useQuery({
    queryKey: contentEmbedKeys.policy,
    queryFn: ({ signal }) => contentAssetsApi.policy(signal),
    staleTime: Infinity,
    retry: false,
    enabled,
  });
}

export function useUploadContentAsset() {
  return useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: EmbedKind }) => contentAssetsApi.upload(file, kind),
  });
}
