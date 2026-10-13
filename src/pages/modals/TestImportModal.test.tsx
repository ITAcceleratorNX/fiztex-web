import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { TestImportModal } from './TestImportModal';
import type { Test } from '@/lib/types';
const state = vi.hoisted(() => ({ file: vi.fn(), text: vi.fn() }));
vi.mock('@/hooks/queries', () => ({
  useImportQuestions: () => ({ mutateAsync: state.file, isPending: false }),
  useImportQuestionText: () => ({ mutateAsync: state.text, isPending: false }),
  useGenerationJob: () => ({ data: undefined }), keys: { test: (id: number) => ['test', id], generationJobs: (id: number) => ['jobs', id] },
}));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));
beforeEach(() => { vi.clearAllMocks(); state.text.mockResolvedValue({ id: 7 }); });
it('передаёт вставленный текст отдельным источником с контекстом теста', async () => {
  render(<QueryClientProvider client={new QueryClient()}><TestImportModal open onClose={vi.fn()}
    test={{ id: 42 } as Test} /></QueryClientProvider>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('radio', { name: 'Вставленный текст' }));
  await user.type(screen.getByRole('textbox', { name: /Текст теста/ }), 'Вопрос о реакции воды');
  await user.click(screen.getByRole('button', { name: 'Импортировать' }));
  await waitFor(() => expect(state.text).toHaveBeenCalledWith({ testId: 42, sourceText: 'Вопрос о реакции воды' }));
  expect(state.file).not.toHaveBeenCalled();
});
