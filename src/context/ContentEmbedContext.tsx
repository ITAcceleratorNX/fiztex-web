import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useContentEmbedPolicy, useUploadContentAsset } from '@/hooks/useContentEmbeds';
import type { ContentEmbed, ContentEmbedPolicy, EmbedKind } from '@/lib/contentEmbeds';

/**
 * Что нужно полю `RichTextField`, чтобы вставлять рисунки и файлы (CONTENT-EMBED-001):
 * политика сервера и загрузка.
 *
 * Компонент DS сам запросов не делает — их даёт провайдер у корня приложения. Отсюда два
 * свойства: экран с полем не тянет за собой запросы в своих тестах, а без провайдера поле
 * работает как прежнее текстовое — вставки показывает, но кнопок «Изображение» и «Документ»
 * у него нет.
 */
export interface ContentEmbedServices {
  policy?: ContentEmbedPolicy;
  upload?: (file: File, kind: EmbedKind) => Promise<ContentEmbed>;
}

const ContentEmbedContext = createContext<ContentEmbedServices>({});

export function ContentEmbedProvider({ children }: { children: ReactNode }) {
  const { admin, isAuthenticated } = useAuth();
  // Учебные материалы пишет только учитель: остальным политика не нужна, а у неавторизованного
  // её запрос ответил бы 401, который `request()` читает как конец сессии.
  const teacher = isAuthenticated && admin?.role === 'TEACHER';
  const policy = useContentEmbedPolicy(teacher);
  const { mutateAsync } = useUploadContentAsset();
  const value = useMemo<ContentEmbedServices>(() => (teacher
    ? { policy: policy.data, upload: (file, kind) => mutateAsync({ file, kind }) }
    : {}), [teacher, policy.data, mutateAsync]);
  return <ContentEmbedContext.Provider value={value}>{children}</ContentEmbedContext.Provider>;
}

/** Для тестов и сборок без корня приложения — те же услуги вручную. */
export const ContentEmbedServicesProvider = ContentEmbedContext.Provider;

export function useContentEmbedServices(): ContentEmbedServices {
  return useContext(ContentEmbedContext);
}
