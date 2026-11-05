import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, request };
});

const { exportAccessCodesCsv, listAccessCodes } = await import('./accessCodes');

const account = (id: number, role = 'STUDENT') => ({
  id,
  role,
  status: 'ACTIVE',
  fullName: `Ученик ${id}`,
  phone: null,
  email: null,
  relation: null,
  createdAt: '2026-08-01T07:00:00Z',
});

const page = (ids: number[], totalPages: number, totalElements: number, role?: string) => ({
  content: ids.map((id) => account(id, role)),
  totalPages,
  totalElements,
});

describe('реестр «Коды и PIN»', () => {
  beforeEach(() => request.mockReset());

  it('берёт у сервера ровно запрошенную страницу с фильтрами', async () => {
    request.mockResolvedValue(page([26, 27], 10, 235));

    const result = await listAccessCodes({ query: 'Кодова', role: 'STUDENT', page: 1, size: 25 });

    expect(request).toHaveBeenCalledTimes(1);
    const path = request.mock.calls[0][0] as string;
    expect(path).toContain('/admin/accounts?');
    expect(path).toContain('role=STUDENT');
    expect(path).toContain('page=1');
    expect(path).toContain('size=25');
    expect(result).toMatchObject({ totalPages: 10, totalElements: 235 });
    expect(result.users.map((user) => user.id)).toEqual(['26', '27']);
  });

  it('CSV собирает все страницы, а не первые 200 аккаунтов, и без супер-админов', async () => {
    request
      .mockResolvedValueOnce(page([1, 2], 3, 5))
      .mockResolvedValueOnce({ ...page([3], 3, 5), content: [account(3), account(4, 'SUPER_ADMIN')] })
      .mockResolvedValueOnce(page([5], 3, 5));

    const { content } = await exportAccessCodesCsv();

    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls.map((call) => /page=(\d+)/.exec(call[0] as string)?.[1] ?? '0'))
      .toEqual(['0', '1', '2']);
    const ids = content.split('\n').slice(1).map((line) => line.split(',')[0]);
    expect(ids).toEqual(['1', '2', '3', '5']);
  });
});
