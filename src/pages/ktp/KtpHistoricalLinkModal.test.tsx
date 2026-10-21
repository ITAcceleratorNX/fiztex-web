import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { KtpHistoricalLinkModal } from './KtpHistoricalLinkModal';

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));
type Call = { path: string; method: string; body: Record<string, unknown>; key?: string };
let calls: Call[];
let progressRevision: number;
let rejectConfirmation: boolean;
let loseConfirmationResponse: boolean;
let baselineChanges: { topicId: number; before: number; after: number }[];
const lesson = { id: 12, classId: 4, className: '8А', subjectId: 7, subjectName: 'Математика',
  targetType: 'CLASS', subgroupId: null, status: 'ACTIVE', temporalStatus: 'FINISHED',
  startsAt: '2026-10-20T04:00:00Z', endsAt: '2026-10-20T04:45:00Z', topic: 'Сохранённая тема', capabilities: ['EDIT_TEACHING_PART'] };

beforeEach(() => {
  calls = []; progressRevision = 8; rejectConfirmation = false; loseConfirmationResponse = false;
  baselineChanges = [{ topicId: 11, before: 1, after: 0 }];
  vi.stubGlobal('fetch', vi.fn(async (path: string, options: RequestInit = {}) => {
    const call = { path, method: options.method ?? 'GET', body: options.body ? JSON.parse(String(options.body)) : {},
      key: (options.headers as Record<string, string>)?.['Idempotency-Key'] };
    calls.push(call);
    let body: unknown = {};
    let status = 200;
    if (path.endsWith('/bindings/3')) body = { id: 3, classId: 4, subjectId: 7, revision: 5, state: 'READY' };
    else if (path.endsWith('/progress')) body = { bindingRevision: 5, progressRevision,
      topics: [{ topicId: 11, order: 1, title: 'Дроби', plannedHours: 2, coveredHours: 1 }] };
    else if (path.startsWith('/api/lessons?')) body = { number: 0, totalPages: 1, content: [lesson,
      { ...lesson, id: 13, subjectId: 9, topic: 'Чужой предмет' },
      { ...lesson, id: 14, targetType: 'SUBGROUP', subgroupId: 2, topic: 'Занятие подгруппы' },
      { ...lesson, id: 15, temporalStatus: 'UPCOMING', topic: 'Будущее занятие' },
      { ...lesson, id: 16, status: 'CANCELLED', topic: 'Отменённое занятие' },
    ] };
    else if (path.endsWith('/historical-link-preview')) body = { bindingId: 3, lessonId: 12, progressRevision,
      previewFingerprint: 'historical-preview', baselineChanges };
    else if (path.endsWith('/historical-links')) {
      if (loseConfirmationResponse) { loseConfirmationResponse = false; throw new TypeError('Failed to fetch'); }
      if (rejectConfirmation) { status = 409; progressRevision = 9; body = { message: 'Прогресс изменился после проверки' }; }
      else body = { bindingId: 3, progressRevision: 9 };
    }
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

function show() {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><KtpHistoricalLinkModal bindingId={3}
    classLabel="8А" subjectLabel="Математика" yearLabel="2026/2027" onClose={onClose} /></MemoryRouter></QueryClientProvider>);
  return onClose;
}
async function completeForm() {
  const user = userEvent.setup();
  fireEvent.change(await screen.findByLabelText(/Дата проведённого урока/), { target: { value: '2026-10-20' } });
  await user.click(await screen.findByRole('button', { name: /Проведённый урок/ }));
  expect(screen.queryByRole('option', { name: /Чужой предмет|Занятие подгруппы|Будущее занятие|Отменённое занятие/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: /Сохранённая тема/ }));
  await user.click(screen.getByRole('button', { name: /Тема КТП 1/ }));
  await user.click(screen.getByRole('option', { name: /Дроби/ }));
  await user.type(screen.getByRole('textbox', { name: /Основание исторической привязки/ }), 'Подтверждено журналом и рабочими записями учителя');
  return user;
}

it('reviews a real finished lesson and requires accepting the displayed baseline change before writing', async () => {
  const close = show();
  const user = await completeForm();
  await user.click(screen.getByRole('button', { name: 'Проверить привязку' }));
  const review = await screen.findByRole('dialog', { name: 'Подтвердить привязку проведённого урока?' });
  expect(review).toHaveTextContent('Дроби · 1 ч');
  expect(review).toHaveTextContent('Подтверждено журналом');
  expect(within(review).getByRole('link', { name: 'Открыть карточку урока' })).toHaveAttribute('href', '/lesson-schedule/lessons/12');
  const baseline = within(review).getByRole('table', { name: 'Пересчёт начального прогресса' });
  expect(within(within(baseline).getAllByRole('row')[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Дроби', '1', '0']);
  expect(screen.getByRole('button', { name: 'Подтвердить привязку' })).toBeDisabled();
  expect(calls.some(call => call.path.endsWith('/historical-links'))).toBe(false);
  await user.click(screen.getByRole('checkbox', { name: /Подтверждаю пересчёт начального прогресса/ }));
  await user.click(screen.getByRole('button', { name: 'Подтвердить привязку' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  const command = calls.find(call => call.path.endsWith('/historical-links'))!;
  expect(command.key).toBeTruthy();
  expect(command.body).toEqual({ previewFingerprint: 'historical-preview', acceptBaselineAdjustment: true, request: {
    expectedBindingRevision: 5, expectedProgressRevision: 8, lessonId: 12, topics: [{ topicId: 11, units: 1 }],
    reason: 'Подтверждено журналом и рабочими записями учителя',
  } });
});

it('can leave a reviewed historical link without sending a write command', async () => {
  const close = show();
  const user = await completeForm();
  await user.click(screen.getByRole('button', { name: 'Проверить привязку' }));
  await screen.findByRole('dialog', { name: 'Подтвердить привязку проведённого урока?' });
  await user.click(screen.getByRole('button', { name: 'Назад к выбору' }));
  await user.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(close).toHaveBeenCalledOnce();
  expect(calls.some(call => call.path.endsWith('/historical-links'))).toBe(false);
});

it('confirms an unchanged baseline without an extra checkbox and satisfies the server confirmation contract', async () => {
  baselineChanges = [];
  const close = show();
  const user = await completeForm();
  await user.click(screen.getByRole('button', { name: 'Проверить привязку' }));
  await screen.findByRole('dialog', { name: 'Подтвердить привязку проведённого урока?' });
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Подтвердить привязку' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Подтвердить привязку' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(calls.find(call => call.path.endsWith('/historical-links'))?.body.acceptBaselineAdjustment).toBe(true);
});

it('retries the reviewed historical confirmation with the same key and consent after a lost response', async () => {
  loseConfirmationResponse = true;
  const close = show();
  const user = await completeForm();
  await user.click(screen.getByRole('button', { name: 'Проверить привязку' }));
  await user.click(await screen.findByRole('checkbox', { name: /Подтверждаю пересчёт начального прогресса/ }));
  await user.click(screen.getByRole('button', { name: 'Подтвердить привязку' }));
  const retry = await screen.findByRole('button', { name: 'Повторить подтверждение' });
  expect(retry).toBeEnabled();
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox', { name: /Подтверждаю пересчёт начального прогресса/ })).toBeChecked();
  await user.click(retry);
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  const confirmations = calls.filter(call => call.path.endsWith('/historical-links'));
  expect(confirmations).toHaveLength(2);
  expect(confirmations[0].key).toBeTruthy();
  expect(confirmations[1].key).toBe(confirmations[0].key);
  expect(confirmations[1].body).toEqual(confirmations[0].body);
  expect(confirmations[1].body.acceptBaselineAdjustment).toBe(true);
  expect(calls.filter(call => call.path.endsWith('/historical-link-preview'))).toHaveLength(1);
});

it('requires fresh data and a new preview after a concurrent progress change', async () => {
  rejectConfirmation = true;
  show();
  const user = await completeForm();
  await user.click(screen.getByRole('button', { name: 'Проверить привязку' }));
  await user.click(await screen.findByRole('checkbox', { name: /Подтверждаю пересчёт начального прогресса/ }));
  await user.click(screen.getByRole('button', { name: 'Подтвердить привязку' }));
  await screen.findByRole('button', { name: 'Обновить данные' });
  expect(screen.getByRole('button', { name: 'Проверить привязку' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Обновить данные' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Проверить привязку' })).toBeEnabled());
  expect(calls.filter(call => call.path.endsWith('/historical-links'))).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Проверить привязку' }));
  await screen.findByRole('dialog', { name: 'Подтвердить привязку проведённого урока?' });
  const previews = calls.filter(call => call.path.endsWith('/historical-link-preview'));
  expect(previews.at(-1)?.body.expectedProgressRevision).toBe(9);
  expect(screen.getByRole('button', { name: 'Подтвердить привязку' })).toBeDisabled();
});
