import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { KtpVersionSyncModal } from './KtpProgressModals';

type Call = { path: string; body: Record<string, unknown>; key?: string };
let calls: Call[];
let confirmationFailure: number | undefined;
let hasOverage: boolean;
let progressRevision: number;
beforeEach(() => {
  calls = []; confirmationFailure = undefined; hasOverage = false; progressRevision = 8;
  vi.stubGlobal('fetch', vi.fn(async (path: string, options: RequestInit = {}) => {
    calls.push({ path, body: options.body ? JSON.parse(String(options.body)) : {},
      key: (options.headers as Record<string, string>)?.['Idempotency-Key'] });
    let body: unknown = path.endsWith('/version-transition') ? {
      bindingId: 3, bindingRevision: 5, progressRevision, fromVersionId: 1, toVersionId: 2,
      cutoff: '2026-10-20T10:00:00Z', historyFingerprint: 'split-history',
      previousTopics: [{ id: 11, title: 'Прежняя тема', plannedHours: 2, baseline: 2 }],
      currentTopics: [{ id: 22, title: 'Первая часть', plannedHours: 1 }, { id: 33, title: 'Вторая часть', plannedHours: 1 }],
      suggestedCorrespondences: [],
    } : path.endsWith('/version-sync-preview') ? {
      previewFingerprint: 'split-preview', hasOverage, preservedLessonIds: [12], replaceableFutureLessonIds: [],
      coverage: [{ topicId: 22, total: 1, planned: 1 }, { topicId: 33, total: 1, planned: 1 }],
    } : {};
    let status = 200;
    if (path.endsWith('/version-sync') && confirmationFailure) {
      status = confirmationFailure; confirmationFailure = undefined;
      if (status === 409) progressRevision = 9;
      body = { message: status === 409 ? 'Прогресс изменился после проверки' : 'Сервер временно недоступен' };
    }
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

function show() {
  const close = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><KtpVersionSyncModal id={3} onClose={close} /></MemoryRouter></QueryClientProvider>);
  return close;
}
async function chooseSplit() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Соответствие: Прежняя тема' }));
  await user.click(screen.getByRole('option', { name: 'Разделить между темами' }));
  await user.click(screen.getByRole('button', { name: 'Новая тема 1: Прежняя тема' }));
  await user.click(screen.getByRole('option', { name: 'Первая часть' }));
  await user.click(screen.getByRole('button', { name: 'Новая тема 2: Прежняя тема' }));
  await user.click(screen.getByRole('option', { name: 'Вторая часть' }));
  return user;
}

it('splits one old topic equally, reviews server coverage, and confirms exactly the reviewed shares', async () => {
  const close = show();
  const user = await chooseSplit();
  expect(screen.getByText('Сумма долей: 1 из 1 (100%)')).toBeInTheDocument();
  expect(screen.getAllByText('Из прежнего прогресса: 1 ч')).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: 'Проверить перенос прогресса' }));
  await screen.findByRole('table', { name: 'Предпросмотр переноса прогресса' });
  expect(calls.some(call => call.path.endsWith('/version-sync'))).toBe(false);
  expect(screen.getByRole('button', { name: 'Подтвердить перенос' })).toBeDisabled();
  await user.type(screen.getByRole('textbox', { name: /Причина переноса/ }), 'Прежняя тема разделена на две равные части');
  await user.click(screen.getByRole('button', { name: 'Подтвердить перенос' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  const expected = [{ fromTopicId: 11, toTopicId: 22, share: 0.5 }, { fromTopicId: 11, toTopicId: 33, share: 0.5 }];
  expect(calls.find(call => call.path.endsWith('/version-sync-preview'))?.body.correspondences).toEqual(expected);
  expect(calls.find(call => call.path.endsWith('/version-sync'))?.body).toMatchObject({
    previewFingerprint: 'split-preview', request: { correspondences: expected, discardedOldTopicIds: [] },
  });
});

it('retries the same reviewed version transfer after a temporary failure without losing consent or its key', async () => {
  confirmationFailure = 503; hasOverage = true;
  const close = show();
  const user = await chooseSplit();
  await user.click(screen.getByRole('button', { name: 'Проверить перенос прогресса' }));
  await screen.findByRole('table', { name: 'Предпросмотр переноса прогресса' });
  await user.type(screen.getByRole('textbox', { name: /Причина переноса/ }), 'Прежняя тема разделена на две равные части');
  await user.click(screen.getByRole('checkbox', { name: 'Я принимаю превышение часов в новой версии' }));
  await user.click(screen.getByRole('button', { name: 'Подтвердить перенос' }));
  const retry = await screen.findByRole('button', { name: 'Повторить подтверждение' });
  expect(retry).toBeEnabled();
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox', { name: 'Я принимаю превышение часов в новой версии' })).toBeChecked();
  expect(screen.getByRole('textbox', { name: /Причина переноса/ })).toHaveValue('Прежняя тема разделена на две равные части');
  await user.click(retry);
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  const confirmations = calls.filter(call => call.path.endsWith('/version-sync'));
  expect(confirmations).toHaveLength(2);
  expect(confirmations[0].key).toBeTruthy();
  expect(confirmations[1].key).toBe(confirmations[0].key);
  expect(confirmations[1].body).toEqual(confirmations[0].body);
  expect(confirmations[1].body.acceptOverage).toBe(true);
  expect(calls.filter(call => call.path.endsWith('/version-sync-preview'))).toHaveLength(1);
});

it('requires refresh and another preview rather than retrying a conflicted version transfer', async () => {
  confirmationFailure = 409;
  show();
  const user = await chooseSplit();
  await user.click(screen.getByRole('button', { name: 'Проверить перенос прогресса' }));
  await screen.findByRole('table', { name: 'Предпросмотр переноса прогресса' });
  await user.type(screen.getByRole('textbox', { name: /Причина переноса/ }), 'Прежняя тема разделена на две равные части');
  await user.click(screen.getByRole('button', { name: 'Подтвердить перенос' }));
  await screen.findByRole('button', { name: 'Обновить данные' });
  expect(screen.queryByRole('button', { name: 'Повторить подтверждение' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Подтвердить перенос' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Проверить перенос прогресса' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Обновить данные' }));
  await chooseSplit();
  await user.click(screen.getByRole('button', { name: 'Проверить перенос прогресса' }));
  await screen.findByRole('table', { name: 'Предпросмотр переноса прогресса' });
  expect(calls.filter(call => call.path.endsWith('/version-sync'))).toHaveLength(1);
  expect(calls.filter(call => call.path.endsWith('/version-sync-preview')).at(-1)?.body.expectedProgressRevision).toBe(9);
});

it('blocks incomplete totals and duplicate targets before asking the server', async () => {
  show();
  const user = await chooseSplit();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Доля 1: Прежняя тема' }), { target: { value: '0.25' } });
  expect(screen.getByText('Сумма долей: 0,75 из 1 (75%)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Проверить перенос прогресса' })).toBeDisabled();
  for (const value of ['0', '1.2', '0.00001']) {
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Доля 1: Прежняя тема' }), { target: { value } });
    expect(screen.getByText(/Доля должна быть больше 0 и не больше 1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Проверить перенос прогресса' })).toBeDisabled();
  }
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Доля 1: Прежняя тема' }), { target: { value: '0.5' } });
  await user.click(screen.getByRole('button', { name: 'Новая тема 2: Прежняя тема' }));
  await user.click(screen.getByRole('option', { name: 'Первая часть' }));
  expect(screen.getByText(/Одна новая тема не должна повторяться/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Проверить перенос прогресса' })).toBeDisabled();
  expect(calls.some(call => call.path.endsWith('/version-sync-preview'))).toBe(false);
});

it('invalidates a reviewed split after editing a share and allows an explicit no-transfer decision', async () => {
  show();
  const user = await chooseSplit();
  await user.click(screen.getByRole('button', { name: 'Проверить перенос прогресса' }));
  await screen.findByRole('table', { name: 'Предпросмотр переноса прогресса' });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Доля 1: Прежняя тема' }), { target: { value: '0.3' } });
  expect(screen.queryByRole('table', { name: 'Предпросмотр переноса прогресса' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Подтвердить перенос' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Соответствие: Прежняя тема' }));
  await user.click(screen.getByRole('option', { name: 'Не переносить прогресс этой темы' }));
  await user.click(screen.getByRole('button', { name: 'Проверить перенос прогресса' }));
  await screen.findByRole('table', { name: 'Предпросмотр переноса прогресса' });
  const previews = calls.filter(call => call.path.endsWith('/version-sync-preview'));
  expect(previews.at(-1)?.body).toMatchObject({ correspondences: [], discardedOldTopicIds: [11] });
  expect(screen.getByText(/Прогресс этих тем не переносится: Прежняя тема/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Назад' }));
  expect(calls.some(call => call.path.endsWith('/version-sync'))).toBe(false);
});
