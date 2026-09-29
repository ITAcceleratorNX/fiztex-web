import { StrictMode, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { getToken, request, setToken } from '@/lib/api';
import { keys } from '@/hooks/queries';
import { ProfilePage } from '@/pages/ProfilePage';
import type { Admin } from '@/lib/types';
import { useFormDraftStore, type FormDraftStore } from './FormDraftContext';

const ADMIN: Admin = { email: 'admin', fullName: 'Администратор A', role: 'SUPER_ADMIN', token: 'token-admin' };
const TEACHER_A: Admin = { email: 'teacher-a', fullName: 'Учитель A', role: 'TEACHER', token: 'token-a' };
const TEACHER_B: Admin = { email: 'teacher-b', fullName: 'Учитель B', role: 'TEACHER', token: 'token-b' };
const accounts = [ADMIN, TEACHER_A, TEACHER_B];

function profile(account: Admin) {
  return { accountId: accounts.indexOf(account) + 1, fullName: account.fullName, role: account.role, email: account.email, children: [] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

let auth: ReturnType<typeof useAuth>;
let client: QueryClient;
let drafts: FormDraftStore;
const clients = new Set<QueryClient>();
const fetchMock = vi.fn<typeof fetch>();

function SessionContents() {
  auth = useAuth();
  client = useQueryClient();
  drafts = useFormDraftStore();
  clients.add(client);
  const location = useLocation();
  const [draft, setDraft] = useState('');
  return (
    <>
      <output data-testid="auth-location">{location.pathname + location.search + location.hash}</output>
      <output data-testid="auth-location-state">{JSON.stringify(location.state ?? null)}</output>
      <input aria-label="Локальный черновик" value={draft} onChange={(event) => setDraft(event.target.value)} />
      {auth.isAuthenticated ? <ProfilePage /> : <p>Нет сессии</p>}
    </>
  );
}

function renderSession(account: Admin, initialEntries = ['/']) {
  setToken(account.token);
  localStorage.setItem('fiztex.profile', JSON.stringify(account));
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider><SessionContents /></AuthProvider>
      </MemoryRouter>
    </StrictMode>,
  );
}

beforeEach(() => {
  localStorage.clear();
  setToken(null);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url, init) => {
    if (url === '/api/auth/login') {
      const { login } = JSON.parse(init?.body as string) as { login: string };
      const account = accounts.find((item) => item.email === login);
      if (!account) throw new Error('Unknown test account');
      return Response.json(account);
    }
    if (url === '/api/auth/logout') return new Response(null, { status: 204 });
    if (url === '/api/me/profile') {
      const account = accounts.find((item) => `Bearer ${item.token}` === new Headers(init?.headers).get('Authorization'));
      if (!account) throw new Error('Missing test session');
      return Response.json(profile(account));
    }
    if (url === '/api/expired') return new Response(null, { status: 401 });
    throw new Error(`Unexpected request: ${String(url)}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  clients.forEach((queryClient) => queryClient.clear());
  clients.clear();
  setToken(null);
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('account session isolation', () => {
  it('явный выход очищает адрес возврата перед следующим входом', async () => {
    renderSession(TEACHER_A, ['/homework/new?lessonId=42&groupId=7#questions']);
    await screen.findByText(TEACHER_A.email);

    act(() => auth.logout());

    expect(screen.getByTestId('auth-location')).toHaveTextContent('/staff/login');
    expect(screen.getByTestId('auth-location-state')).toHaveTextContent('null');
  });

  it('отмена выхода оставляет черновик, сессию и фокус; подтверждённый выход очищает их', async () => {
    renderSession(TEACHER_A);
    await screen.findByText(TEACHER_A.email);
    const oldDrafts = drafts;
    const file = new File(['private'], 'work.pdf');
    drafts.set('homework:new:5', { title: 'Личный черновик', files: [file] });
    const input = screen.getByLabelText('Локальный черновик');
    input.focus();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => auth.logout());
    expect(getToken()).toBe(TEACHER_A.token);
    expect(drafts.hasChanges).toBe(true);
    expect(input).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/logout', expect.anything());
    confirm.mockReturnValue(true);
    act(() => auth.logout());
    expect(oldDrafts.hasChanges).toBe(false);
    await act(() => auth.login(TEACHER_B.email, 'test-password'));
    expect(drafts.get('homework:new:5')).toBeUndefined();
    oldDrafts.set('homework:new:5', { title: 'Поздний ответ' });
    expect(oldDrafts.hasChanges).toBe(false);
    expect(drafts.hasChanges).toBe(false);
    confirm.mockRestore();
  });

  it('истечение сессии удаляет локальные черновики без переноса в новый аккаунт', async () => {
    renderSession(TEACHER_A);
    await screen.findByText(TEACHER_A.email);
    const oldDrafts = drafts;
    drafts.set('homework:edit:8', { title: 'Личные данные' });
    await act(async () => { await expect(request('/expired')).rejects.toMatchObject({ status: 401 }); });
    expect(oldDrafts.hasChanges).toBe(false);
    expect(drafts.hasChanges).toBe(false);
    expect(auth.expiredAccountEmail).toBe(TEACHER_A.email);
  });

  it.each([ADMIN, TEACHER_A])('не показывает профиль $email после входа другого учителя', async (previous) => {
    renderSession(previous);
    await screen.findByText(previous.email);
    const oldClient = client;
    await oldClient.getMutationCache().build(oldClient, {
      mutationKey: ['private-mutation'],
      mutationFn: async () => 'private result',
    }).execute(undefined);
    fireEvent.change(screen.getByLabelText('Локальный черновик'), { target: { value: 'private draft' } });

    act(() => auth.logout());
    expect(screen.getByText('Нет сессии')).toBeInTheDocument();
    expect(oldClient.getQueryCache().getAll()).toHaveLength(0);
    expect(oldClient.getMutationCache().getAll()).toHaveLength(0);
    expect(screen.getByLabelText('Локальный черновик')).toHaveValue('');

    const nextProfile = deferred<Response>();
    const defaultFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url, init) => url === '/api/me/profile'
      ? nextProfile.promise.then((response) => response.clone())
      : defaultFetch(url, init));
    await act(() => auth.login(TEACHER_B.email, 'test-password'));

    expect(client).not.toBe(oldClient);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(screen.queryByText(previous.fullName)).not.toBeInTheDocument();
    expect(screen.queryByText(previous.email)).not.toBeInTheDocument();
    expect(screen.getByText(TEACHER_B.fullName)).toBeInTheDocument();
    expect(client.getQueryData(keys.myProfile)).toBeUndefined();

    await act(async () => nextProfile.resolve(Response.json(profile(TEACHER_B))));
    await screen.findByText(TEACHER_B.email);
    expect(client.getQueryData(keys.myProfile)).toEqual(profile(TEACHER_B));
  });

  it('изолирует прямую смену аккаунта и повторный вход в тот же аккаунт', async () => {
    renderSession(ADMIN);
    await screen.findByText(ADMIN.email);
    const adminClient = client;
    await act(() => auth.login(TEACHER_B.email, 'test-password'));
    await screen.findByText(TEACHER_B.email);
    expect(client).not.toBe(adminClient);
    expect(adminClient.getQueryCache().getAll()).toHaveLength(0);
    const teacherClient = client;
    await act(() => auth.login(TEACHER_B.email, 'test-password'));
    await screen.findByText(TEACHER_B.email);
    expect(client).not.toBe(teacherClient);
    expect(teacherClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('очищает сессию и её данные при актуальном ответе 401', async () => {
    renderSession(TEACHER_A);
    await screen.findByText(TEACHER_A.email);
    const oldClient = client;
    await act(async () => {
      await expect(request('/expired')).rejects.toMatchObject({ status: 401 });
    });
    expect(getToken()).toBeNull();
    expect(localStorage.getItem('fiztex.profile')).toBeNull();
    expect(screen.getByText('Нет сессии')).toBeInTheDocument();
    expect(screen.queryByText(TEACHER_A.fullName)).not.toBeInTheDocument();
    expect(oldClient.getQueryCache().getAll()).toHaveLength(0);
    expect(client).not.toBe(oldClient);
  });

  it('не размонтирует анонимную форму при отклонённом входе', async () => {
    renderSession(ADMIN);
    await screen.findByText(ADMIN.email);
    act(() => auth.logout());
    const anonymousClient = client;
    fireEvent.change(screen.getByLabelText('Локальный черновик'), { target: { value: 'login input' } });
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await act(async () => {
      await expect(auth.login(TEACHER_B.email, 'wrong-password')).rejects.toMatchObject({ status: 401 });
    });
    expect(client).toBe(anonymousClient);
    expect(screen.getByLabelText('Локальный черновик')).toHaveValue('login input');
    expect(screen.getByText('Нет сессии')).toBeInTheDocument();
  });

  it.each([200, 401])('отменяет старую загрузку и игнорирует её поздний ответ %s', async (status) => {
    const pending = deferred<Response>();
    const signals: AbortSignal[] = [];
    const defaultFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url, init) => {
      if (url === '/api/me/profile' && new Headers(init?.headers).get('Authorization') === `Bearer ${TEACHER_A.token}`) {
        if (init?.signal) signals.push(init.signal);
        // Deliberately ignore abort to model a response already in flight.
        return pending.promise;
      }
      return defaultFetch(url, init);
    });
    renderSession(TEACHER_A);
    await waitFor(() => expect(signals.length).toBeGreaterThan(0));
    const oldClient = client;
    act(() => auth.logout());
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    await act(() => auth.login(TEACHER_B.email, 'test-password'));
    await screen.findByText(TEACHER_B.email);

    await act(async () => pending.resolve(status === 200 ? Response.json(profile(TEACHER_A)) : new Response(null, { status })));
    expect(getToken()).toBe(TEACHER_B.token);
    expect(screen.getByText(TEACHER_B.email)).toBeInTheDocument();
    expect(screen.queryByText(TEACHER_A.fullName)).not.toBeInTheDocument();
    expect(client.getQueryData(keys.myProfile)).toEqual(profile(TEACHER_B));
    expect(oldClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('не применяет результат мутации предыдущей сессии', async () => {
    renderSession(TEACHER_A);
    await screen.findByText(TEACHER_A.email);
    const pending = deferred<Response>();
    const defaultFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url, init) => url === '/api/save' ? pending.promise : defaultFetch(url, init));
    const oldClient = client;
    const onSuccess = vi.fn();
    const mutation = oldClient.getMutationCache().build(oldClient, {
      mutationFn: () => request('/save', { method: 'POST', body: { draft: 'private' } }),
      onSuccess,
    });
    const result = mutation.execute(undefined).catch((error: unknown) => error);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/save', expect.anything()));
    act(() => auth.logout());
    await act(() => auth.login(TEACHER_B.email, 'test-password'));
    await screen.findByText(TEACHER_B.email);
    pending.resolve(Response.json({ private: 'old result' }));
    await expect(result).resolves.toMatchObject({ name: 'AbortError' });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(client.getQueryData(keys.myProfile)).toEqual(profile(TEACHER_B));
  });
});
