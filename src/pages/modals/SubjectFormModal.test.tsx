import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubjectFormModal } from './SubjectFormModal';
import { useCreateSubject, useUpdateSubject } from '@/hooks/queries';
import { SUBJECT_MAX_DESCRIPTION_LENGTH, SUBJECT_MAX_NAME_LENGTH } from './subjectConstraints';

vi.mock('@/hooks/queries', () => ({
  useCreateSubject: vi.fn(),
  useUpdateSubject: vi.fn(),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

function mockCreateMutation(mutateAsync: ReturnType<typeof vi.fn>) {
  vi.mocked(useCreateSubject).mockReturnValue({
    isPending: false,
    mutateAsync,
  } as unknown as ReturnType<typeof useCreateSubject>);
}

function mockUpdateMutation(mutateAsync: ReturnType<typeof vi.fn>) {
  vi.mocked(useUpdateSubject).mockReturnValue({
    isPending: false,
    mutateAsync,
  } as unknown as ReturnType<typeof useUpdateSubject>);
}

function apiError(message: string, details?: unknown) {
  const err = new Error(message) as Error & { name: string; status: number; details?: unknown };
  err.name = 'ApiError';
  err.status = 400;
  err.details = details;
  return err;
}

function renderModal() {
  render(<SubjectFormModal open onClose={() => {}} subject={null} />);
  return within(screen.getByRole('dialog'));
}

describe('SubjectFormModal', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMutation(vi.fn());
    mockUpdateMutation(vi.fn());
  });

  it('renders char counters for name and description', () => {
    const dialog = renderModal();

    expect(dialog.getByText(`0/${SUBJECT_MAX_NAME_LENGTH}`)).toBeInTheDocument();
    expect(dialog.getByText(`0/${SUBJECT_MAX_DESCRIPTION_LENGTH}`)).toBeInTheDocument();
  });

  it('sets maxLength on name and description inputs', () => {
    const dialog = renderModal();

    expect(dialog.getByPlaceholderText('Например: Математика')).toHaveAttribute(
      'maxLength',
      String(SUBJECT_MAX_NAME_LENGTH),
    );
    expect(dialog.getByPlaceholderText('Краткое описание предмета')).toHaveAttribute(
      'maxLength',
      String(SUBJECT_MAX_DESCRIPTION_LENGTH),
    );
  });

  it('updates name counter as user types', async () => {
    const user = userEvent.setup();
    const dialog = renderModal();

    await user.type(dialog.getByPlaceholderText('Например: Математика'), 'Math');

    expect(dialog.getByText('4/120')).toBeInTheDocument();
  });

  it('shows server validation error under the name field', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockRejectedValue(
      apiError('name: fallback', [
        { field: 'name', message: 'Название предмета не должно превышать 120 символов' },
      ]),
    );
    mockCreateMutation(mutateAsync);

    const dialog = renderModal();

    await user.type(dialog.getByPlaceholderText('Например: Математика'), 'Math');
    await user.click(dialog.getByRole('button', { name: 'Создать' }));

    await waitFor(() => {
      expect(
        dialog.getByText('Название предмета не должно превышать 120 символов'),
      ).toBeInTheDocument();
    });
    expect(dialog.getByPlaceholderText('Например: Математика')).toHaveClass('border-red-300');
    expect(dialog.queryByText('fallback')).not.toBeInTheDocument();
  });

  it('shows server validation error under the description field', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockRejectedValue(
      apiError('description: fallback', [
        { field: 'description', message: 'Описание не должно превышать 2000 символов' },
      ]),
    );
    mockCreateMutation(mutateAsync);

    const dialog = renderModal();

    await user.type(dialog.getByPlaceholderText('Например: Математика'), 'Math');
    await user.type(dialog.getByPlaceholderText('Краткое описание предмета'), 'Too long');
    await user.click(dialog.getByRole('button', { name: 'Создать' }));

    await waitFor(() => {
      expect(dialog.getByText('Описание не должно превышать 2000 символов')).toBeInTheDocument();
    });
    expect(dialog.getByPlaceholderText('Краткое описание предмета')).toHaveClass('border-red-300');
  });
});
