import { useEffect } from 'react';
import { ADMIN_TITLE } from '@/lib/branding';

/**
 * Заголовок вкладки для страницы.
 *
 * <p>`main.tsx` ставит {@link ADMIN_TITLE} один раз при загрузке — это верно для
 * админки, но не для публичных страниц, куда теперь ведёт корень сайта. Хук
 * подменяет заголовок на время жизни страницы и возвращает админский при уходе,
 * чтобы SPA-переход не оставил «Вступительные тесты» висеть над админкой.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = ADMIN_TITLE;
    };
  }, [title]);
}
