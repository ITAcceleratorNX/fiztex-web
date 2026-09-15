import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssignPsychTestModal } from './AssignPsychTestModal';
import { useAssignPsychTest, usePsychTestClasses } from '@/hooks/psychTestQueries';
import { ApiError } from '@/lib/api';

const toast = { success: vi.fn(), error: vi.fn() };

vi.mock('@/hooks/psychTestQueries', () => ({
  usePsychTestClasses: vi.fn(),
  useAssignPsychTest: vi.fn(),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => toast,
}));

function mockAssign(mutateAsync: ReturnType<typeof vi.fn>) {
  vi.mocked(useAssignPsychTest).mockReturnValue({
    isPending: false,
    mutateAsync,
  } as unknown as ReturnType<typeof useAssignPsychTest>);
}

describe('AssignPsychTestModal', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePsychTestClasses).mockReturnValue({
      data: [
        { id: 1, name: '7А', grade: '7', letter: 'А', studentsCount: 25 },
        { id: 2, name: '7Б', grade: '7', letter: 'Б', studentsCount: 0 },
        { id: 3, name: '10А', grade: '10', letter: 'А', studentsCount: 20 },
      ],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof usePsychTestClasses>);
  });

  it('назначает выбранные классы и показывает число учеников до отправки', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 9, recipientsTotal: 25 });
    mockAssign(mutateAsync);

    render(<AssignPsychTestModal open onClose={onClose} testId={4} testTitle="Тревожность" />);

    // Пустой класс виден сразу, а не по отказу сервера.
    expect(screen.getByText('нет учеников')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назначить' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /7А/ }));
    const submit = screen.getByRole('button', { name: 'Назначить · 25 учеников' });
    expect(submit).toBeEnabled();

    await user.click(submit);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ classIds: [1], deadlineAt: undefined }));
    expect(toast.success).toHaveBeenCalledWith('Тест назначен: 25 учеников');
    expect(onClose).toHaveBeenCalled();
  });

  it('показывает отказ сервера словами сервера и не закрывает окно', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockAssign(
      vi.fn().mockRejectedValue(
        new ApiError(409, 'Тест уже открыт для класса: 7А', 'PSYCH_TEST_ALREADY_ASSIGNED'),
      ),
    );

    render(<AssignPsychTestModal open onClose={onClose} testId={4} testTitle="Тревожность" />);
    await user.click(screen.getByRole('checkbox', { name: /7А/ }));
    await user.click(screen.getByRole('button', { name: 'Назначить · 25 учеников' }));

    expect(await screen.findByText('Тест уже открыт для класса: 7А')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('не даёт отправить срок в прошлом', async () => {
    const user = userEvent.setup();
    mockAssign(vi.fn());

    const { container } = render(<AssignPsychTestModal open onClose={() => {}} testId={4} testTitle="Тревожность" />);
    await user.click(screen.getByRole('checkbox', { name: /10А/ }));

    const deadline = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    fireEvent.change(deadline, { target: { value: '2000-01-01T10:00' } });

    expect(screen.getByText('Срок должен быть в будущем')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назначить · 20 учеников' })).toBeDisabled();
  });
});
