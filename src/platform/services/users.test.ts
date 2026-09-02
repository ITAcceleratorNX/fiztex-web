import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, request };
});

const { changeEmployeeRole, findAccountByPhone, resetEmployeeAccess, setAccountActive } =
  await import('./users');

const account = (over: Record<string, unknown> = {}) => ({
  id: 9,
  role: 'CLEANING',
  status: 'ACTIVE',
  fullName: 'Оспанов Ерлан Маратович',
  phone: '+77019876543',
  email: null,
  relation: null,
  createdAt: '2026-08-01T07:00:00Z',
  ...over,
});

function lastCall(): [string, Record<string, unknown> | undefined] {
  const call = request.mock.calls.at(-1);
  return [call?.[0] as string, call?.[1] as Record<string, unknown> | undefined];
}

describe('управление сотрудником (SERVICE-FE-004 §3, SERVICE-BE-008)', () => {
  beforeEach(() => request.mockReset());

  it('смена роли уходит своим PATCH и возвращает карточку из ответа', async () => {
    request.mockResolvedValue(account({ role: 'TECHNICIAN' }));

    const updated = await changeEmployeeRole('9', 'TECHNICIAN');

    const [path, options] = lastCall();
    expect(path).toBe('/admin/accounts/9/role');
    expect(options).toMatchObject({ method: 'PATCH', body: { role: 'TECHNICIAN' } });
    // Новое состояние берём из ответа, а не собираем из того, что послали: заявки
    // сотрудника двигает бэкенд, и он же говорит, кем человек стал (§4).
    expect(updated.role).toBe('TECHNICIAN');
    expect(updated.id).toBe('9');
  });

  it('сброс доступа возвращает код, показываемый один раз', async () => {
    request.mockResolvedValue({ issuedCode: '48211903' });

    expect(await resetEmployeeAccess('9')).toBe('48211903');
    expect(lastCall()[0]).toBe('/admin/accounts/9/reset-access');
    expect(lastCall()[1]).toMatchObject({ method: 'POST' });
  });

  it('блокировка и разблокировка — это block и unblock', async () => {
    request.mockResolvedValue(undefined);

    await setAccountActive('9', false);
    expect(lastCall()[0]).toBe('/admin/accounts/9/block');

    await setAccountActive('9', true);
    expect(lastCall()[0]).toBe('/admin/accounts/9/unblock');
  });

  /**
   * §4: дубля по телефону быть не должно, а поиск на бэкенде — `LIKE '%…%'` по ФИО,
   * телефону и почте. Совпадение подстроки поэтому не считается совпадением номера:
   * иначе «+77019876543» нашёл бы «+770198765430» и предложил разблокировать не того.
   */
  it('телефон ищется точным совпадением, а не подстрокой', async () => {
    request.mockResolvedValue({
      content: [account({ id: 20, phone: '+770198765430' }), account()],
      totalElements: 2,
      totalPages: 1,
    });

    const found = await findAccountByPhone('+77019876543');

    expect(found?.id).toBe('9');
    expect(lastCall()[0]).toContain('query=%2B77019876543');
  });

  it('без совпадения по телефону отвечает «никого нет», а не первым попавшимся', async () => {
    request.mockResolvedValue({ content: [account({ phone: '+77000000000' })], totalElements: 1 });

    expect(await findAccountByPhone('+77019876543')).toBeNull();
  });

  it('пустой телефон не ходит на сервер вовсе', async () => {
    expect(await findAccountByPhone('')).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});
