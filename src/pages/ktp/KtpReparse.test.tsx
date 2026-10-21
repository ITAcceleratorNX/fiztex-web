import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormDraftProvider } from '@/context/FormDraftContext';
import type { KtpDraft } from '@/lib/ktpApi';
import { KtpImportPage } from './KtpImportPage';
import { KtpDraftPage } from './KtpDraftPage';
import { KtpReparseModal } from './KtpReparseModal';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ admin: { role: 'TEACHER' } }) }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => toast }));
const draft: KtpDraft = { id: 2, importId: 1, revision: 5, status: 'DRAFT', classIds: [4], candidateDecisions: [], sourceDecisions: [], content: {
  header: { subject: 'Биология' }, candidates: [], issues: [], periods: [{ order: 1, title: 'I четверть', sections: [{ order: 1, title: 'Клетка', topics: [{ order: 1, title: 'Ручная тема', plannedHours: 2, learningObjectives: 'Ручная цель' }] }] }],
} };
const nextContent = { ...draft.content, periods: [{ order: 1, title: 'I четверть', sections: [{ order: 1, title: 'Клетка', topics: [{ order: 1, sourceNumber: '43–44', title: 'Тема из файла', plannedHours: 1, learningObjectives: 'Цель из файла', plannedDates: '21.10', notes: 'Проверить опыты' }] }] }], issues: [{ severity: 'WARNING', code: 'TOTAL_HOURS_MISMATCH', message: 'Проверьте часы нового плана', actual: '1', expected: '2' }] };
const doneJob = { id: 17, importId: 1, kind: 'REPARSE_PREVIEW', status: 'SUCCEEDED' };
let calls: { path: string; method: string; body: unknown; key?: string }[];
let respond: (path: string, options: RequestInit) => [number, unknown];
function mount(node: React.ReactNode, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><FormDraftProvider><MemoryRouter initialEntries={[path]}>{node}</MemoryRouter></FormDraftProvider></QueryClientProvider>);
  return client;
}
function modal(onRefresh = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  mount(<KtpReparseModal draft={draft} sourceName="План.docx" onRefresh={onRefresh} onClose={onClose} />);
  return { onRefresh, onClose };
}
async function start() {
  await userEvent.click(screen.getByRole('button', { name: 'Начать распознавание' }));
  return screen.findByRole('button', { name: 'Применить новое распознавание' });
}
async function accept() {
  await userEvent.click(screen.getByRole('switch', { name: 'Я сравнил(а) результаты и согласен(на) заменить ручные правки' }));
}
beforeEach(() => {
  calls = []; toast.success.mockReset(); toast.error.mockReset();
  respond = (path, options) => {
    if (path.endsWith('/parse-preview')) return [202, doneJob];
    if (path.endsWith('/jobs/17')) return [200, doneJob];
    if (path.endsWith('/parse-previews/17/apply')) return [200, { id: 2, revision: 6 }];
    if (path.endsWith('/parse-previews/17')) return [200, { draftId: 2, baseRevision: 5, job: doneJob, content: nextContent }];
    if (path.endsWith('/drafts/2')) return options.method === 'PUT' ? [200, { ...draft, revision: 6, content: JSON.parse(options.body as string).content }] : [200, draft];
    if (path.endsWith('/imports/1')) return [200, { id: 1, revision: 3, source: { originalName: 'План.docx' } }];
    if (path.endsWith('/context')) return [200, { assignments: [] }];
    return [200, { items: [] }];
  };
  vi.stubGlobal('fetch', vi.fn(async (path: string, options: RequestInit = {}) => {
    calls.push({ path, method: options.method ?? 'GET', body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body, key: (options.headers as Record<string, string>)?.['Idempotency-Key'] });
    const [status, body] = respond(path, options);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('KTP draft recovery and reparse', () => {
  it('offers manual recovery outside collapsed details and opens the empty structure', async () => {
    const original = respond;
    respond = (path, options) => path.endsWith('/imports/1/draft') ? [201, { id: 2, revision: 1 }]
      : path.endsWith('/imports/1') ? [200, { id: 1, revision: 3, status: 'FAILED', allowedActions: ['CREATE_MANUAL_DRAFT', 'START_PROCESSING'], source: { originalName: 'План.docx' } }]
        : path.endsWith('/drafts/2') ? [200, { ...draft, revision: 1, content: { periods: [], issues: [{ severity: 'ERROR', code: 'TOPICS_REQUIRED' }] } }]
          : original(path, options);
    mount(<Routes><Route path="/workspace/ktp/imports/:importId" element={<KtpImportPage />} /><Route path="/workspace/ktp/drafts/:draftId" element={<KtpDraftPage />} /></Routes>, '/workspace/ktp/imports/1');
    const manual = await screen.findByRole('button', { name: 'Создать черновик вручную' });
    expect(manual).toBeVisible();
    expect(manual.closest('details')).toBeNull();
    expect(screen.getByText(/затем в разделе «Структура плана»/)).toBeVisible();
    await userEvent.click(manual);
    expect(await screen.findByRole('button', { name: 'Добавить период' })).toBeVisible();
    expect(screen.getByText('Структура плана').closest('details')).toHaveAttribute('open');
    expect(calls.find(call => call.path.endsWith('/imports/1/draft'))).toMatchObject({ method: 'POST', body: { expectedRevision: 3 }, key: expect.any(String) });
  });
  it('shows saving inline without an overlapping success toast and clears it when editing resumes', async () => {
    mount(<Routes><Route path="/drafts/:draftId" element={<KtpDraftPage />} /></Routes>, '/drafts/2');
    await userEvent.click(await screen.findByRole('button', { name: 'Редактировать тему 1' }));
    let editor = screen.getByRole('region', { name: 'Редактирование темы 1' });
    await userEvent.type(within(editor).getByRole('textbox', { name: /Тема урока/ }), ' исправлена');
    await userEvent.click(within(editor).getByRole('button', { name: 'Сохранить изменения' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
    expect(await screen.findByText('Черновик сохранён. Проверьте ошибки и предупреждения перед подтверждением КТП.')).toBeVisible();
    expect(toast.success).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Редактировать тему 1' }));
    editor = screen.getByRole('region', { name: 'Редактирование темы 1' });
    expect(editor).toBeVisible();
    expect(screen.queryByText('Черновик сохранён. Проверьте ошибки и предупреждения перед подтверждением КТП.')).not.toBeInTheDocument();
  });
  it('cancels before starting without any write and explains that manual corrections will be replaced only on apply', async () => {
    const { onClose } = modal();
    expect(screen.getByText(/До применения сохранённый черновик не изменится/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Оставить черновик без замены' }));
    expect(onClose).toHaveBeenCalledWith(false);
    expect(calls).toHaveLength(0);
  });
  it('polls an existing processing job before fetching a comparison and cancels it without applying', async () => {
    let jobReads = 0; const original = respond;
    respond = (path, options) => path.endsWith('/jobs/17') ? [200, ++jobReads === 1 ? { ...doneJob, status: 'RUNNING' } : doneJob] : original(path, options);
    const { onClose } = modal();
    await userEvent.click(screen.getByRole('button', { name: 'Начать распознавание' }));
    expect(await screen.findByText('Распознаём исходный файл. Сохранённый черновик остаётся без изменений.')).toBeVisible();
    expect(calls.some(call => call.path.endsWith('/parse-previews/17'))).toBe(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Применить новое распознавание' })).toBeDisabled(), { timeout: 4500 });
    expect(jobReads).toBeGreaterThan(1);
    await userEvent.click(screen.getByRole('button', { name: 'Оставить черновик без замены' }));
    expect(onClose).toHaveBeenCalledWith(false);
    expect(calls.filter(call => call.method === 'POST').map(call => call.path)).toEqual(['/api/teacher/ktp/drafts/2/parse-preview']);
  }, 7000);
  it('shows both complete contents and warnings, then applies the compared revision with explicit consent', async () => {
    const { onRefresh } = modal();
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Номер таблицы Word' }), '2');
    const button = await start();
    expect(button).toBeDisabled();
    const oldPlan = screen.getByRole('region', { name: 'Сохранённый черновик' });
    const newPlan = screen.getByRole('region', { name: 'Новое распознавание' });
    expect(within(oldPlan).getByText('1. Ручная тема')).toBeVisible();
    expect(within(newPlan).getByText('43–44. Тема из файла')).toBeVisible();
    expect(within(newPlan).getByText(/Цель из файла/)).toBeVisible();
    expect(within(newPlan).getByText(/Проверить опыты/)).toBeVisible();
    expect(screen.getByRole('region', { name: 'Замечания нового распознавания' })).toHaveTextContent('Часы');
    await accept(); await userEvent.click(button);
    await waitFor(() => expect(onRefresh).toHaveBeenCalledWith(true));
    expect(calls.find(call => call.path.endsWith('/parse-preview'))).toMatchObject({ body: { expectedRevision: 5, options: { tableNumber: 2 } }, key: expect.any(String) });
    expect(calls.find(call => call.path.endsWith('/apply'))).toMatchObject({ body: { expectedRevision: 5 }, key: expect.any(String) });
    expect(screen.queryByRole('button', { name: 'Применить новое распознавание' })).not.toBeInTheDocument();
  });
  it('keeps the old draft editable after a failed parse and supports changing parse parameters', async () => {
    const original = respond;
    respond = (path, options) => path.endsWith('/jobs/17') ? [200, { ...doneJob, status: 'FAILED' }]
      : path.endsWith('/parse-previews/17') ? [200, { draftId: 2, baseRevision: 5, job: { ...doneJob, status: 'FAILED' }, content: { periods: [], issues: [{ severity: 'ERROR', code: 'TOPICS_REQUIRED' }] } }]
        : original(path, options);
    modal();
    await userEvent.click(screen.getByRole('button', { name: 'Начать распознавание' }));
    expect(await screen.findByText(/Не удалось повторно распознать файл/)).toBeVisible();
    expect(await screen.findByRole('region', { name: 'Сохранённый черновик' })).toHaveTextContent('Ручная тема');
    expect(screen.queryByRole('button', { name: 'Применить новое распознавание' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Изменить параметры распознавания' }));
    expect(screen.getByRole('spinbutton', { name: 'Номер таблицы Word' })).toBeVisible();
    expect(calls.some(call => call.path.endsWith('/apply'))).toBe(false);
  });
  it('blocks stale previews locally and requires a fresh draft before starting another comparison', async () => {
    const original = respond;
    respond = (path, options) => path.endsWith('/parse-previews/17') ? [200, { draftId: 2, baseRevision: 4, job: doneJob, content: nextContent }] : original(path, options);
    const { onRefresh } = modal();
    await userEvent.click(screen.getByRole('button', { name: 'Начать распознавание' }));
    expect(await screen.findByText(/Черновик изменился после начала распознавания/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Применить новое распознавание' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Обновить черновик' }));
    expect(onRefresh).toHaveBeenCalledWith(false);
    expect(calls.some(call => call.path.endsWith('/apply'))).toBe(false);
  });
  it('stops applying on a server revision conflict instead of silently rebasing the proposal', async () => {
    const original = respond;
    respond = (path, options) => path.endsWith('/apply') ? [409, { code: 'DRAFT_REVISION_CONFLICT', message: 'Черновик изменён другим сотрудником' }] : original(path, options);
    const { onRefresh } = modal(); const button = await start(); await accept(); await userEvent.click(button);
    expect(await screen.findByText(/Черновик изменился после начала распознавания/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Повторить применение' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Обновить черновик' }));
    expect(onRefresh).toHaveBeenCalledWith(false);
    expect(calls.filter(call => call.path.endsWith('/apply'))).toHaveLength(1);
  });
  it('retries an uncertain apply using the same command key and never applies again after a confirmed receipt', async () => {
    let attempts = 0; const original = respond;
    respond = (path, options) => path.endsWith('/apply') && ++attempts === 1 ? [503, { message: 'Соединение потеряно' }] : original(path, options);
    const { onRefresh } = modal(); const button = await start(); await accept(); await userEvent.click(button);
    expect(await screen.findByText('Соединение потеряно')).toBeVisible();
    expect(onRefresh).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить применение' }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledWith(true));
    const applies = calls.filter(call => call.path.endsWith('/apply'));
    expect(applies).toHaveLength(2); expect(applies[0].key).toBe(applies[1].key);
    expect(applies[0].body).toEqual(applies[1].body);
  });
  it('offers a read retry after apply when loading the refreshed draft fails and exits safely to the list', async () => {
    const onRefresh = vi.fn().mockRejectedValue(new Error('Network')); const onClose = vi.fn();
    modal(onRefresh, onClose); const button = await start(); await accept(); await userEvent.click(button);
    expect(await screen.findByText(/Результат уже сохранён/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Применить новое распознавание' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Обновить черновик' }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByRole('button', { name: 'К списку КТП' }));
    expect(onClose).toHaveBeenCalledWith(true);
    expect(calls.filter(call => call.path.endsWith('/apply'))).toHaveLength(1);
  });
  it('refreshes the actual editor after apply and clears the old manual content', async () => {
    let applied = false; const original = respond;
    respond = (path, options) => path.endsWith('/apply') ? (applied = true, [200, { id: 2, revision: 6 }])
      : path.endsWith('/drafts/2') && applied ? [200, { ...draft, revision: 6, content: { ...nextContent, issues: [] }, rawContent: nextContent }]
        : original(path, options);
    mount(<Routes><Route path="/drafts/:draftId" element={<KtpDraftPage />} /></Routes>, '/drafts/2');
    await userEvent.click(await screen.findByRole('button', { name: 'Действия черновика КТП' }));
    await userEvent.click(screen.getByRole('button', { name: 'Повторно распознать файл' }));
    const button = await start(); await accept(); await userEvent.click(button);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Тема из файла')).toBeVisible();
    expect(screen.queryByText('Ручная тема')).not.toBeInTheDocument();
    expect(screen.getByText('Новое распознавание применено. Проверьте темы, часы и замечания перед подтверждением КТП.')).toBeVisible();
    expect(toast.success).not.toHaveBeenCalled();
  });
  it('keeps the receipt visible when the editor refresh fails instead of returning to stale editing', async () => {
    let applied = false; const original = respond;
    respond = (path, options) => path.endsWith('/apply') ? (applied = true, [200, { id: 2, revision: 6 }])
      : path.endsWith('/drafts/2') && applied ? [503, { message: 'Чтение пока недоступно' }] : original(path, options);
    mount(<Routes><Route path="/drafts/:draftId" element={<KtpDraftPage />} /><Route path="/workspace/ktp" element={<p>Список КТП</p>} /></Routes>, '/drafts/2');
    await userEvent.click(await screen.findByRole('button', { name: 'Действия черновика КТП' }));
    await userEvent.click(screen.getByRole('button', { name: 'Повторно распознать файл' }));
    const button = await start(); await accept(); await userEvent.click(button);
    expect(await screen.findByText(/Результат уже сохранён/)).toBeVisible();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Применить новое распознавание' })).not.toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'К списку КТП' }));
    expect(await screen.findByText('Список КТП')).toBeVisible();
    expect(calls.filter(call => call.path.endsWith('/apply'))).toHaveLength(1);
  });
});
