import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KtpListPage } from './KtpListPage';
import { KtpRemovalDialog } from './KtpRemovalDialog';
import { KtpVersionsDialog } from './KtpVersionsDialog';
import { listNavigationStorageKey } from '@/lib/listNavigation';

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ admin: { role: 'TEACHER' } }) }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
const context = { assignments: [
  { academicYearId: 1, academicYear: '2026/2027', subjectId: 7, subject: 'Биология', classId: 4, className: '8F' },
  { academicYearId: 1, academicYear: '2026/2027', subjectId: 7, subject: 'Биология', classId: 5, className: '8S' },
  { academicYearId: 2, academicYear: '2027/2028', subjectId: 8, subject: 'Математика', classId: 6, className: '9F' },
] };
const imported = { id: 11, revision: 2, academicYearId: 1, subjectId: 7, classIds: [4], status: 'UPLOADED', source: { originalName: 'Ненужный файл.docx' } };
const preview = { allowed: true, message: 'Будет удалено из рабочего списка', revision: 2, previewFingerprint: 'reviewed-removal', classIds: [4, 5], futureAutomaticLessons: 3, preservedLessons: 2, preservedManualLessons: 1 };
type Call = { path: string; method: string; body: unknown; key?: string };
let calls: Call[];
let respond: (url: URL, call: Call) => [number, unknown];
function LocationProbe() { return <output data-testid="location">{useLocation().search}</output>; }
function mount(node: React.ReactNode, route = '/workspace/ktp') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}>{node}<LocationProbe /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  calls = []; sessionStorage.removeItem(listNavigationStorageKey('ktp'));
  respond = (url) => {
    if (url.pathname.endsWith('/context')) return [200, context];
    if (url.pathname.endsWith('/removal-preview')) return [200, preview];
    if (url.pathname.endsWith('/imports')) return [200, { items: url.searchParams.get('status') === 'FAILED' ? [] : [imported] }];
    if (url.pathname.endsWith('/bindings')) return [200, { items: [] }];
    return [200, { items: [] }];
  };
  vi.stubGlobal('fetch', vi.fn(async (path: string, options: RequestInit = {}) => {
    const call = { path, method: options.method ?? 'GET', body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body, key: (options.headers as Record<string, string>)?.['Idempotency-Key'] };
    calls.push(call); const [status, body] = respond(new URL(path, 'http://localhost'), call);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.removeItem(listNavigationStorageKey('ktp')); });

describe('KTP removal and persistent filters', () => {
  it('restores filters from the URL and sends them to both paginated server lists', async () => {
    const route = '/workspace/ktp?academicYearId=1&subjectId=7&classId=4&status=DRAFT';
    const page = mount(<KtpListPage />, route);
    expect(await screen.findByRole('button', { name: 'Статус' })).toHaveTextContent('Черновики');
    expect(screen.getByRole('button', { name: 'Класс' })).toHaveTextContent('8F');
    await waitFor(() => expect(calls.some(call => new URL(call.path, 'http://localhost').pathname.endsWith('/bindings'))).toBe(true));
    for (const call of calls.filter(call => /\/(imports|bindings)\?/.test(call.path))) {
      const params = new URL(call.path, 'http://localhost').searchParams;
      expect(Object.fromEntries(['academicYearId', 'subjectId', 'classId', 'status'].map(key => [key, params.get(key)]))).toEqual({ academicYearId: '1', subjectId: '7', classId: '4', status: 'DRAFT' });
    }
    expect(calls.every(call => call.method === 'GET')).toBe(true);
    page.unmount(); mount(<KtpListPage />);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('status=DRAFT'));
    expect(await screen.findByRole('button', { name: 'Статус' })).toHaveTextContent('Черновики');
  });

  it('shows a filtered empty state and clears only filter parameters', async () => {
    mount(<KtpListPage />, '/workspace/ktp?status=FAILED&source=workspace');
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    expect(screen.queryByText('КТП пока не загружен')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    await screen.findByText('Ненужный файл.docx');
    expect(screen.getByTestId('location')).toHaveTextContent('?source=workspace');
    expect(screen.getByTestId('location')).not.toHaveTextContent('status=');
  });

  it('resets dependent subject and class filters when changing the school year', async () => {
    mount(<KtpListPage />, '/workspace/ktp?academicYearId=1&subjectId=7&classId=4');
    await userEvent.click(await screen.findByRole('button', { name: 'Учебный год' }));
    await userEvent.click(screen.getByRole('option', { name: '2027–2028' }));
    expect(screen.getByTestId('location')).toHaveTextContent('academicYearId=2');
    expect(screen.getByTestId('location')).not.toHaveTextContent('subjectId');
    expect(screen.getByTestId('location')).not.toHaveTextContent('classId');
  });

  it('opens removal from the list and sends no delete command before confirmation', async () => {
    mount(<KtpListPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Действия КТП: Ненужный файл.docx' }));
    await userEvent.click(screen.getByRole('button', { name: 'Удалить загрузку' }));
    const dialog = await screen.findByRole('dialog', { name: 'Удалить загрузку КТП?' });
    await within(dialog).findByText(preview.message);
    expect(calls.some(call => call.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some(call => call.method === 'DELETE')).toBe(false);
  });

  it('retries an uncertain removal with the same idempotency key and reviewed revision', async () => {
    let attempts = 0; const original = respond;
    respond = (url, call) => call.method === 'DELETE' ? (++attempts === 1 ? [503, { message: 'Временная ошибка' }] : [200, { kind: 'IMPORT', resourceId: 11 }]) : original(url, call);
    const removed = vi.fn();
    mount(<KtpRemovalDialog target={{ kind: 'import', id: 11, label: imported.source.originalName }} onClose={vi.fn()} onRemoved={removed} />);
    await screen.findByText(preview.message);
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Повторить удаление' }));
    await waitFor(() => expect(removed).toHaveBeenCalledOnce());
    const deletes = calls.filter(call => call.method === 'DELETE');
    expect(deletes).toHaveLength(2); expect(deletes[0].key).toBeTruthy(); expect(deletes[1].key).toBe(deletes[0].key);
    expect(deletes[1].body).toEqual({ expectedRevision: 2, previewFingerprint: 'reviewed-removal' });
  });

  it('keeps blocked previews and stale conflicts from deleting changed data', async () => {
    const original = respond;
    respond = (url, call) => url.pathname.endsWith('/removal-preview') ? [200, { ...preview, allowed: false, message: 'Версия используется другим классом' }] : original(url, call);
    const blocked = mount(<KtpRemovalDialog target={{ kind: 'version', bindingId: 10, versionId: 7, label: 'Версия 1' }} onClose={vi.fn()} />);
    await screen.findByText('Версия используется другим классом'); expect(screen.getByRole('button', { name: 'Удалить' })).toBeDisabled();
    expect(calls.some(call => call.method === 'DELETE')).toBe(false);
    blocked.unmount();
    respond = (url, call) => call.method === 'DELETE' ? [409, { message: 'Данные изменились' }] : original(url, call);
    mount(<KtpRemovalDialog target={{ kind: 'import', id: 11, label: 'Файл' }} onClose={vi.fn()} />);
    await screen.findByText(preview.message); await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await screen.findByRole('button', { name: 'Закрыть и обновить данные' });
    expect(screen.queryByRole('button', { name: 'Удалить' })).not.toBeInTheDocument();
  });

  it('removes a grouped plan atomically with both reviewed class revisions', async () => {
    const original = respond; let removed = false;
    respond = (url, call) => {
      if (url.pathname.endsWith('/bindings/remove')) { removed = true; return [200, { kind: 'PLAN', bindingIds: [10, 12] }]; }
      if (url.pathname.endsWith('/bindings')) return [200, { items: removed ? [] : [4, 5].map((classId, index) => ({ id: index ? 12 : 10, academicYearId: 1, subjectId: 7, classId, versionId: 7, revision: index ? 3 : 2, state: 'READY', sourceName: 'Общий КТП.docx', versionNumber: 1 })) }];
      if (url.pathname.endsWith('/progress')) return [200, { topics: [] }];
      if (url.pathname.endsWith('/imports')) return [200, { items: [] }];
      return original(url, call);
    };
    mount(<KtpListPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Действия КТП: Биология · 8F, 8S' }));
    await userEvent.click(screen.getByRole('button', { name: 'Удалить КТП' }));
    await screen.findByText(preview.message);
    expect(screen.getByText('Классы: 8F, 8S')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await screen.findByText('КТП пока не загружен');
    expect(calls.find(call => call.path.endsWith('/bindings/remove'))?.body).toEqual({ targets: [{ bindingId: 10, expectedRevision: 2 }, { bindingId: 12, expectedRevision: 3 }], previewFingerprint: 'reviewed-removal' });
  });

  it('provides version management while protecting the current version', async () => {
    const original = respond;
    respond = (url, call) => url.pathname.endsWith('/history') ? [200, { items: [
      { id: 2, versionId: 8, bindingRevision: 3, versionNumber: 2, createdAt: '2026-10-20T05:00:00Z' },
      { id: 1, versionId: 7, bindingRevision: 1, versionNumber: 1, createdAt: '2026-10-19T05:00:00Z' },
    ] }] : original(url, call);
    mount(<KtpVersionsDialog bindingId={10} currentVersionId={8} classLabel="8F" onClose={vi.fn()} onView={vi.fn()} onRemoved={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Удалить версию 2' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Удалить версию 1' }));
    await screen.findByRole('dialog', { name: 'Удалить версию КТП?' });
    expect(calls.some(call => call.path.endsWith('/bindings/10/versions/7/removal-preview'))).toBe(true);
  });
});
