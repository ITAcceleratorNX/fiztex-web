import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setToken } from './api';

const fetchMock = vi.fn<typeof fetch>();

const refusal = () =>
  new Response(JSON.stringify({ message: 'Код активации неверный или уже использован' }), { status: 400 });
const session = (role: string) =>
  new Response(JSON.stringify({ token: 't', role, fullName: 'Тест' }), { status: 200 });

const paths = () => fetchMock.mock.calls.map(([url]) => String(url));

beforeEach(() => {
  setToken(null);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api.activate', () => {
  it('учителя активирует с первого пути', async () => {
    fetchMock.mockResolvedValueOnce(session('TEACHER'));

    const admin = await api.activate('+77000000000', 'CODE', 'test-password-1');

    expect(admin.role).toBe('TEACHER');
    expect(paths()).toEqual(['/api/auth/teacher/activate']);
  });

  it('после отказа 400 пробует путь администратора, затем служебный', async () => {
    fetchMock
      .mockResolvedValueOnce(refusal())
      .mockResolvedValueOnce(refusal())
      .mockResolvedValueOnce(session('CLEANER'));

    const admin = await api.activate('+77000000000', 'CODE', 'test-password-1');

    expect(admin.role).toBe('CLEANER');
    expect(paths()).toEqual([
      '/api/auth/teacher/activate',
      '/api/auth/admin/activate',
      '/api/auth/staff/activate',
    ]);
  });

  it('если отказали все три пути, отдаёт отказ', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(refusal()));

    await expect(api.activate('+77000000000', 'CODE', 'test-password-1')).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('обрыв связи и 5xx не повод стучаться в следующий путь', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network'));

    const error = await api.activate('+77000000000', 'CODE', 'test-password-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
