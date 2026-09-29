import { useLayoutEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/** AppLayout прокручивает main, а не window. Позиции изолированы QueryClient сессии. */
export function useHomeworkListScroll(url: string, ready: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  useLayoutEffect(() => {
    if (!ready) return;
    const container = root.current?.closest('main');
    if (!container) return;
    const key = ['homework-list-scroll', url];
    container.scrollTop = client.getQueryData<number>(key) ?? 0;
    const remember = () => client.setQueryData(key, container.scrollTop);
    container.addEventListener('scroll', remember, { passive: true });
    return () => container.removeEventListener('scroll', remember);
  }, [url, ready, client]);
  return root;
}
