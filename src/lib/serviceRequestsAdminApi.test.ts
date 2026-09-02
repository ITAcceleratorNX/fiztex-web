import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn().mockResolvedValue({ content: [] });

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, request };
});

const {
  EMPTY_AUDIT_FILTER,
  EMPTY_REQUESTS_FILTER,
  hasActiveFilters,
  serviceRequestsAdminApi,
} = await import('./serviceRequestsAdminApi');

function calledPath(): string {
  return request.mock.calls.at(-1)?.[0] as string;
}

describe('фильтры раздела «Все заявки» (SERVICE-FE-004 §6, §7)', () => {
  beforeEach(() => request.mockClear());

  it('пустой фильтр не добавляет ни одного условия', () => {
    void serviceRequestsAdminApi.all(EMPTY_REQUESTS_FILTER, 0);
    expect(calledPath()).toBe('/admin/service-requests?page=0&size=20');
  });

  /**
   * Регрессия: «обычные» — это `emergency=false`, а не «фильтра нет». Через `||` ложное
   * значение схлопывалось бы в `undefined`, и вариант «Обычные» молча показывал бы все
   * заявки подряд.
   */
  it('«обычные» уходят на сервер как emergency=false', () => {
    void serviceRequestsAdminApi.all({ ...EMPTY_REQUESTS_FILTER, emergency: false }, 0);
    expect(calledPath()).toContain('emergency=false');

    void serviceRequestsAdminApi.all({ ...EMPTY_REQUESTS_FILTER, emergency: true }, 0);
    expect(calledPath()).toContain('emergency=true');
  });

  it('все семь фильтров и поиск уходят параметрами запроса', () => {
    void serviceRequestsAdminApi.all(
      {
        status: 'IN_PROGRESS',
        serviceType: 'CLEANING',
        emergency: true,
        authorId: 7,
        assigneeId: 11,
        createdFrom: '2026-09-01',
        createdTo: '2026-09-30',
        search: '  1042  ',
      },
      2,
    );

    const path = calledPath();
    expect(path).toContain('status=IN_PROGRESS');
    expect(path).toContain('serviceType=CLEANING');
    expect(path).toContain('authorId=7');
    expect(path).toContain('assigneeId=11');
    expect(path).toContain('createdFrom=2026-09-01');
    expect(path).toContain('createdTo=2026-09-30');
    // Поиск один на пять полей (§7) и уходит обрезанным: пробелы вокруг номера — это
    // не часть номера.
    expect(path).toContain('q=1042');
    expect(path).toContain('page=2');
  });

  it('порядок сортировки клиент не задаёт', () => {
    // «Последняя активность сверху» — сортировка бэкенда (SERVICE-BE-007 §2). Прислать
    // свой `sort` значило бы перебить её и получить другой срез, чем показывает раздел.
    void serviceRequestsAdminApi.all(EMPTY_REQUESTS_FILTER, 0);
    expect(calledPath()).not.toContain('sort=');
  });

  it('знает, стоит ли хоть один фильтр', () => {
    expect(hasActiveFilters(EMPTY_REQUESTS_FILTER)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_REQUESTS_FILTER, emergency: false })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_REQUESTS_FILTER, search: '   ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_REQUESTS_FILTER, search: 'кран' })).toBe(true);
  });
});

describe('глобальный журнал (SERVICE-FE-004 §9)', () => {
  beforeEach(() => request.mockClear());

  it('читается только своим эндпоинтом и только GET', () => {
    void serviceRequestsAdminApi.audit(EMPTY_AUDIT_FILTER, 0);
    expect(calledPath()).toBe('/admin/service-requests/audit?page=0&size=30');
    // Второй аргумент — опции запроса; метода в них нет, значит уходит GET.
    expect(request.mock.calls.at(-1)?.[1]).not.toHaveProperty('method');
  });

  it('фильтры журнала уходят параметрами', () => {
    void serviceRequestsAdminApi.audit(
      { requestId: 42, actorId: 3, action: 'TRANSFERRED', from: '2026-09-01', to: '2026-09-02' },
      1,
    );
    const path = calledPath();
    expect(path).toContain('requestId=42');
    expect(path).toContain('actorId=3');
    expect(path).toContain('action=TRANSFERRED');
    expect(path).toContain('from=2026-09-01');
    expect(path).toContain('to=2026-09-02');
    expect(path).toContain('page=1');
  });
});
