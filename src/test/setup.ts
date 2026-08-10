import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Автоочистка Testing Library включается сама, только когда у теста есть глобальный
// afterEach — а `globals` в vitest.config здесь не включены. Без этого разметка
// предыдущего теста остаётся в документе, и запросы вида getByRole внезапно находят
// два элемента вместо одного: тест падает не там, где ошибка.
afterEach(cleanup);
