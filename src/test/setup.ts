import type {} from 'vitest/jsdom';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach } from 'vitest';

// Vitest 2 keeps Node's existing storage globals. Node 25's localStorage expects
// a file; neither native storage belongs to the current jsdom window. `window`
// is also globalThis here, so use the actual window from Vitest's jsdom instance.
for (const name of ['localStorage', 'sessionStorage'] as const) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: original?.enumerable ?? true,
    get: () => jsdom.window[name],
  });
  afterAll(() => {
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  });
}

// Автоочистка Testing Library включается сама, только когда у теста есть глобальный
// afterEach — а `globals` в vitest.config здесь не включены. Без этого разметка
// предыдущего теста остаётся в документе, и запросы вида getByRole внезапно находят
// два элемента вместо одного: тест падает не там, где ошибка.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

// jsdom does not implement scrolling; pages still exercise restoration state without
// emitting its "not implemented" console warning.
window.scrollTo = () => undefined;
