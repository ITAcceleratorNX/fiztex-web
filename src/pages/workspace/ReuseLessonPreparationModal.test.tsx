import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReuseLessonPreparationModal } from './ReuseLessonPreparationModal';

const apply = vi.fn();
const lessons = vi.fn();
const target = vi.fn();

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('@/hooks/queries', () => ({
  useWorkspaceLessonTargets: (...args: unknown[]) => lessons(...args),
  useLessonPreparation: () => ({ data: { version: 3, documents: [] }, isPending: false, isError: false, refetch: vi.fn() }),
  useLessonPreparationTarget: (id: number | null) => target(id),
  useApplyLessonPreparation: (id: number) => ({ mutateAsync: (body: unknown) => apply(id, body), isPending: false }),
}));

const item = { id: 42, title: 'Заготовка', sourceId: '7', sourceKind: 'lesson-preparation',
  type: 'PREPARED_LESSON' as const, supportedActions: ['APPLY_PREPARATION_TO_LESSON' as const] };

beforeEach(() => {
  vi.clearAllMocks();
  lessons.mockReturnValue({ data: { content: [{ id: 8, subjectName: 'Физика', className: '7Б',
    date: '2026-10-08', academicPeriodStatus: 'ACTIVE', capabilities: ['EDIT_TEACHING_PART'] }], totalPages: 1 },
  isPending: false, isError: false });
  target.mockImplementation((id: number | null) => ({ data: id ? { canApply: true,
    targetRevision: 'a'.repeat(64), topic: 'Старая тема' } : undefined,
  isPending: false, isError: false, refetch: vi.fn() }));
  apply.mockResolvedValue({ id: 1 });
});

describe('ReuseLessonPreparationModal', () => {
  it('применяет заготовку к выбранному уроку, даже если он не текущий', async () => {
    const onClose = vi.fn();
    render(<ReuseLessonPreparationModal item={item} onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Применить к уроку' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Физика · 7Б/ }));
    expect(screen.getByText(/Применение заготовки заменит их/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Заменить тему и конспект' }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(8, { workspaceItemId: 42, version: 3,
      expectedTargetRevision: 'a'.repeat(64), confirmReplace: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('позволяет искать урок в другой неделе и показывает пустое состояние', async () => {
    lessons.mockImplementation((week: string) => ({ data: { content: week === '2026-10-05' ? [] : [{
      id: 9, subjectName: 'Физика', className: '8А', date: '2026-10-12',
      academicPeriodStatus: 'ACTIVE', capabilities: ['EDIT_TEACHING_PART'],
    }], totalPages: 1 }, isPending: false, isError: false }));
    render(<ReuseLessonPreparationModal item={item} onClose={vi.fn()} />);
    await userEvent.clear(screen.getByLabelText('Дата урока'));
    await userEvent.type(screen.getByLabelText('Дата урока'), '2026-10-05');
    expect(screen.getByText('Нет доступного урока')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Позже' }));
    expect(screen.getByRole('button', { name: /Физика · 8А/ })).toBeInTheDocument();
  });
});
