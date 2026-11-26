import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportGrantsModal } from './ReportGrantsModal';

const request = vi.fn();
vi.mock('@/lib/api', () => ({ request: (...args: unknown[]) => request(...args), pageQuery: () => '?page=0&size=100' }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ReportGrantsModal yearId={1} yearName="2026–2027"
    classes={[{ id: 2, name: '7А' }]} onClose={vi.fn()} /></QueryClientProvider>);
}

describe('ReportGrantsModal', () => {
  beforeEach(() => {
    request.mockReset().mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path.startsWith('/admin/teachers')) return { last: true, content: [
        { id: 3, firstName: 'Анна', lastName: 'Петрова', status: 'ACTIVE', accountStatus: 'ACTIVE' },
      ] };
      if (options?.method) return undefined;
      return [{ id: 4, teacherProfileId: 3, academicYearId: 1, classId: 2, reportKind: 'ASSESSMENT' }];
    });
  });

  it('grants only the selected report, year and class', async () => {
    show();
    await screen.findByRole('button', { name: 'Выдать доступ' });
    await userEvent.click(screen.getByLabelText('Получатель'));
    await userEvent.click(screen.getByRole('option', { name: 'Петрова Анна' }));
    await userEvent.click(screen.getByLabelText('Разрешённый класс'));
    await userEvent.click(screen.getByRole('option', { name: '7А' }));
    await userEvent.click(screen.getByLabelText('Разрешённый отчёт'));
    await userEvent.click(screen.getByRole('option', { name: 'Успеваемость класса' }));
    await userEvent.click(screen.getByRole('button', { name: 'Выдать доступ' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/academic-reports/grants', {
      method: 'POST', body: { teacherProfileId: 3, academicYearId: 1, classId: 2, reportKind: 'CLASS_PERFORMANCE' },
    }));
  });

  it('revokes the selected grant and refreshes the list', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Отозвать доступ/ }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/academic-reports/grants/4', { method: 'DELETE' }));
    await waitFor(() => expect(request.mock.calls.filter(([path]) => path === '/admin/academic-reports/grants').length).toBeGreaterThan(1));
  });
});
