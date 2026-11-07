import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormDraftProvider } from '@/context/FormDraftContext';
import { listNavigationStorageKey } from '@/lib/listNavigation';
import { KtpCopyDialog } from './KtpCopyDialog';
import { KtpDraftPage } from './KtpDraftPage';
import { KtpActivationModal } from './KtpActivationModal';
import { KtpListPage } from './KtpListPage';

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ admin: { role: 'TEACHER' } }) }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

const targets = {
  source: { bindingId: 3, versionId: 30, versionNumber: 2, academicYearId: 1, academicYear: '2026/2027', archived: false, classId: 4, className: '8A', subjectId: 7, subject: 'Биология', periodCount: 2, topicCount: 4, plannedHours: 4 },
  years: [
    { academicYearId: 1, academicYear: '2026/2027', status: 'ACTIVE', periodsReady: true, classes: [{ classId: 4, className: '8A', availability: 'ACTIVE_PLAN_EXISTS', activeBindingId: 3, hasUpcomingLessons: true }] },
    { academicYearId: 2, academicYear: '2027/2028', status: 'DRAFT', periodsReady: false, classes: [
      { classId: 10, className: '8A', availability: 'AVAILABLE', hasUpcomingLessons: false },
      { classId: 11, className: '8B', availability: 'ACTIVE_PLAN_EXISTS', activeBindingId: 99, hasUpcomingLessons: true },
      { classId: 12, className: '8C', availability: 'AVAILABLE', hasUpcomingLessons: true, existingDraftId: 77 },
    ] },
  ],
};
const context = {
  assignments: [
    { academicYearId: 1, academicYear: '2026/2027', subjectId: 7, subject: 'Биология', classId: 4, className: '8A' },
    { academicYearId: 2, academicYear: '2027/2028', subjectId: 7, subject: 'Биология', classId: 10, className: '8A' },
  ],
  archive: [{ academicYearId: 9, academicYear: '2025/2026', subjectId: 7, subject: 'Биология', classId: 90, className: '7A' }],
  periods: [], maxFileBytes: 10000000, formats: ['docx', 'xlsx'], allocationEnabled: true,
};
const copyDraft = { id: 55, importId: 21, revision: 1, status: 'DRAFT', classIds: [10], candidateDecisions: [], sourceDecisions: [], rawContent: { periods: [], issues: [], candidates: [] },
  content: { header: { subject: 'Биология', academicYear: '2027–2028', classNames: ['8A'] }, candidates: [], issues: [], periods: [{ order: 1, title: 'I четверть', sections: [{ order: 1, title: 'Клетка', topics: [
    { order: 1, sourceNumber: '1', title: 'Строение клетки', plannedHours: 1, notes: 'Лабораторная работа №1', previousPlannedDates: '01.09.2026–04.09.2026' },
  ] }] }] } };
const copyImport = { id: 21, revision: 2, status: 'PROCESSED', academicYearId: 2, subjectId: 7, classIds: [10], draftId: 55, allowedActions: ['OPEN_DRAFT'], versionStatus: 'DRAFT', source: null,
  origin: { type: 'COPY', copiedFrom: { academicYear: '2026/2027', className: '8A' } } };

