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
  /**
   * Политика конфиденциальности. Язык — в query (`?lang=en`), чтобы у русской
   * и английской версии были отдельные ссылки: их спрашивают магазины приложений.
   */
  privacy: '/privacy',
  privacyIn: (locale: 'ru' | 'en') => (locale === 'ru' ? '/privacy' : `/privacy?lang=${locale}`),

  /** Вход администратора. */
  staffLogin: '/staff/login',
  /** Домашний экран администратора (раньше был на `/`). */
  dashboard: '/dashboard',
  /** Домашние задания учителя (HOMEWORK-005.1). */
  homework: '/homework',
} as const;

/** Куда возвращать после входа, если пользователь не шёл на конкретную страницу. */
export const DEFAULT_AUTHENTICATED_ROUTE = ROUTES.dashboard;

/**
 * Стартовый экран по роли.
 *
 * Дашборд — админский: он сразу читает `/api/admin/academic-years`, а учительскому токену
 * это 401. Общий `request()` не отличает «нет прав» от «протух токен» (бэкенд в обоих
 * случаях отдаёт голый 401 без тела) и на всякий случай завершает сессию — учитель входил
 * и его тут же выбрасывало обратно на форму. Поэтому учителя встречает его собственный
 * раздел, а не общая главная.
 *
 * Меню учителя ограничено теми же правилами (`navSectionsForRole`), а прямой заход на
 * чужой адрес разворачивает `isRouteAllowedForRole`.
 */
export function landingRouteForRole(role: string | undefined): string {
  return role === 'TEACHER' ? ROUTES.homework : DEFAULT_AUTHENTICATED_ROUTE;
}

/**
 * Куда вести после входа с учётом того, откуда пользователя развернули.
 *
 * `Protected` запоминает страницу, на которую человек шёл, — но учителя разворачивает
 * с админских страниц сам бэкенд (401 → сессия сброшена), и в `from` оседает ровно тот
 * адрес, который его только что выбросил. Наивное «вернуть на from» превращает это в
 * петлю: вход → админская страница → 401 → форма входа с тем же `from` → вход → …
 * Выйти из неё нельзя, пока не почистишь состояние истории вручную.
 *
 * Поэтому `from` для учителя принимается, только если ведёт в доступный ему раздел.
 * Это не ролевая модель, а предохранитель: список разделов учителя пока состоит из ДЗ.
 */
export function loginRedirectTarget(from: unknown, role: string | undefined): string {
  const landing = landingRouteForRole(role);
  if (typeof from !== 'string' || !from) return landing;

  const target = safeRedirectTarget(from);
  if (role === 'TEACHER' && !target.startsWith(ROUTES.homework)) return landing;
  return target;
}

/**
 * Доступен ли маршрут этой роли.
 *
 * Учителю в этой панели принадлежит только раздел ДЗ: остальные экраны читают
 * `/api/admin/*`, а это 401, который общий `request()` трактует как конец сессии.
 * Поэтому прямой заход на чужой адрес разворачиваем сами — молча и без запроса,
 * иначе пользователь вместо «сюда нельзя» получает выход из системы.
 *
 * Это не замена серверной проверке прав: настоящая граница на бэкенде (ТЗ §3),
 * здесь — только маршрутизация.
 */
export function isRouteAllowedForRole(path: string, role: string | undefined): boolean {
  if (role !== 'TEACHER') return true;
  return path.startsWith(ROUTES.homework);
}

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
