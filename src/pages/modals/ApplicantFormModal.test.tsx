import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicantFormModal } from './ApplicantFormModal';
import { useCreateApplicant, useUpdateApplicant } from '@/hooks/queries';
import { APPLICANT_INVALID_PHONE_MESSAGE } from './applicantFormHelpers';

vi.mock('@/hooks/queries', () => ({
  useCreateApplicant: vi.fn(),
  useUpdateApplicant: vi.fn(),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

describe('ApplicantFormModal phone validation', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateApplicant).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as ReturnType<typeof useCreateApplicant>);
    vi.mocked(useUpdateApplicant).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as ReturnType<typeof useUpdateApplicant>);
  });

  it('shows blur validation error for invalid phone', async () => {
    const user = userEvent.setup();
    render(<ApplicantFormModal open onClose={() => {}} applicant={null} />);

    const phoneInput = screen.getByPlaceholderText('+7 705 123 45 67');
    await user.type(phoneInput, 'abc');
    await user.tab();

    expect(screen.getByText(APPLICANT_INVALID_PHONE_MESSAGE)).toBeInTheDocument();
  });

  it('blocks submit when phone is invalid', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn();
    vi.mocked(useCreateApplicant).mockReturnValue({
      isPending: false,
      mutateAsync,
    } as ReturnType<typeof useCreateApplicant>);

    render(<ApplicantFormModal open onClose={() => {}} applicant={null} />);

    await user.type(screen.getByPlaceholderText('Иванов Иван'), 'Test Child');
    await user.type(screen.getByPlaceholderText('5 класс'), '5 класс');
    await user.type(screen.getByPlaceholderText('+7 705 123 45 67'), 'bad-phone');
    await user.click(screen.getByRole('button', { name: 'Создать' }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(APPLICANT_INVALID_PHONE_MESSAGE)).toBeInTheDocument();
  });

  it('shows server validation error on parentPhone field', async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error('validation'), {
      name: 'ApiError',
      status: 400,
      details: [{ field: 'parentPhone', message: APPLICANT_INVALID_PHONE_MESSAGE }],
    });
    vi.mocked(useCreateApplicant).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockRejectedValue(err),
    } as ReturnType<typeof useCreateApplicant>);

    render(<ApplicantFormModal open onClose={() => {}} applicant={null} />);

    await user.type(screen.getByPlaceholderText('Иванов Иван'), 'Test Child');
    await user.type(screen.getByPlaceholderText('5 класс'), '5 класс');
    await user.type(screen.getByPlaceholderText('+7 705 123 45 67'), '+77051234567');
    await user.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() => {
      expect(screen.getByText(APPLICANT_INVALID_PHONE_MESSAGE)).toBeInTheDocument();
    });
  });
});