type Call = { path: string; method: string; body: unknown; key?: string };
let calls: Call[];
let respond: (url: URL, call: Call) => [number, unknown];
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function mount(node: React.ReactNode, route = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><FormDraftProvider><MemoryRouter initialEntries={[route]}>{node}<Location /></MemoryRouter></FormDraftProvider></QueryClientProvider>);
}
const copies = () => calls.filter(call => call.method === 'POST' && call.path.endsWith('/copies'));
beforeEach(() => {
  calls = []; sessionStorage.removeItem(listNavigationStorageKey('ktp'));
  respond = url => {
    if (url.pathname.endsWith('/copy-targets')) return [200, targets];
    if (url.pathname.endsWith('/copies')) return [201, { id: 55, revision: 1 }];
    if (url.pathname.endsWith('/context')) return [200, context];
    if (url.pathname.endsWith('/drafts/55')) return [200, copyDraft];
    if (url.pathname.endsWith('/imports/21')) return [200, copyImport];
    return [200, { items: [] }];
  };
  vi.stubGlobal('fetch', vi.fn(async (path: string, options: RequestInit = {}) => {
    const call = { path, method: options.method ?? 'GET', body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body, key: (options.headers as Record<string, string>)?.['Idempotency-Key'] };
    calls.push(call); const [status, body] = respond(new URL(path, 'http://localhost'), call);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.removeItem(listNavigationStorageKey('ktp')); });

describe('KtpCopyDialog', () => {
  it('suggests the next year, disables occupied classes and explains periods, lessons and existing drafts', async () => {
    mount(<KtpCopyDialog bindingId={3} versionId={30} onClose={vi.fn()} />);
    expect(await screen.findByText('Биология · 8A · 2026/2027 · версия 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Учебный год/ })).toHaveTextContent('2027/2028 · ещё не начался');
    expect(screen.getByText(/ещё не настроены учебные периоды/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Класс/ }));
    expect(screen.getByRole('option', { name: '8B — уже есть активный КТП' })).toBeDisabled();
    await userEvent.click(screen.getByRole('option', { name: '8A' }));
    expect(screen.getByText(/У 8A ещё нет уроков по предмету/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: '8C' }));
    expect(screen.getByText(/уже есть черновик КТП для 8C/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Открыть черновик' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/workspace/ktp/drafts/77');
    expect(copies()).toHaveLength(0);
  });

  it('creates the draft with an idempotency key and opens it in the existing editor', async () => {
    const close = vi.fn();
    mount(<KtpCopyDialog bindingId={3} versionId={30} onClose={close} />);
    await userEvent.click(await screen.findByRole('button', { name: /Класс/ }));
    await userEvent.click(screen.getByRole('option', { name: '8A' }));
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/workspace/ktp/drafts/55'));
    expect(copies()).toHaveLength(1);
    expect(copies()[0].path).toContain('/teacher/ktp/bindings/3/versions/30/copies');
    expect(copies()[0].body).toEqual({ academicYearId: 2, classIds: [10] });
    expect(copies()[0].key).toBeTruthy();
    expect(close).toHaveBeenCalled();
  });

  it('keeps the dialog open with the server reason when the class became occupied', async () => {
    respond = url => url.pathname.endsWith('/copies')
      ? [409, { code: 'KTP_COPY_TARGET_OCCUPIED', message: 'В классе 8A уже есть активный КТП по этому предмету. Копия не заменяет действующий план' }]
      : url.pathname.endsWith('/copy-targets') ? [200, targets] : [200, { items: [] }];
    const close = vi.fn();
    mount(<KtpCopyDialog bindingId={3} versionId={30} onClose={close} />);
    await userEvent.click(await screen.findByRole('button', { name: /Класс/ }));
    await userEvent.click(screen.getByRole('option', { name: '8A' }));
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    expect(await screen.findByText(/Копия не заменяет действующий план/)).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByText('Копировать КТП')).toBeInTheDocument();
  });

  it('preselects the only free class and explains when there is nowhere to copy', async () => {
    respond = () => [200, { ...targets, years: [{ ...targets.years[1], periodsReady: true, classes: [targets.years[1].classes[0]] }] }];
    const first = mount(<KtpCopyDialog bindingId={3} versionId={30} onClose={vi.fn()} />);
    await screen.findByText('Биология · 8A · 2026/2027 · версия 2');
    expect(screen.getByRole('button', { name: 'Создать черновик' })).toBeEnabled();
    first.unmount();
    respond = () => [200, { ...targets, years: [] }];
    mount(<KtpCopyDialog bindingId={3} versionId={30} onClose={vi.fn()} />);
    expect(await screen.findByText('Некуда скопировать')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать черновик' })).not.toBeInTheDocument();
  });
});

describe('copied draft in existing KTP screens', () => {
  it('opens a copied draft without file actions and with last year dates as a hint only', async () => {
    mount(<Routes><Route path="/drafts/:draftId" element={<KtpDraftPage />} /></Routes>, '/drafts/55');
    expect(await screen.findByText('Копия КТП 8A · 2026–2027')).toBeInTheDocument();
    expect(screen.getByText('Скопировано')).toBeInTheDocument();
    expect(screen.queryByText('Распознано')).not.toBeInTheDocument();
    expect(screen.getByText(/было: 01\.09\.2026–04\.09\.2026/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Исходный файл|Скачать исходный файл/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Действия черновика КТП' }));
    expect(screen.getByRole('button', { name: /Удалить черновик/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Повторно распознать/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Редактировать тему 1' }));
    expect(screen.getByText('В 2026–2027: 01.09.2026–04.09.2026')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Плановые сроки' })).toHaveValue('');
    expect(calls.some(call => call.path.includes('/source'))).toBe(false);
  });

  it('blocks confirming a copy onto a class that already has an active plan instead of offering a replacement', async () => {
    respond = url => url.pathname.endsWith('/activation-preview')
      ? [200, { draftId: 55, revision: 1, totals: { topicCount: 1, knownAnnualHours: 1 }, warningCodes: [], issues: [], availablePeriods: [{ id: 5, name: 'I четверть' }], suggestedPeriodMapping: [{ planPeriodOrder: 1, academicPeriodId: 5 }],
        targets: [{ expected: { classId: 10, bindingRevision: 0 }, currentRevision: 1, currentVersionId: 99, conflict: true, currentState: 'READY', blockedReason: 'ACTIVE_PLAN_EXISTS' }] }]
      : url.pathname.endsWith('/context') ? [200, context] : [200, { items: [] }];
    mount(<KtpActivationModal draft={copyDraft} onClose={vi.fn()} refreshTargets={vi.fn()} />);
    expect(await screen.findByText(/В 8A уже есть активный КТП по этому предмету/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подтвердить КТП' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Обновить привязки' })).not.toBeInTheDocument();
    expect(screen.queryByText('Подтвердить новую версию КТП?')).not.toBeInTheDocument();
  });

  it('warns that a year without academic periods cannot be confirmed yet', async () => {
    respond = url => url.pathname.endsWith('/activation-preview')
      ? [200, { draftId: 55, revision: 1, totals: { topicCount: 1 }, warningCodes: [], issues: [], availablePeriods: [], suggestedPeriodMapping: [], targets: [{ expected: { classId: 10, bindingRevision: 0 }, currentRevision: 0, conflict: false }] }]
      : url.pathname.endsWith('/context') ? [200, context] : [200, { items: [] }];
    mount(<KtpActivationModal draft={copyDraft} onClose={vi.fn()} refreshTargets={vi.fn()} />);
    expect(await screen.findByText(/ещё нет учебных периодов/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подтвердить КТП' })).toBeDisabled();
  });
});

describe('copies and archived years in the KTP list', () => {
  it('labels copies without a file name and opens a copied draft directly', async () => {
    respond = url => url.pathname.endsWith('/context') ? [200, context]
      : url.pathname.endsWith('/imports') ? [200, { items: [copyImport] }]
      : url.pathname.endsWith('/bindings') ? [200, { items: [{ id: 3, academicYearId: 1, classId: 4, subjectId: 7, revision: 1, versionId: 30, state: 'READY', sourceName: null, versionNumber: 1, origin: { type: 'COPY', copiedFrom: { academicYear: '2025/2026', className: '7A' } } }] }]
      : [200, { topics: [] }];
    mount(<KtpListPage />, '/workspace/ktp');
    expect(await screen.findByText('Копия КТП 8A · 2026–2027')).toBeInTheDocument();
    expect(screen.getByText(/Копия КТП 7A · 2025–2026 · версия 1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Действия КТП: Копия КТП 8A · 2026–2027' }));
    expect(screen.getByRole('button', { name: /Удалить черновик/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Продолжить проверку/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/workspace/ktp/drafts/55');
  });

  it('lists an archived year only for copying, without progress or the plan card', async () => {
    respond = url => url.pathname.endsWith('/context') ? [200, context]
      : url.pathname.endsWith('/bindings') ? [200, { items: url.searchParams.get('archived') === 'true'
        ? [{ id: 90, academicYearId: 9, classId: 90, subjectId: 7, revision: 1, versionId: 900, state: 'READY', sourceName: 'План 7А.docx', versionNumber: 1, archived: true, origin: { type: 'UPLOAD' } }] : [] }]
      : url.pathname.endsWith('/copy-targets') ? [200, targets] : [200, { items: [] }];
    mount(<KtpListPage />, '/workspace/ktp?academicYearId=9');
    expect(await screen.findByText('Архив')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Учебный год' })).toHaveTextContent('2025–2026 · архив');
    expect(screen.queryByRole('button', { name: 'Статус' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Биология' })).not.toBeInTheDocument();
    const archivedCall = calls.find(call => call.path.includes('/bindings?'));
    expect(new URL(archivedCall!.path, 'http://localhost').searchParams.get('archived')).toBe('true');
    expect(calls.some(call => /\/imports\?|\/progress/.test(call.path))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: /Действия КТП: Биология · 7A/ }));
    expect(screen.queryByRole('button', { name: /Открыть КТП/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Удалить КТП/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Копировать КТП/ }));
    expect(await screen.findByText('Копировать КТП', { selector: 'h2' })).toBeInTheDocument();
    await waitFor(() => expect(calls.some(call => call.path.endsWith('/bindings/90/versions/900/copy-targets'))).toBe(true));
  });
});
