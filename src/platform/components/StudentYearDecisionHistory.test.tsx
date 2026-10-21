import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { StudentYearDecisionHistory } from './StudentYearDecisionHistory';

const original = { id: 11, studentName: 'Тестовый Ученик', decision: 'GRADUATE', sourceClassName: '9А',
  sourceYearName: '2025/2026', orderNumber: 'OUT-9', orderDate: '2026-06-01', actorName: 'Директор' };

it('retains the original graduation and cancellation order, and permits cancelling only the later active decision', async () => {
  const onCancel = vi.fn();
  const active = { ...original, id: 12, decision: 'PROMOTE', orderNumber: 'NEW-9', targetClassName: '10А' };
  render(<StudentYearDecisionHistory decisions={[{ ...original, cancelled: true, cancellation: {
    orderNumber: 'CANCEL-9', orderDate: '2026-10-20', reason: 'Ошибочное решение о выпуске', actorName: 'Администратор',
  } }, active]} showStudent onCancel={onCancel} />);
  expect(screen.getByText('Отменено')).toBeInTheDocument();
  expect(screen.getByText('Действует')).toBeInTheDocument();
  expect(screen.getByText(/OUT-9/)).toBeInTheDocument();
  expect(screen.getByText(/CANCEL-9/)).toBeInTheDocument();
  expect(screen.getByText('Ошибочное решение о выпуске')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Отменить решение' })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Отменить решение' }));
  expect(onCancel).toHaveBeenCalledWith(active);
});

it('provides a read-only history when no administrator action is passed', () => {
  render(<StudentYearDecisionHistory decisions={[original]} showStudent />);
  expect(screen.getByText('Тестовый Ученик')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
