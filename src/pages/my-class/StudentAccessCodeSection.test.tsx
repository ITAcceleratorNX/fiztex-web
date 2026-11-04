import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentAccessCodeSection } from './StudentAccessCodeSection';

const useTeacherStudentAccess = vi.fn();
const issueAsync = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useTeacherStudentAccess: () => useTeacherStudentAccess(),
  useIssueStudentAccessCode: () => ({ mutateAsync: issueAsync, isPending: false }),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const ready = <T,>(data: T) => ({ data, isPending: false, isError: false });

beforeEach(() => {
  useTeacherStudentAccess.mockReset();
  issueAsync.mockReset().mockResolvedValue({ issuedCode: 'D6A44QAX' });
});

describe('персональный код ученика у классного руководителя', () => {
  it('без разрешения администратора не показывает кнопок', () => {
    useTeacherStudentAccess.mockReturnValue(ready([]));
    render(<StudentAccessCodeSection studentProfileId={7} />);

    expect(screen.getByText(/Администратор не открыл вам выдачу кода/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ученику без выданного кода предлагает выдать первый — без подтверждения', async () => {
    useTeacherStudentAccess.mockReturnValue(ready([
      { studentProfileId: 7, codeIssuedAt: undefined, pinSet: false, canIssueCode: true },
    ]));
    render(<StudentAccessCodeSection studentProfileId={7} />);

    expect(screen.getByText('Ученик ещё не заходил в приложение')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Выдать код' }));

    expect(issueAsync).toHaveBeenCalledWith({ studentProfileId: 7, confirmReissue: false });
    expect(await screen.findByText('D6A44QAX')).toBeInTheDocument();
  });

  it('у выданного кода перевыпуск спрашивает подтверждение', async () => {
    useTeacherStudentAccess.mockReturnValue(ready([
      { studentProfileId: 7, codeIssuedAt: '2026-08-27T10:00:00Z', pinSet: true, canIssueCode: true },
    ]));
    render(<StudentAccessCodeSection studentProfileId={7} />);

    expect(screen.getByText(/Уже входил в приложение/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Выдать новый код' }));

    // Нажатие само по себе ничего не выпускает: сначала человек читает последствие.
    expect(issueAsync).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Выдать новый код' }));
    expect(issueAsync).toHaveBeenCalledWith({ studentProfileId: 7, confirmReissue: true });
  });

  it('выключенному аккаунту код не выдать', () => {
    useTeacherStudentAccess.mockReturnValue(ready([
      { studentProfileId: 7, codeIssuedAt: '2026-08-27T10:00:00Z', pinSet: false, canIssueCode: false },
    ]));
    render(<StudentAccessCodeSection studentProfileId={7} />);

    expect(screen.getByRole('button', { name: 'Выдать новый код' })).toBeDisabled();
    expect(screen.getByText(/Аккаунт ученика выключен/)).toBeInTheDocument();
  });
});
