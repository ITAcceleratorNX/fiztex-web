/**
 * Пути приложения в одном месте.
 *
 * <p>Приложение делится на две несвязанные зоны, и граница между ними — это то,
 * что легче всего сломать случайной правкой:
 *
 * - **публичная** (`/`, `/announcements/:id`, `/entrance`) — открывается без входа;
 * - **административная** (`/staff/login`, `/dashboard` и всё остальное) — под `Protected`.
 *
 * Главный экран отдан публичному разделу вступительных тестов, а вход
 * администратора уехал на неочевидный `/staff/login`: посторонний, открывший
 * корень сайта, видит анонсы, а не форму входа. Это не мера безопасности —
 * настоящая граница на бэкенде, — а вопрос того, кому адресована главная.
 */
export const ROUTES = {
  /** Публичный раздел анонсов — главная страница сайта. */
  publicAnnouncements: '/',
  publicAnnouncement: (id: number | string) => `/announcements/${id}`,
  /** Ввод персонального кода и прохождение теста. */
  entrance: '/entrance',

  /** Вход администратора. */
  staffLogin: '/staff/login',
  /** Домашний экран администратора (раньше был на `/`). */
  dashboard: '/dashboard',
} as const;

/** Куда возвращать после входа, если пользователь не шёл на конкретную страницу. */
export const DEFAULT_AUTHENTICATED_ROUTE = ROUTES.dashboard;

/**
 * Безопасный разбор `state.from` при редиректе на вход: принимаем только
 * внутренние пути. Внешний URL в `from` превратил бы форму входа в открытый
 * редирект.
 */
export function safeRedirectTarget(from: unknown): string {
  if (typeof from !== 'string') return DEFAULT_AUTHENTICATED_ROUTE;
  // `//host` и `/\host` браузер считает протокол-относительным адресом — это уже наружу.
  if (!from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) {
    return DEFAULT_AUTHENTICATED_ROUTE;
  }
  // Возвращать на публичные страницы после входа администратора незачем.
  if (from === ROUTES.publicAnnouncements || from.startsWith('/announcements')) {
    return DEFAULT_AUTHENTICATED_ROUTE;
  }
  return from;
}
