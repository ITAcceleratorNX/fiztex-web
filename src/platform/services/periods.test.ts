import { beforeEach, expect, it, vi } from 'vitest';
import { updatePeriod } from './periods';

const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api')>(), request: api.request,
}));

const period = { id: 8, academicYearId: 2, name: '1 четверть', type: 'QUARTER',
  startDate: '2026-09-01', endDate: '2026-10-27', status: 'DISABLED' };
beforeEach(() => api.request.mockReset());

it('activates a disabled period through the lifecycle endpoint after updating its fields', async () => {
  api.request.mockResolvedValueOnce(period).mockResolvedValueOnce(undefined);
  const result = await updatePeriod('8', { name: '1 четверть', status: 'ACTIVE' });
  expect(api.request).toHaveBeenNthCalledWith(2, '/admin/academic-periods/8/activate', { method: 'POST' });
  expect(result.status).toBe('ACTIVE');
});

it('does not report activation success when the server rejects it', async () => {
  api.request.mockResolvedValueOnce(period).mockRejectedValueOnce(new Error('Архивный год нельзя изменять'));
  await expect(updatePeriod('8', { status: 'ACTIVE' })).rejects.toThrow('Архивный год нельзя изменять');
});

it('does not issue an activation when the updated period is already active', async () => {
  api.request.mockResolvedValueOnce({ ...period, status: 'ACTIVE' });
  const result = await updatePeriod('8', { status: 'ACTIVE' });
  expect(result.status).toBe('ACTIVE');
  expect(api.request).toHaveBeenCalledTimes(1);
});
