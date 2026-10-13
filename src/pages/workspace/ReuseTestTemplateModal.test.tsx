import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReuseTestTemplateModal } from './ReuseTestTemplateModal';

const apply = vi.fn();
const homework = vi.fn();

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('@/hooks/queries', () => ({
  useTestTemplate: () => ({ data: { version: 2, subjectId: 8, definition: { questions: [{ text: 'Вопрос' }] } }, isPending: false, isError: false }),
  useHomeworkList: (...args: unknown[]) => homework(...args),
  useTestTemplateTarget: (id: number | null) => ({ data: id ? { questionRevision: 'a'.repeat(64), questionCount: 2 } : undefined,
    isPending: false, isError: false, refetch: vi.fn() }),
  useApplyTestTemplate: () => ({ mutateAsync: apply, isPending: false }),
}));

const item = { id: 42, title: 'Готовый тест', sourceId: '7', sourceKind: 'homework-test-template',
  type: 'TEST' as const, supportedActions: ['APPLY_TEST_TO_HOMEWORK' as const] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('crypto', { randomUUID: () => 'd4491979-e58d-4ad8-ac11-02bbf6c81e24' });
  apply.mockResolvedValue({ questionCount: 1 });
  homework.mockReturnValue({ data: { content: [
    { id: 4, subjectId: 8, title: 'Обычное ДЗ', answerFormat: 'WRITTEN', status: 'DRAFT' },
    { id: 5, subjectId: 8, title: 'Тестовое ДЗ', answerFormat: 'TEST', status: 'DRAFT', hasAnswers: false },
    { id: 6, subjectId: 9, title: 'ДЗ другого предмета', answerFormat: 'TEST', status: 'DRAFT' },
  ], totalPages: 1 }, isPending: false, isError: false });
});

describe('ReuseTestTemplateModal', () => {
  it('не выбирает обычное ДЗ и подтверждает замену вопросов в тестовом', async () => {
    const onClose = vi.fn();
    render(<ReuseTestTemplateModal item={item} onClose={onClose} />);
    expect(screen.queryByText('ДЗ другого предмета')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Обычное ДЗ/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Тестовое ДЗ/ }));
    expect(screen.getByText(/Применение теста заменит их/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Заменить вопросы' }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith({ body: {
      workspaceItemId: 42, version: 2, expectedQuestionRevision: 'a'.repeat(64), confirmReplace: true,
    }, key: expect.any(String) }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
