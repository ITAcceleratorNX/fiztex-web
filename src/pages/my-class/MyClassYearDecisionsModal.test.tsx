import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { MyClassYearDecisionsModal } from './MyClassYearDecisionsModal';
import { MyClassStudentsTab } from './MyClassStudentsTab';

const history = vi.hoisted(() => vi.fn());
const dynamics = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/queries', () => ({
  useMyClassYearDecisions: history,
}));
vi.mock('@/hooks/dynamicsQueries', () => ({ useClassGradeDynamics: dynamics }));
beforeEach(() => {
  history.mockReset().mockReturnValue({ isPending: false, isError: false, data: [] });
  dynamics.mockReset().mockReturnValue({ isPending: false, isError: false, data: { students: [] } });
});

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
  render(<MemoryRouter><MyClassStudentsTab classId={4} className="10Б" onForbidden={vi.fn()} /></MemoryRouter>);
  expect(screen.getByText('В классе пока нет учеников')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'История перевода и выпуска' }));
  expect(screen.getByRole('dialog', { name: 'История перевода и выпуска' })).toBeInTheDocument();
  expect(screen.getByText('Вернувшийся Ученик')).toBeInTheDocument();
  expect(screen.getByText('Отменено')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Отменить/ })).not.toBeInTheDocument();
});

it('opens and closes decision history without losing the selected dynamics period or the current pupils', async () => {
  dynamics.mockReturnValue({ isPending: false, isError: false, data: { students: [{
    studentProfileId: 4, displayName: 'Ученик текущего класса',
    overall: { current: { state: 'NO_DATA' }, trend: 'INSUFFICIENT_DATA' },
  }] } });
  render(<MemoryRouter initialEntries={['/my-class?dynPeriod=MONTH&dynSort=decline']}>
    <MyClassStudentsTab classId={4} className="10Б" onForbidden={vi.fn()} />
  </MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: 'История перевода и выпуска' }));
  expect(history).toHaveBeenCalledWith(4);
  expect(screen.getByRole('dialog', { name: 'История перевода и выпуска' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Месяц' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('button', { name: 'Открыть динамику: Ученик текущего класса' })).toBeInTheDocument();
  expect(dynamics).toHaveBeenLastCalledWith(4, 'MONTH');
});
