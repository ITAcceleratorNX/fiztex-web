import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { MyClassYearDecisionsModal } from './MyClassYearDecisionsModal';
import { MyClassStudentsTab } from './MyClassStudentsTab';

const history = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/queries', () => ({
  useMyClassYearDecisions: history,
  useMyClassRoster: () => ({ isPending: false, isError: false, data: { pages: [{ items: [], totalItems: 0 }] } }),
}));
beforeEach(() => history.mockReturnValue({ isPending: false, isError: false, data: [] }));

it('explains an empty class decision history', () => {
  render(<MyClassYearDecisionsModal classId={4} onClose={vi.fn()} />);
  expect(history).toHaveBeenCalledWith(4);
  expect(screen.getByText('Решения ещё не оформлены')).toBeInTheDocument();
});

it('shows the teacher both orders without a cancellation control', () => {
  history.mockReturnValue({ isPending: false, isError: false, data: [{
    id: 12, studentName: 'Тестовый Ученик', decision: 'PROMOTE', orderNumber: 'PROMOTE-9',
    sourceClassName: '9А', targetClassName: '10Б', cancelled: true,
    cancellation: { orderNumber: 'CANCEL-9', reason: 'Исправление ошибочного перевода', actorName: 'Директор' },
  }] });
  render(<MyClassYearDecisionsModal classId={4} onClose={vi.fn()} />);
  expect(screen.getByText('Тестовый Ученик')).toBeInTheDocument();
  expect(screen.getByText('Отменено')).toBeInTheDocument();
  expect(screen.getByText(/PROMOTE-9/)).toBeInTheDocument();
  expect(screen.getByText(/CANCEL-9/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Отменить/ })).not.toBeInTheDocument();
});

it('keeps the history reachable after a cancelled transfer has removed the pupil from the current roster', async () => {
  history.mockReturnValue({ isPending: false, isError: false, data: [{
    id: 12, studentName: 'Вернувшийся Ученик', decision: 'PROMOTE', cancelled: true,
    orderNumber: 'PROMOTE-9', cancellation: { orderNumber: 'CANCEL-9', reason: 'Исправление ошибки' },
  }] });
  render(<MyClassStudentsTab classId={4} />);
  expect(screen.getByText('В классе пока нет учеников')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'История перевода и выпуска' }));
  expect(screen.getByRole('dialog', { name: 'История перевода и выпуска' })).toBeInTheDocument();
  expect(screen.getByText('Вернувшийся Ученик')).toBeInTheDocument();
  expect(screen.getByText('Отменено')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Отменить/ })).not.toBeInTheDocument();
});
