import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { WorkspaceTestEditorPage } from './WorkspaceTestEditorPage';

const create = vi.fn();
const version = vi.fn();
const template = vi.fn();

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn() }),
}));
vi.mock('@/hooks/queries', () => ({
  useTestTemplate: (...args: unknown[]) => template(...args),
  useCreateTestTemplateFromQuestions: () => ({ mutateAsync: create, isPending: false }),
  useVersionTestTemplateFromQuestions: () => ({ mutateAsync: version, isPending: false }),
}));

function renderEditor(path: string) {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/workspace/tests/new" element={<WorkspaceTestEditorPage mode="create" />} />
    <Route path="/workspace/tests/:templateId/edit" element={<WorkspaceTestEditorPage mode="edit" />} />
    <Route path="/workspace/sections/TESTS" element={<div>Раздел тестов</div>} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('crypto', { randomUUID: () => 'd4491979-e58d-4ad8-ac11-02bbf6c81e24' });
  create.mockResolvedValue({ id: 7, version: 1 });
  version.mockResolvedValue({ id: 7, version: 2 });
  template.mockReturnValue({ data: undefined, isPending: false, isError: false, refetch: vi.fn() });
});

describe('WorkspaceTestEditorPage', () => {
  it('создаёт тест без исходного ДЗ и отправляет вопросы', async () => {
    const user = userEvent.setup();
    renderEditor('/workspace/tests/new');
    expect(screen.getByText('Вопросов пока нет')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Название теста' }), 'Законы Ньютона');
    await user.click(screen.getByRole('button', { name: 'Добавить вопрос' }));
    await user.type(screen.getByRole('textbox', { name: 'Текст вопроса 1' }), 'Первый закон Ньютона?');
    await user.type(screen.getByRole('textbox', { name: 'Вариант 1' }), 'Верный ответ');
    await user.type(screen.getByRole('textbox', { name: 'Вариант 2' }), 'Неверный ответ');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ body: {
      title: 'Законы Ньютона', questions: [expect.objectContaining({
        type: 'SINGLE_CHOICE', text: 'Первый закон Ньютона?', options: [
          { text: 'Верный ответ', correct: true }, { text: 'Неверный ответ', correct: false },
        ],
      })],
    }, key: expect.any(String) }));
    expect(await screen.findByText('Раздел тестов')).toBeInTheDocument();
  });

  it('сохраняет правку как следующую версию теста', async () => {
    template.mockReturnValue({ data: { id: 7, title: 'Механика', version: 3, definition: { questions: [{
      type: 'SINGLE_CHOICE', text: 'Старый вопрос', maxScore: 1, options: [
        { text: 'Да', correct: true }, { text: 'Нет', correct: false },
      ],
    }] } }, isPending: false, isError: false, refetch: vi.fn() });
    const user = userEvent.setup();
    renderEditor('/workspace/tests/7/edit');
    await user.clear(await screen.findByRole('textbox', { name: 'Текст вопроса 1' }));
    await user.type(screen.getByRole('textbox', { name: 'Текст вопроса 1' }), 'Новый вопрос');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(version).toHaveBeenCalledWith({ body: {
      expectedVersion: 3, questions: [expect.objectContaining({ text: 'Новый вопрос' })],
    }, key: expect.any(String) }));
  });

  it('при конфликте версий требует загрузить актуальные вопросы', async () => {
    const oldQuestion = { type: 'SINGLE_CHOICE', text: 'Старый вопрос', maxScore: 1,
      options: [{ text: 'Да', correct: true }, { text: 'Нет', correct: false }] };
    const refetch = vi.fn().mockResolvedValue({ data: { title: 'Механика', version: 4,
      definition: { questions: [{ ...oldQuestion, text: 'Правка другого учителя' }] } } });
    template.mockReturnValue({ data: { title: 'Механика', version: 3, definition: { questions: [oldQuestion] } },
      isPending: false, isError: false, refetch });
    version.mockRejectedValue(new ApiError(409, 'У теста уже есть новая версия'));
    const user = userEvent.setup();
    renderEditor('/workspace/tests/7/edit');
    await user.clear(await screen.findByRole('textbox', { name: 'Текст вопроса 1' }));
    await user.type(screen.getByRole('textbox', { name: 'Текст вопроса 1' }), 'Моя правка');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByRole('button', { name: 'Загрузить актуальную версию' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Загрузить актуальную версию' }));
    expect(await screen.findByRole('textbox', { name: 'Текст вопроса 1' })).toHaveValue('Правка другого учителя');
  });

  it('показывает ошибку загрузки редактируемого теста', () => {
    template.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch: vi.fn() });
    renderEditor('/workspace/tests/7/edit');
    expect(screen.getByText('Не удалось загрузить данные')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
