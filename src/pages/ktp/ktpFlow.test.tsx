import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormDraftProvider } from '@/context/FormDraftContext';
import { useKtpCommand } from '@/hooks/queries';
import { ktpApi } from '@/lib/ktpApi';
import { KtpListPage } from './KtpListPage';
import { KtpDraftPage } from './KtpDraftPage';
import { KtpImportPage } from './KtpImportPage';
import { LessonKtpTopicField } from './LessonKtpTopicField';
import { KtpInitialSyncModal, KtpVersionSyncModal } from './KtpProgressModals';
import { KtpActivationModal } from './KtpActivationModal';

const session = vi.hoisted(() => ({ role: 'TEACHER' }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ admin: { role: session.role } }) }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
const context = { assignments: [{ academicYearId: 1, academicYear: '2026–2027', classId: 4, className: '8F', subjectId: 7, subject: 'Биология' }], maxFileBytes: 10000000, formats: ['DOCX', 'XLSX'] };
const teaching = { lessonId: 12, bindingId: 3, versionId: 2, mode: 'DEFAULT', actualText: 'Строение клетки', bindingState: 'READY', bindingRevision: 5, progressRevision: 8, assignmentRevision: 9, planned: [{ topicId: 11, title: 'Строение клетки', partNumber: 1, learningObjectives: 'Исследовать клетку', units: 1 }], actual: [] };
const progress = { topics: [{ topicId: 11, order: 1, title: 'Строение клетки', plannedHours: 2, coveredHours: 1, remainingHours: 1 }, { topicId: 22, order: 2, title: 'Экосистемы', plannedHours: 1, coveredHours: 0, remainingHours: 1 }] };
const draft = { id: 2, importId: 1, revision: 5, status: 'DRAFT', classIds: [4], candidateDecisions: [], sourceDecisions: [], content: { header: { subject: 'Биология' }, candidates: [], issues: [], periods: [{ order: 1, title: 'I четверть', sections: [{ order: 1, title: 'Клетка', topics: [{ order: 1, title: 'Строение клетки', plannedHours: 1 }] }] }] } };
let calls: { path: string; method: string; body: unknown; key?: string }[];
let respond: (path: string, options: RequestInit) => [number, unknown];
function mount(node: React.ReactNode, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><FormDraftProvider><MemoryRouter initialEntries={[path]}>{node}</MemoryRouter></FormDraftProvider></QueryClientProvider>);
}
beforeEach(() => {
  session.role = 'TEACHER'; calls = [];
  respond = path => {
    if (path.endsWith('/context')) return [200, context];
    if (path.includes('/bindings/3/progress')) return [200, progress];
    if (path.endsWith('/teaching-topic')) return [200, teaching];
    if (path.includes('/drafts/2')) return [200, draft];
    if (path.includes('/imports/1')) return [200, { id: 1, revision: 1, status: 'UPLOADED', allowedActions: ['START_PROCESSING'] }];
    return [200, { items: [] }];
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit = {}) => {
    calls.push({ path: url, method: options.method ?? 'GET', body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body, key: (options.headers as Record<string, string>)?.['Idempotency-Key'] });
    const [status, body] = respond(url, options);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('KTP API flow', () => {
  it('shows the empty design from live query results and makes no uploads', async () => {
    mount(<KtpListPage />);
    expect(await screen.findByText('КТП пока не загружен')).toBeInTheDocument();
    expect(calls.filter(c => c.method === 'GET')).toHaveLength(3);
    expect(calls.some(c => c.method !== 'GET')).toBe(false);
  });
  it('keeps a server failure distinct from an empty plan list', async () => {
    respond = () => [503, { message: 'Сервер временно недоступен' }];
    mount(<KtpListPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Сервер временно недоступен');
    expect(screen.queryByText('КТП пока не загружен')).not.toBeInTheDocument();
  });
  it('does not call teacher KTP APIs under an administrator', async () => {
    session.role = 'ADMIN'; mount(<KtpListPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('У вас нет доступа');
    expect(calls).toHaveLength(0);
  });
  it('requires a separate processing action after restoring a saved upload', async () => {
    mount(<Routes><Route path="/imports/:importId" element={<KtpImportPage />} /></Routes>, '/imports/1');
    await screen.findByRole('button', { name: 'Обработать файл' });
    expect(calls.every(c => c.method === 'GET')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Обработать файл' }));
    await waitFor(() => expect(calls.some(c => c.path.endsWith('/processing') && c.method === 'POST')).toBe(true));
  });
  it('shows the full topic to the administrator without teacher mutation controls', async () => {
    session.role = 'ADMIN'; mount(<LessonKtpTopicField id={12} canView editable={false} cancelled={false} fallback={<p>Обычная тема</p>} />);
    expect(await screen.findByText('Строение клетки')).toBeInTheDocument();
    expect(screen.getByText('Цели обучения: Исследовать клетку')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Изменить тему' })).not.toBeInTheDocument();
    expect(calls.map(c => c.path)).toEqual(['/api/admin/lessons/12/teaching-topic']);
  });
  it('leaves a cancelled lesson uncovered and does not offer editing', async () => {
    mount(<LessonKtpTopicField id={12} canView editable cancelled fallback={<p>Обычная тема</p>} />);
    expect(await screen.findByText(/Урок отменён — час не засчитан/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Изменить тему' })).not.toBeInTheDocument();
  });
  it('allows free text for retained manual lessons after removal without reusing an archived plan', async () => {
    const original = respond;
    respond = (path, opts) => path.endsWith('/teaching-topic') ? [200, { ...teaching, bindingState: 'ARCHIVED' }] : original(path, opts);
    mount(<LessonKtpTopicField id={12} canView editable cancelled={false} fallback={<p>Обычная тема</p>} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Изменить тему' }));
    expect(screen.getByRole('button', { name: 'Указать свободную тему' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Без темы КТП' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Заменить тему' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отметить тему пройденной' })).not.toBeInTheDocument();
  });
  it('confirms the exact preview with revisions and preserves planned links', async () => {
    const original = respond;
    respond = (path, opts) => path.endsWith('/preview') ? [200, { previewFingerprint: 'server-fingerprint', proposedText: 'Экосистемы', baselineChanges: [] }]
      : path.endsWith('/teaching-topic') && opts.method === 'POST' ? [200, { lessonId: 12 }]
      : original(path, opts);
    mount(<LessonKtpTopicField id={12} canView editable cancelled={false} fallback={<p>Обычная тема</p>} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Изменить тему' }));
    await userEvent.click(screen.getByRole('button', { name: 'Заменить тему' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(await within(dialog).findByRole('radio', { name: /Экосистемы/ }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Причина изменения/ }), 'Изменение порядка тем');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Проверить изменение' }));
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Подтвердить изменение' }));
    await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.path.endsWith('/teaching-topic'))).toBe(true));
    const command = calls.find(c => c.method === 'POST' && c.path.endsWith('/teaching-topic'))!;
    expect(command.body).toEqual({ previewFingerprint: 'server-fingerprint', acceptBaselineAdjustment: false, request: { operation: 'REPLACE', topics: [{ topicId: 22, units: 1 }], expectedBindingRevision: 5, expectedProgressRevision: 8, expectedAssignmentRevision: 9, reason: 'Изменение порядка тем' } });
    expect(command.key).toBeTruthy();
    expect(teaching.planned[0].topicId).toBe(11);
  });
  it('keeps confirmation disabled until edited content is saved and validated', async () => {
    mount(<Routes><Route path="/drafts/:draftId" element={<KtpDraftPage />} /></Routes>, '/drafts/2');
    await userEvent.click(await screen.findByRole('button', { name: 'Редактировать тему 1' }));
    const editor = screen.getByRole('region', { name: 'Редактирование темы 1' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.type(within(editor).getByRole('textbox', { name: /Тема урока/ }), ' новая');
    await userEvent.click(within(editor).getByRole('button', { name: 'Сохранить изменения' }));
    expect(screen.getByRole('button', { name: 'Подтвердить КТП' })).toBeDisabled();
    expect(calls.every(c => c.method === 'GET')).toBe(true);
  });
  it('separates missing optional fields and opens the correct topic without source coordinates', async () => {
    const original = respond;
    respond = (path, opts) => path.includes('/drafts/2') ? [200, { ...draft, content: { ...draft.content, issues: [
      { severity: 'WARNING', code: 'OPTIONAL_FIELD_MISSING', fieldPath: 'topics[1].notes', actual: '', expected: null },
      { severity: 'WARNING', code: 'OPTIONAL_FIELD_MISSING', fieldPath: 'topics[9].notes', actual: '', expected: null },
    ], periods: [{ order: 1, title: 'I четверть', sections: [{ order: 1, title: 'Клетка', topics: [draft.content.periods[0].sections[0].topics[0], { order: 9, sourceNumber: '12', title: 'Экосистемы', plannedHours: 1 }] }] }] } }] : original(path, opts);
    mount(<Routes><Route path="/drafts/:draftId" element={<KtpDraftPage />} /></Routes>, '/drafts/2');
    await userEvent.click(await screen.findByText('Необязательные поля · 2'));
    await userEvent.click(screen.getByText('Примечания · не заполнено: 2'));
    expect(screen.getByText('Эти поля можно оставить пустыми — они не мешают подтвердить КТП.')).toBeInTheDocument();
    expect(screen.queryByText(/topics\[/)).not.toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Предупреждения ·/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /^Требуют внимания/ }));
    expect(screen.getByText(/Нет тем с ошибками или предупреждениями/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Дополнить поле «Примечания»: Тема № 12 «Экосистемы»' }));
    expect(within(screen.getByRole('region', { name: 'Редактирование темы 12' })).getByRole('textbox', { name: /Тема урока/ })).toHaveValue('Экосистемы');
    expect(within(screen.getByRole('region', { name: 'Редактирование темы 12' })).getByRole('textbox', { name: 'Примечания' })).toBeVisible();
    expect(calls.every(c => c.method === 'GET')).toBe(true);
  });
  it('does not require accepting blank optional fields when confirming a plan', async () => {
    const original = respond;
    respond = (path, opts) => path.endsWith('/activation-preview') ? [200, { revision: 5, warningCodes: [], targets: [],
      suggestedPeriodMapping: [{ planPeriodOrder: 1, academicPeriodId: 10 }], availablePeriods: [{ id: 10, name: 'I четверть' }],
      issues: [{ severity: 'WARNING', code: 'OPTIONAL_FIELD_MISSING', fieldPath: 'topics[1].notes', actual: '', expected: null }],
    }] : original(path, opts);
    mount(<KtpActivationModal draft={draft} onClose={vi.fn()} refreshTargets={vi.fn()} />);
    await screen.findByText('Необязательные поля · 1');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подтвердить КТП' })).toBeEnabled();
    expect(screen.queryByText(/topics\[/)).not.toBeInTheDocument();
  });
  it('confirms reviewed initial progress without double-counting hours linked to lessons', async () => {
    const original = respond;
    respond = (path, opts) => path.endsWith('/initial-sync-preview') ? [200, {
      cutoff: '2026-10-19T10:00:00Z', historyFingerprint: 'initial-history', bindingRevision: 5, progressRevision: 8,
      physicalLessonCount: 1, suggestedBaselines: [{ topicId: 22, additionalHours: 0 }],
      topics: [{ topicId: 22, order: 9, title: 'Экосистемы', plannedHours: 2, linkedCoverage: 1 }],
    }] : original(path, opts);
    mount(<KtpInitialSyncModal id={3} presentation="page" content={{ periods: [{ order: 1, title: 'I четверть', sections: [{ order: 1, title: 'Экология', topics: [{ order: 9, title: 'Экосистемы' }] }] }] }} onClose={vi.fn()} />);
    const confirm = await screen.findByRole('button', { name: 'Подтвердить прогресс КТП' });
    expect(confirm).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Прогресс: Экосистемы' }));
    await userEvent.click(screen.getByRole('option', { name: 'Пройдена' }));
    expect(calls.every(call => call.method === 'GET')).toBe(true);
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Я проверил(а) прогресс этого класса' }));
    await userEvent.click(confirm);
    await waitFor(() => expect(calls.some(call => call.path.endsWith('/initial-sync') && call.method === 'POST')).toBe(true));
    expect(calls.find(call => call.path.endsWith('/initial-sync') && call.method === 'POST')?.body).toEqual({ cutoff: '2026-10-19T10:00:00Z', historyFingerprint: 'initial-history', expectedBindingRevision: 5, expectedProgressRevision: 8, baselines: [{ topicId: 22, additionalHours: 1 }] });
  });
  it('reuses the idempotency key after a lost response, and rotates it for changed input', async () => {
    const action = vi.fn().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValue('ok');
    function Retry() { const mutation = useKtpCommand(action); return <><ButtonForTest run={() => mutation.mutateAsync({ value: 1 })} label="retry" /><ButtonForTest run={() => mutation.mutateAsync({ value: 2 })} label="changed" /></>; }
    mount(<Retry />);
    await userEvent.click(screen.getByRole('button', { name: 'retry' }));
    await userEvent.click(screen.getByRole('button', { name: 'retry' }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[0][1]).toBe(action.mock.calls[1][1]);
    await act(async () => { await userEvent.click(screen.getByRole('button', { name: 'changed' })); });
    expect(action.mock.calls[2][1]).not.toBe(action.mock.calls[1][1]);
  });
  it('requires an explicit decision for every old topic before transferring a version', async () => {
    const original = respond;
    respond = (path, opts) => path.endsWith('/version-transition') ? [200, {
      bindingId: 3, bindingRevision: 5, progressRevision: 8, fromVersionId: 1, toVersionId: 2,
      cutoff: '2026-10-19T10:00:00Z', historyFingerprint: 'history',
      previousTopics: [{ id: 11, title: 'Старая тема', plannedHours: 2, baseline: 1 }],
      currentTopics: [{ id: 22, title: 'Новая тема', plannedHours: 2 }], suggestedCorrespondences: [],
    }] : path.endsWith('/version-sync-preview') ? [200, { previewFingerprint: 'transfer', hasOverage: false, coverage: [], preservedLessonIds: [12] }]
      : path.endsWith('/version-sync') ? [200, {}] : original(path, opts);
    mount(<KtpVersionSyncModal id={3} onClose={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Проверить перенос прогресса' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Соответствие: Старая тема' }));
    await userEvent.click(screen.getByRole('option', { name: 'Новая тема' }));
    await userEvent.click(screen.getByRole('button', { name: 'Проверить перенос прогресса' }));
    await screen.findByText(/Сохранится уроков/);
    expect(screen.getByRole('button', { name: 'Подтвердить перенос' })).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: /Причина переноса/ }), 'Сверены темы новой программы');
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить перенос' }));
    await waitFor(() => expect(calls.some(c => c.path.endsWith('/version-sync'))).toBe(true));
    expect(calls.find(c => c.path.endsWith('/version-sync'))?.body).toMatchObject({
      previewFingerprint: 'transfer', request: { historyFingerprint: 'history', expectedBindingRevision: 5, expectedProgressRevision: 8,
        correspondences: [{ fromTopicId: 11, toTopicId: 22, share: 1 }], discardedOldTopicIds: [], targetStatuses: [{ topicId: 22, status: 'NONE' }] },
    });
  });
  it('sends an upload key without a JSON content type for multipart bytes', async () => {
    const file = new File(['docx'], 'plan.docx');
    await ktpApi.upload({ file, context: { academicYearId: 1, subjectId: 7, classIds: [4] } }, 'upload-key');
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[1]?.headers).toMatchObject({ 'Idempotency-Key': 'upload-key' });
    expect(call[1]?.headers).not.toHaveProperty('Content-Type');
    expect((call[1]?.body as FormData).get('file')).toBe(file);
  });
});
function ButtonForTest({ run, label }: { run: () => Promise<unknown>; label: string }) { return <button onClick={() => void run().catch(() => {})}>{label}</button>; }
