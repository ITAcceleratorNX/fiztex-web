import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestTemplateDetailModal } from './TestTemplateDetailModal';

const remove = vi.fn();
const rename = vi.fn();
const dependencies = { activeApplications: 2, homeworkIds: [12, 13], revision: 'revision-1', templateId: 7 };

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('@/hooks/queries', () => ({
  useTestTemplate: () => ({ data: { id: 7, title: 'Готовый тест', version: 1, definition: { questions: [{
    text: 'Первый закон Ньютона', maxScore: 1, options: [{ text: 'Инерция', correct: true }, { text: 'Сила', correct: false }],
  }] } }, isPending: false, isError: false }),
  useTestTemplateDependencies: (id: number | null) => ({ data: id ? dependencies : undefined, isPending: false, isError: false, refetch: vi.fn() }),
  useRenameTestTemplate: () => ({ mutateAsync: rename, isPending: false }),
  useDeleteTestTemplate: () => ({ mutateAsync: remove, isPending: false }),
}));

const item = { id: 42, title: 'Готовый тест', sourceId: '7', sourceKind: 'homework-test-template', type: 'TEST' as const };

beforeEach(() => {
  vi.clearAllMocks();
  remove.mockResolvedValue(undefined);
  rename.mockResolvedValue(undefined);
});

describe('TestTemplateDetailModal', () => {
  it('показывает правильные ответы и предупреждает о применениях перед удалением', async () => {
    const onClose = vi.fn();
    render(<MemoryRouter><TestTemplateDetailModal item={item} origin={{ pathname: '/workspace/sections/TESTS', search: '' }}
      onClose={onClose} onReuse={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Инерция')).toBeInTheDocument();
    expect(screen.getByText('Правильный')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(screen.getByText(/используется в 2 ДЗ/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Удалить тест' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ id: 7, dependencies }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
