import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { StudentYearDecisionCancellationModal } from './StudentYearDecisionCancellationModal';

const hooks = vi.hoisted(() => ({ preview: vi.fn(), cancel: vi.fn(), refetch: vi.fn() }));
vi.mock('@/hooks/queries', () => ({
  useStudentYearDecisionCancellation: hooks.preview,
  useCancelStudentYearDecision: () => ({ mutateAsync: hooks.cancel, isPending: false }),
}));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));

const decision = {
  id: 21, studentProfileId: 8, studentName: 'Тестовый Ученик', decision: 'PROMOTE',
  sourceClassName: '9А', sourceYearName: '2025/2026', targetClassName: '10Б', targetYearName: '2026/2027',
  orderNumber: 'OLD-9', orderDate: '2026-06-01', effectiveDate: '2026-06-01', basis: 'Исходный протокол',
  cancelled: false, actorName: 'Администратор',
};
const preview = {
  decisionId: 21, canCancel: true, blockers: [],
  effects: ['Вернуть ученика в 9А (2025/2026)', 'Отменить зачисление в 10Б (2026/2027)'],
};
const onSaved = vi.fn();
const onClose = vi.fn();
function show() { render(<StudentYearDecisionCancellationModal decision={decision} onSaved={onSaved} onClose={onClose} />); }
async function fillForm() {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: /Номер приказа об отмене/ }), 'CANCEL-9');
  fireEvent.change(screen.getByLabelText(/Дата приказа об отмене/), { target: { value: '2026-10-20' } });
  await user.type(screen.getByRole('textbox', { name: /Причина отмены/ }), 'Ошибочно выбран класс перевода');
  return user;
}
beforeEach(() => {
  vi.clearAllMocks();
  hooks.preview.mockReturnValue({ data: preview, isPending: false, isError: false, isFetching: false, refetch: hooks.refetch });
  hooks.cancel.mockResolvedValue({ ...preview, canCancel: false });
});

it('requires a separate order and reviews the exact decision and membership effects before cancelling', async () => {
  show();
  expect(screen.getByRole('button', { name: 'Проверить отмену' })).toBeDisabled();
  const user = await fillForm();
  await user.click(screen.getByRole('button', { name: 'Проверить отмену' }));
  const review = screen.getByRole('dialog', { name: 'Подтвердить отмену решения?' });
  expect(review).toHaveTextContent('OLD-9');
  expect(review).toHaveTextContent('CANCEL-9');
  expect(review).toHaveTextContent('Вернуть ученика в 9А (2025/2026)');
  expect(review).toHaveTextContent('Отменить зачисление в 10Б (2026/2027)');
  expect(hooks.cancel).not.toHaveBeenCalled();
  await user.click(within(review).getByRole('button', { name: 'Отменить решение по приказу' }));
  expect(hooks.cancel).toHaveBeenCalledWith({ decisionId: 21, body: {
    expectedDecisionId: 21, orderNumber: 'CANCEL-9', orderDate: '2026-10-20', reason: 'Ошибочно выбран класс перевода',
  } });
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('keeps cancellation unavailable when the server reports a dependency, even with a complete order', async () => {
  hooks.preview.mockReturnValue({ data: { ...preview, canCancel: false, blockers: ['Сначала восстановите исходный учебный год'] },
    isPending: false, isError: false, refetch: hooks.refetch });
  show();
  const user = await fillForm();
  expect(screen.getByRole('status')).toHaveTextContent('Сначала восстановите исходный учебный год');
  expect(screen.getByRole('button', { name: 'Проверить отмену' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Проверить снова' }));
  expect(hooks.refetch).toHaveBeenCalledTimes(1);
  expect(hooks.cancel).not.toHaveBeenCalled();
});

it('refreshes the preview and preserves the entered order after a server conflict', async () => {
  hooks.cancel.mockRejectedValue(new Error('В целевом классе появились оценки ученика'));
  show();
  const user = await fillForm();
  await user.click(screen.getByRole('button', { name: 'Проверить отмену' }));
  await user.click(screen.getByRole('button', { name: 'Отменить решение по приказу' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('В целевом классе появились оценки ученика');
  expect(screen.getByRole('textbox', { name: /Номер приказа об отмене/ })).toHaveValue('CANCEL-9');
  expect(hooks.refetch).toHaveBeenCalledTimes(1);
  expect(onSaved).not.toHaveBeenCalled();
});
