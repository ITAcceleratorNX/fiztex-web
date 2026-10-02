import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReuseLessonPreparationModal } from './ReuseLessonPreparationModal';

const apply = vi.fn();
const currentLesson = vi.fn();

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('@/hooks/queries', () => ({
  useCurrentLesson: () => currentLesson(),
  useLessonPreparation: () => ({ data: { version: 3, documents: [] }, isPending: false, isError: false, refetch: vi.fn() }),
  useLessonPreparationTarget: (id: number | null) => ({ data: id ? { canApply: true, targetRevision: 'a'.repeat(64), topic: 'Старая тема' } : undefined,
    isPending: false, isError: false, refetch: vi.fn() }),
  useApplyLessonPreparation: () => ({ mutateAsync: apply, isPending: false }),
}));

const item = { id: 42, title: 'Заготовка', sourceId: '7', sourceKind: 'lesson-preparation',
  type: 'PREPARED_LESSON' as const, supportedActions: ['APPLY_PREPARATION_TO_LESSON' as const] };

beforeEach(() => {
  vi.clearAllMocks();
  currentLesson.mockReturnValue({ data: { lesson: { id: 5, subjectName: 'Физика', className: '7А',
    capabilities: ['EDIT_TEACHING_PART'] } }, isPending: false, isError: false });
  apply.mockResolvedValue({ id: 1 });
});

describe('ReuseLessonPreparationModal', () => {
  it('применяет заготовку к текущему уроку после подтверждения замены', async () => {
    const onClose = vi.fn();
    render(<ReuseLessonPreparationModal item={item} onClose={onClose} />);
    expect(screen.getByText(/Применение заготовки заменит их/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Заменить тему и конспект' }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith({ workspaceItemId: 42, version: 3,
      expectedTargetRevision: 'a'.repeat(64), confirmReplace: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('показывает согласованный empty-state без текущего урока', () => {
    currentLesson.mockReturnValue({ data: { lesson: null }, isPending: false, isError: false });
    render(<ReuseLessonPreparationModal item={item} onClose={vi.fn()} />);
    expect(screen.getByText('Нет доступного урока')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Применить к уроку' })).toBeDisabled();
  });
});
