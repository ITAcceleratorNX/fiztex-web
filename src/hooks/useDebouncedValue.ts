import { useEffect, useState } from 'react';

/**
 * Значение, успокоившееся после ввода.
 *
 * Нужно там, где строка поиска уходит на сервер: без задержки каждая набранная буква —
 * отдельный запрос, а нужен только последний. Ключ запроса поэтому строится на
 * успокоившемся значении, а поле ввода остаётся отзывчивым.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);

  return settled;
}
