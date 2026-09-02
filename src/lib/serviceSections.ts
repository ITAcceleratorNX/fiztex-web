import type { ServiceSection } from '@/lib/serviceRequestsApi';

/**
 * Вкладки раздела «Сервисные заявки» (ТЗ SERVICE-FE-001 §3, SERVICE-FE-004 §5, §9).
 *
 * Отдельным модулем от экрана, потому что вкладку нужно уметь и прочитать из адреса, и
 * записать в него: карточка заявки возвращает человека туда, откуда он пришёл, и знать
 * набор вкладок ей приходится тоже.
 */

/** Разделы Super Admin поверх авторских «Мои заявки» / «История». */
export type GlobalServiceSection = 'ALL' | 'AUDIT';

export type ServiceTabValue = ServiceSection | GlobalServiceSection;

export const SERVICE_TABS: ReadonlyArray<{
  value: ServiceTabValue;
  label: string;
  superAdminOnly?: boolean;
}> = [
  { value: 'ACTIVE', label: 'Мои заявки' },
  { value: 'HISTORY', label: 'История' },
  { value: 'ALL', label: 'Все заявки', superAdminOnly: true },
  { value: 'AUDIT', label: 'Журнал', superAdminOnly: true },
];

export function isGlobalServiceSection(value: ServiceTabValue): value is GlobalServiceSection {
  return value === 'ALL' || value === 'AUDIT';
}

/**
 * Вкладка из `?tab=`, ограниченная тем, что этой роли вообще доступно.
 *
 * Неизвестное и запрещённое значение читается как «Мои заявки», а не как ошибка: адрес
 * приходит из чужой ссылки и закладки чаще, чем из клика, и разворачивать человека на
 * страницу ошибки из-за лишнего параметра незачем.
 */
export function serviceSectionFrom(
  raw: string | null,
  allowed: ReadonlyArray<{ value: ServiceTabValue }>,
): ServiceTabValue {
  const wanted = raw?.toUpperCase();
  const match = allowed.find((tab) => tab.value === wanted);
  return match?.value ?? 'ACTIVE';
}

/**
 * Откуда карточка заявки вернёт человека назад.
 *
 * Super Admin открывает одну и ту же карточку из трёх мест, и «Сервисные заявки» в
 * хлебных крошках должны вести туда, откуда он пришёл, а не всегда в «Мои заявки».
 * Источник передаётся в адресе (`?from=all`), а не состоянием истории: ссылку на заявку
 * пересылают, и после перезагрузки состояние теряется, а параметр — нет.
 */
export function serviceListPath(from?: ServiceTabValue | null): string {
  if (!from || from === 'ACTIVE') return '/service';
  return `/service?tab=${from.toLowerCase()}`;
}

/** Читает `?from=` карточки обратно во вкладку. Чужое значение — «Мои заявки». */
export function serviceOriginFrom(raw: string | null): ServiceTabValue | null {
  const wanted = raw?.toUpperCase();
  return SERVICE_TABS.some((tab) => tab.value === wanted) ? (wanted as ServiceTabValue) : null;
}
