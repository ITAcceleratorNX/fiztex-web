import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serviceRequestsApi, type ServiceRequest, type ServiceRequestStatus } from '@/lib/serviceRequestsApi';
import { useServiceRequests } from './queries';

const list = vi.spyOn(serviceRequestsApi, 'my');

afterEach(() => list.mockReset());

function request(id: number, status: ServiceRequestStatus, times: { createdAt?: string; completedAt?: string; cancelledAt?: string } = {}): ServiceRequest {
  return { id, status, requestNumber: String(id), ...times };
}
function page(content: ServiceRequest[], totalElements: number, number: number, size = 50) {
  const totalPages = Math.ceil(totalElements / size);
  return { content, totalElements, totalPages, number, size, last: number + 1 >= totalPages };
}
function setup(section: 'ACTIVE' | 'HISTORY' = 'ACTIVE') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { ...renderHook(({ section }: { section: 'ACTIVE' | 'HISTORY' }) => useServiceRequests(section), { initialProps: { section }, wrapper }), client };
}

describe('полная постраничная загрузка своих сервисных заявок', () => {
  it('исчерпывает каждый статус, объединяет разные объёмы и сохраняет общий total', async () => {
    list.mockImplementation(async ({ status, page: index = 0, size = 50 }) => {
      const total = status === 'NEW' ? 101 : 2;
      const content = status === 'NEW'
        ? Array.from({ length: Math.max(0, Math.min(size, total - index * size)) }, (_, i) => request(index * size + i + 1, 'NEW', { createdAt: new Date(1_000_000 - (index * size + i) * 1000).toISOString() }))
        : [request(201, 'IN_PROGRESS', { createdAt: new Date(2_000_000).toISOString() }), request(202, 'IN_PROGRESS', { createdAt: new Date(1_500_000).toISOString() })];
      return page(content, total, index);
    });
    const { result } = setup();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.content).toHaveLength(103);
    expect(result.current.data?.totalElements).toBe(103);
    expect(result.current.data?.streams).toEqual([
      { status: 'NEW', totalElements: 101, pagesFetched: 3, complete: true },
      { status: 'IN_PROGRESS', totalElements: 2, pagesFetched: 1, complete: true },
    ]);
    expect(list.mock.calls.map(([params]) => `${params.status}:${params.page}`)).toEqual(expect.arrayContaining(['NEW:0', 'NEW:1', 'NEW:2', 'IN_PROGRESS:0']));
    expect(list.mock.calls.every(([params]) => params.size === 50)).toBe(true);
    const ids = result.current.data!.content!.map((item) => item.id);
    expect(new Set(ids).size).toBe(103);
    expect(result.current.data!.content!.slice(0, 3).map((item) => item.id)).toEqual([201, 202, 1]);
  });

  it('исчерпывает историю каждого статуса и сортирует по последнему событию с устойчивым tie-break', async () => {
    list.mockImplementation(async ({ status, page: index = 0 }) => {
      if (status === 'COMPLETED') return page(index === 0
        ? [request(11, 'COMPLETED', { createdAt: '2026-01-01T00:00:00Z', completedAt: '2026-09-10T00:00:00Z' })]
        : [request(12, 'COMPLETED', { createdAt: '2025-01-01T00:00:00Z', completedAt: '2026-09-12T00:00:00Z' })], 2, index, 1);
      return page([request(20, 'CANCELLED', { createdAt: '2026-01-02T00:00:00Z', cancelledAt: '2026-09-12T00:00:00Z' })], 1, index, 50);
    });
    const hook = setup('HISTORY');
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data?.content?.map((row) => row.id)).toEqual([20, 12, 11]);
    expect(hook.result.current.data?.streams.every((stream) => stream.complete)).toBe(true);
  });

  it('не возвращает неполный список, если одна из следующих страниц не загрузилась', async () => {
    list.mockImplementation(async ({ status, page: index = 0 }) => {
      if (status === 'NEW' && index === 1) throw new Error('network');
      return page([request(index + 1, status ?? 'NEW')], 51, index);
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'NEW', page: 1, size: 50 }), expect.anything());
  });

  it('обрывает последовательность страниц при отмене запроса', async () => {
    list.mockImplementation(async ({ status, page: index = 0 }, signal) => {
      if (index === 1) {
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
        });
      }
      return page([request(index + 1, status ?? 'NEW')], 151, index);
    });
    const { result, unmount } = setup();
    await waitFor(() => {
      expect(list.mock.calls.some(([params]) => params.status === 'NEW' && params.page === 1)).toBe(true);
      expect(list.mock.calls.some(([params]) => params.status === 'IN_PROGRESS' && params.page === 1)).toBe(true);
    });
    unmount();
    await waitFor(() => expect(list.mock.calls.length).toBe(4));
    expect(result.current.data).toBeUndefined();
  });
});
