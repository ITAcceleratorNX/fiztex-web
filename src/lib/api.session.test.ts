import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, onSessionExpired, request, requestBlob, requestMultipart, setToken } from './api';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const fetchMock = vi.fn<typeof fetch>();
const expired = vi.fn();
let unsubscribe: () => void;
const readers = [
  { name: 'JSON', read: () => request('/private') },
  { name: 'multipart', read: () => requestMultipart('/private', new FormData()) },
  { name: 'blob', read: () => requestBlob('/private') },
];

beforeEach(() => {
  setToken('session-a');
  fetchMock.mockReset();
  expired.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  unsubscribe = onSessionExpired(expired);
});

afterEach(() => {
  unsubscribe();
  setToken(null);
  vi.unstubAllGlobals();
});

describe.each(readers)('$name response session ownership', ({ read }) => {
  it.each([200, 401])('отбрасывает поздний ответ %s, не завершая новую сессию', async (status) => {
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);
    const result = read().catch((error: unknown) => error);
    setToken('session-b');
    response.resolve(new Response('{}', { status }));
    await expect(result).resolves.toMatchObject({ name: 'AbortError' });
    expect(getToken()).toBe('session-b');
    expect(expired).not.toHaveBeenCalled();
  });

  it('отличает новую сессию даже при повторном использовании того же токена', async () => {
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);
    const result = read().catch((error: unknown) => error);
    setToken(null);
    setToken('session-a');
    response.resolve(Response.json({ private: 'old data' }));
    await expect(result).resolves.toMatchObject({ name: 'AbortError' });
    expect(expired).not.toHaveBeenCalled();
  });

  it('по-прежнему завершает сессию при её собственном ответе 401', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(read()).rejects.toMatchObject({ status: 401 });
    expect(getToken()).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
  });

  it('повторно проверяет сессию после асинхронного чтения тела', async () => {
    const text = deferred<string>();
    const blob = deferred<Blob>();
    const response = new Response('{}');
    const textSpy = vi.spyOn(response, 'text').mockReturnValue(text.promise);
    const blobSpy = vi.spyOn(response, 'blob').mockReturnValue(blob.promise);
    fetchMock.mockResolvedValue(response);
    const result = read().catch((error: unknown) => error);
    await vi.waitFor(() => expect(textSpy.mock.calls.length + blobSpy.mock.calls.length).toBe(1));
    setToken('session-b');
    text.resolve('{"private":"old data"}');
    blob.resolve(new Blob(['old data']));
    await expect(result).resolves.toMatchObject({ name: 'AbortError' });
    expect(getToken()).toBe('session-b');
  });
});

it('отбрасывает незавершённый анонимный вход после выхода', async () => {
  setToken(null);
  const response = deferred<Response>();
  fetchMock.mockReturnValue(response.promise);
  const result = request('/auth/login', { method: 'POST', body: {} }).catch((error: unknown) => error);
  setToken(null);
  response.resolve(Response.json({ token: 'abandoned-login' }));
  await expect(result).resolves.toMatchObject({ name: 'AbortError' });
  expect(getToken()).toBeNull();
});
