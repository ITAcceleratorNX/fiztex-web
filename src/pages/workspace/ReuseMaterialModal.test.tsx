import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReuseMaterialModal } from './ReuseMaterialModal';

const attach = vi.fn();

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/hooks/queries', () => ({
  useWorkspaceLessonTargets: () => ({ data: { content: [{ id: 18, subjectName: 'Физика', className: '8А',
    date: '2026-10-08', academicPeriodStatus: 'ACTIVE', capabilities: ['EDIT_TEACHING_PART'] }], totalPages: 1 },
  isPending: false, isError: false }),
  useHomeworkList: () => ({ data: { content: [] }, isPending: false, isError: false }),
  useAttachWorkspaceDocumentToHomework: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAttachWorkspaceDocumentToLesson: () => ({ mutateAsync: attach, isPending: false }),
}));

const item = { id: 17, title: 'Материал', type: 'DOCUMENT' as const,
  supportedActions: ['ATTACH_DOCUMENT_TO_LESSON' as const] };

beforeEach(() => {
  vi.clearAllMocks();
  attach.mockResolvedValue({ id: 1 });
});

describe('ReuseMaterialModal', () => {
  it('добавляет материал к выбранному уроку, а не только к текущему', async () => {
    const onClose = vi.fn();
    render(<ReuseMaterialModal item={item} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Урок' }));
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Физика · 8А/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    await waitFor(() => expect(attach).toHaveBeenCalledWith({ lessonId: 18, itemId: 17, visibleToStudents: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
