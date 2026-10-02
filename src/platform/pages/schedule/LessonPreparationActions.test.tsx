import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonPreparationActions } from './LessonPreparationActions';

const create = vi.fn();
const apply = vi.fn();

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('@/components/workspace/WorkspaceMaterialPickerModal', () => ({
  WorkspaceMaterialPickerModal: ({ type, onConfirm }: {
    type?: string; onConfirm: (items: object[]) => void;
  }) => <button onClick={() => onConfirm(type === 'PREPARED_LESSON'
    ? [{ id: 42, sourceId: '7', sourceKind: 'lesson-preparation', title: 'Заготовка' }]
    : [{ id: 12, title: 'Конспект.pdf' }])}>Выбрать {type === 'PREPARED_LESSON' ? 'заготовку' : 'документ'}</button>,
}));
vi.mock('@/hooks/queries', () => ({
  useCreateLessonPreparation: () => ({ mutateAsync: create, isPending: false }),
  useApplyLessonPreparation: () => ({ mutateAsync: apply, isPending: false }),
  useLessonPreparation: () => ({ data: { title: 'Заготовка', version: 2, topic: 'Давление', documents: [] }, isPending: false, isError: false, refetch: vi.fn() }),
  useLessonPreparationTarget: () => ({ data: { canApply: true, targetRevision: 'a'.repeat(64), topic: 'Старая тема' }, isPending: false, isError: false, refetch: vi.fn() }),
}));

const summary = { title: 'Давление', summaryText: 'Конспект', companionText: 'План', companionKind: 'PLAN' as const };

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({ id: 7 });
  apply.mockResolvedValue({ id: 8 });
});

describe('LessonPreparationActions', () => {
  it('сохраняет тему, конспект и выбранный документ в заготовку', async () => {
    render(<LessonPreparationActions lessonId={5} lessonTopic="Давление" summary={summary} onApplied={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить как заготовку' }));
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать из рабочего пространства' }));
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать документ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({
      title: 'Давление', topic: 'Давление', summary, documentWorkspaceItemIds: [12],
    }));
  });

  it('предупреждает о замене текущей темы и применяет версию к уроку', async () => {
    const onApplied = vi.fn();
    render(<LessonPreparationActions lessonId={5} lessonTopic="Давление" summary={summary} onApplied={onApplied} />);
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать заготовку урока' }));
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать заготовку' }));
    expect(screen.getByText(/Применение заготовки заменит их/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Заменить тему и конспект' }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith({
      workspaceItemId: 42, version: 2, expectedTargetRevision: 'a'.repeat(64), confirmReplace: true,
    }));
    expect(onApplied).toHaveBeenCalledTimes(1);
  });
});
