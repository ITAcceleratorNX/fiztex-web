import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { StudentYearTransitionModal } from './StudentYearTransitionModal';

const hooks = vi.hoisted(() => ({ preview: vi.fn(), apply: vi.fn() }));
vi.mock('@/hooks/queries', () => ({
  useStudentYearTransition: hooks.preview,
  useApplyStudentYearTransition: () => ({ mutateAsync: hooks.apply, isPending: false }),
}));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));

const fixture = {
  classId: 1, academicYearId: 1, className: '9А', sourceGrade: '9',
  earliestDecisionDate: '2026-06-01', yearEnded: true,
  students: [{ studentProfileId: 8, name: 'Тестовый Ученик', decision: null, blockers: [] }],
  targets: [
    { classId: 2, className: '10А', grade: '10', academicYearName: '2026/2027' },
    { classId: 3, className: '9Б', grade: '9', academicYearName: '2026/2027' },
  ],
};
function show() { render(<StudentYearTransitionModal classId="1" onClose={vi.fn()} onSaved={vi.fn()} />); }
beforeEach(() => {
  hooks.apply.mockReset();
  hooks.preview.mockReturnValue({ data: fixture, isPending: false, isError: false, isFetching: false });
});

it('offers only the next parallel for promotion and keeps graduation a separate choice', async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole('button', { name: 'Решение: Тестовый Ученик' }));
  expect(screen.getByRole('option', { name: 'Выпуск из школы' })).toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: 'Перевод в следующий класс' }));
  await user.click(screen.getByRole('button', { name: 'Следующий класс: Тестовый Ученик' }));
  expect(screen.getByRole('option', { name: '10А · 2026/2027' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '9Б · 2026/2027' })).not.toBeInTheDocument();
  expect(hooks.apply).not.toHaveBeenCalled();
});

it('does not allow decisions for an unfinished year', async () => {
  hooks.preview.mockReturnValue({ data: { ...fixture, sourceGrade: '7', yearEnded: false }, isPending: false, isError: false });
  show();
  expect(screen.getByRole('button', { name: 'Решение: Тестовый Ученик' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Проверить решения (0)' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Оформление решений доступно');
});

it('requires the order and shows each pupil outcome in the final review before sending it', async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole('button', { name: 'Решение: Тестовый Ученик' }));
  await user.click(screen.getByRole('option', { name: 'Выпуск из школы' }));
  expect(screen.getByRole('button', { name: 'Проверить решения (1)' })).toBeDisabled();
  await user.type(screen.getByRole('textbox', { name: /Номер приказа/ }), 'QA-9');
  const fields = screen.getByRole('dialog', { name: 'Перевод и выпуск' }).querySelectorAll('input[type="date"]');
  // Date input has no textbox role in jsdom; user input still goes through the DOM event.
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(fields[0], { target: { value: '2026-06-01' } });
  fireEvent.change(fields[1], { target: { value: '2026-06-01' } });
  await user.type(screen.getByRole('textbox', { name: /Основание и протокол/ }), 'Протокол итоговой аттестации QA');
  await user.click(screen.getByRole('button', { name: 'Проверить решения (1)' }));
  const review = screen.getByRole('dialog', { name: 'Оформить решения учеников?' });
  expect(within(review).getByText('Тестовый Ученик')).toBeInTheDocument();
  expect(review).toHaveTextContent('Выпуск из школы');
  expect(review).toHaveTextContent('QA-9');
  expect(hooks.apply).not.toHaveBeenCalled();
  await user.click(within(review).getByRole('button', { name: 'Оформить решения' }));
  expect(hooks.apply).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({
    orderNumber: 'QA-9', students: [{ studentProfileId: 8, decision: 'GRADUATE' }],
  }) }));
});
