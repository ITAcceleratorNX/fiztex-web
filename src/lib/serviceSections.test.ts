import { describe, expect, it } from 'vitest';
import {
  SERVICE_TABS,
  serviceListPath,
  serviceOriginFrom,
  serviceSectionFrom,
} from './serviceSections';

const ALL_TABS = SERVICE_TABS;
const AUTHOR_TABS = SERVICE_TABS.filter((tab) => !tab.superAdminOnly);

describe('вкладки сервисных заявок (SERVICE-FE-004 §5, §9)', () => {
  it('чужая вкладка в адресе не открывает чужой раздел', () => {
    expect(serviceSectionFrom('all', ALL_TABS)).toBe('ALL');
    expect(serviceSectionFrom('audit', ALL_TABS)).toBe('AUDIT');
    // Обычному админу «Все заявки» недоступны — параметр читается как «Мои заявки», а не
    // разворачивает его на страницу ошибки: ссылку могли просто переслать.
    expect(serviceSectionFrom('all', AUTHOR_TABS)).toBe('ACTIVE');
    expect(serviceSectionFrom('audit', AUTHOR_TABS)).toBe('ACTIVE');
    expect(serviceSectionFrom('history', AUTHOR_TABS)).toBe('HISTORY');
    expect(serviceSectionFrom(null, ALL_TABS)).toBe('ACTIVE');
    expect(serviceSectionFrom('чепуха', ALL_TABS)).toBe('ACTIVE');
  });

  it('карточка возвращает туда, откуда её открыли', () => {
    expect(serviceListPath('ALL')).toBe('/service?tab=all');
    expect(serviceListPath('AUDIT')).toBe('/service?tab=audit');
    // «Мои заявки» — раздел по умолчанию, и лишний параметр в адресе ему не нужен.
    expect(serviceListPath('ACTIVE')).toBe('/service');
    expect(serviceListPath(null)).toBe('/service');
  });

  it('источник перехода читается обратно, а подделанный — отбрасывается', () => {
    expect(serviceOriginFrom('all')).toBe('ALL');
    expect(serviceOriginFrom('AUDIT')).toBe('AUDIT');
    expect(serviceOriginFrom('evil')).toBeNull();
    expect(serviceOriginFrom(null)).toBeNull();
  });
});
