import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { PeriodFormModal } from './PeriodFormModal';
import type { AcademicPeriod } from '../types';

const api = vi.hoisted(() => ({ save: vi.fn(), success: vi.fn() }));
vi.mock('@/hooks/queries', () => ({ useSaveAcademicPeriod: () => ({ mutateAsync: api.save, isPending: false }) }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: api.success }) }));
const years = [{ id: '2', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-05-25',
  status: 'ACTIVE' as const, createdAt: '' }];
const period: AcademicPeriod = { id: '8', academicYearId: '2', name: '1 четверть', type: 'QUARTER',
  startDate: '2026-09-01', endDate: '2026-10-27', status: 'DISABLED' };
function show(editing: AcademicPeriod | null = period) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<PeriodFormModal open period={editing} years={years} onSaved={onSaved} onClose={onClose} />);
  return { onSaved, onClose };
}
beforeEach(() => { vi.clearAllMocks(); api.save.mockResolvedValue({ ...period, status: 'ACTIVE' }); });

it('submits ACTIVE when an administrator enables a disabled period', async () => {
  const { onSaved } = show();
  expect(screen.getByRole('switch', { name: 'Период активен' })).not.toBeChecked();
  await userEvent.click(screen.getByRole('switch', { name: 'Период активен' }));
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(api.save).toHaveBeenCalledWith({ periodId: '8', input: expect.objectContaining({ status: 'ACTIVE' }) });
  expect(onSaved).toHaveBeenCalledOnce();
});

it('retains the form and does not announce success after a rejected activation', async () => {
  api.save.mockRejectedValue(new Error('Не удалось активировать период'));
  const { onSaved, onClose } = show();
  await userEvent.click(screen.getByRole('switch', { name: 'Период активен' }));
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Период активен' })).toBeChecked();
  expect(api.success).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

it('creates a usable active period by default while allowing an explicit disabled period', async () => {
  show(null);
  expect(screen.getByRole('switch', { name: 'Период активен' })).toBeChecked();
  await userEvent.type(screen.getByRole('textbox', { name: /Название периода/ }), '1 четверть');
  fireEvent.change(screen.getByLabelText(/Дата начала/), { target: { value: '2026-09-01' } });
  fireEvent.change(screen.getByLabelText(/Дата окончания/), { target: { value: '2026-10-27' } });
  await userEvent.click(screen.getByRole('switch', { name: 'Период активен' }));
  await userEvent.click(screen.getByRole('button', { name: 'Создать' }));
  expect(api.save).toHaveBeenCalledWith({ input: expect.objectContaining({ status: 'DISABLED' }) });
});
