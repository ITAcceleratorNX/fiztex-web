import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestTemplateActions } from './TestTemplateActions';

const create = vi.fn();
const apply = vi.fn();

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn() }),
}));
vi.mock('@/components/workspace/WorkspaceMaterialPickerModal', () => ({
  WorkspaceMaterialPickerModal: ({ onConfirm }: { onConfirm: (items: object[]) => void }) =>
    <button onClick={() => onConfirm([{ id: 42, sourceId: '7', sourceKind: 'homework-test-template', title: 'Готовый тест' }])}>Выбрать Готовый тест</button>,
}));
vi.mock('@/hooks/queries', () => ({
  useCreateTestTemplate: () => ({ mutateAsync: create, isPending: false }),
  useApplyTestTemplate: () => ({ mutateAsync: apply, isPending: false }),
  useTestTemplate: () => ({ data: { title: 'Готовый тест', version: 2, definition: { questions: [{ text: 'Вопрос' }] } }, isPending: false, isError: false, refetch: vi.fn() }),
  useTestTemplateTarget: () => ({ data: { questionRevision: 'a'.repeat(64), questionCount: 1 }, isPending: false, isError: false, refetch: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('crypto', { randomUUID: () => 'd4491979-e58d-4ad8-ac11-02bbf6c81e24' });
  create.mockResolvedValue({ id: 7 });
  apply.mockResolvedValue({ questionCount: 1 });
});

describe('TestTemplateActions', () => {
  it('сохраняет вопросы текущего ДЗ как отдельный шаблон', async () => {
    render(<TestTemplateActions homeworkId={5} homeworkTitle="Тест по плотности" questionCount={2} canApply onApplied={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить тест в рабочем пространстве' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({
      body: { sourceHomeworkId: 5, title: 'Тест по плотности' }, key: expect.any(String),
    }));
  });

  it('предупреждает о замене вопросов и применяет выбранную версию', async () => {
    const onApplied = vi.fn();
    render(<TestTemplateActions homeworkId={5} homeworkTitle="Тест по плотности" questionCount={1} canApply onApplied={onApplied} />);
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать готовый тест' }));
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать Готовый тест' }));
    expect(screen.getByText(/заменит их/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Заменить вопросы' }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith({ body: {
      workspaceItemId: 42, version: 2, expectedQuestionRevision: 'a'.repeat(64), confirmReplace: true,
    }, key: expect.any(String) }));
    expect(onApplied).toHaveBeenCalledTimes(1);
  });
});
