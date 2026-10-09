import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { TestAiJob } from '@/lib/testTemplateApi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { WorkspaceTestEditorPage } from './WorkspaceTestEditorPage';

const uploadImage = vi.fn();
const create = vi.fn();
const version = vi.fn();
const template = vi.fn();
const subjectContext = vi.fn();

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('./GenerateWorkspaceTestModal', () => ({
  GenerateWorkspaceTestModal: ({ onUse, onClose }: { onUse: (job: TestAiJob) => void; onClose: () => void }) =>
    <button onClick={() => { onUse({ id: 19, subjectId: 1, request: { topic: 'Плотность', questionCount: 1, openQuestionCount: 1 }, result: { questions: [
      { type: 'OPEN_TEXT', text: 'Вопрос от ИИ', maxScore: 1, referenceAnswer: 'Ответ', aiGenerated: true },
    ] } }); onClose(); }}>Использовать вопросы</button>,
}));
vi.mock('@/hooks/queries', () => ({
  useUploadHomeworkQuestionImage: () => ({ mutateAsync: uploadImage, isPending: false }),
  useTestTemplate: (...args: unknown[]) => template(...args),
  useTestSubjectContext: () => subjectContext(),
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
  uploadImage.mockResolvedValue({ imageId: 'image-1', imageUrl: 'http://localhost/figure.png' });
  create.mockResolvedValue({ id: 7, version: 1 });
  version.mockResolvedValue({ id: 7, version: 2 });
  template.mockReturnValue({ data: undefined, isPending: false, isError: false, refetch: vi.fn() });
  subjectContext.mockReturnValue({data:{subjects:[{id:1,name:'Физика',formulaProfile:'PHYSICS'}],defaultSubjectId:1},isPending:false,isError:false});
});

describe('WorkspaceTestEditorPage', () => {
  it('сохраняет загруженный рисунок в новой версии без временного URL', async () => {
    const user = userEvent.setup();
    template.mockReturnValue({ data: { id: 7, title: 'Схемы', version: 1, subjectId: 1, definition: { questions: [
      { type: 'OPEN_TEXT', text: 'Рассмотрите схему', maxScore: 1, imageId: 'old', imageUrl: 'http://localhost/old.png' },
    ] } }, isPending: false, isError: false });
    renderEditor('/workspace/tests/7/edit');
    const file = new File(['png'], 'figure.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Файл рисунка к вопросу'), file);
    await waitFor(() => expect(screen.getByAltText('Рисунок к вопросу')).toHaveAttribute('src', 'http://localhost/figure.png'));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(version).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({
      expectedVersion: 1, questions: [expect.objectContaining({ imageId: 'image-1' })],
    }) }));
    expect(JSON.stringify(version.mock.calls[0])).not.toContain('imageUrl');
  });

  it('снятый рисунок исчезает из запроса, ошибка загрузки оставляет прежний', async () => {
    const user = userEvent.setup();
    template.mockReturnValue({ data: { id: 7, title: 'Схемы', version: 1, subjectId: 1, definition: { questions: [
      { type: 'OPEN_TEXT', text: 'Рассмотрите схему', maxScore: 1, imageId: 'old', imageUrl: 'http://localhost/old.png' },
    ] } }, isPending: false, isError: false });
    uploadImage.mockRejectedValue(new Error('network'));
    renderEditor('/workspace/tests/7/edit');
    await user.upload(screen.getByLabelText('Файл рисунка к вопросу'), new File(['png'], 'figure.png', { type: 'image/png' }));
    await screen.findByRole('alert');
    expect(screen.getByAltText('Рисунок к вопросу')).toHaveAttribute('src', 'http://localhost/old.png');
    await user.click(screen.getByRole('button', { name: 'Удалить рисунок' }));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(version.mock.calls[0][0].body.questions[0]).not.toHaveProperty('imageId');
  });

  it('требует выбор при нескольких предметах и блокирует создание без назначений', async () => {
    subjectContext.mockReturnValue({data:{subjects:[{id:1,name:'Физика'},{id:2,name:'Химия'}]},isPending:false,isError:false});
    const user = userEvent.setup();
    renderEditor('/workspace/tests/new');
    const select = screen.getByRole('button', {name:'Предмет теста'});
    expect(select).toHaveTextContent('Выберите предмет');
    expect(screen.getByRole('button', {name:'Сгенерировать с ИИ'})).toBeDisabled();
    await user.click(select);
    await user.click(screen.getByRole('option', {name:'Химия'}));
    expect(select).toHaveTextContent('Химия');
    expect(screen.getByRole('button', {name:'Сгенерировать с ИИ'})).toBeEnabled();
  });

  it('объясняет отсутствие назначений и оставляет создание недоступным', () => {
    subjectContext.mockReturnValue({data:{subjects:[]},isPending:false,isError:false});
    renderEditor('/workspace/tests/new');
    expect(screen.getByRole('status')).toHaveTextContent('Нет доступных предметов');
    expect(screen.getByRole('button', {name:'Сохранить'})).toBeDisabled();
    expect(screen.getByRole('button', {name:'Сгенерировать с ИИ'})).toBeDisabled();
  });
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
      title: 'Законы Ньютона', subjectId: 1, questions: [expect.objectContaining({
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
      expectedVersion: 3, title: 'Механика', subjectId: 1, questions: [expect.objectContaining({ text: 'Новый вопрос' })],
    }, key: expect.any(String) }));
  });

  it('при конфликте версий требует загрузить актуальные вопросы', async () => {
    const oldQuestion = { type: 'SINGLE_CHOICE', text: 'Старый вопрос', maxScore: 1,
      options: [{ text: 'Да', correct: true }, { text: 'Нет', correct: false }] };
    const refetch = vi.fn().mockResolvedValue({ data: { title: 'Механика', version: 4,
      definition: { questions: [{ ...oldQuestion, text: 'Правка другого учителя' }] } } });
    template.mockReturnValue({ data: { title: 'Механика', version: 3, definition: { questions: [oldQuestion] } },
      isPending: false, isError: false, refetch });
    version.mockRejectedValue(new ApiError(409, 'У теста уже есть новая версия', 'HOMEWORK_TEST_VERSION_CHANGED'));
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

  it.each(['create', 'edit'] as const)('позволяет исправить химическую запись после отказа сервера (%s)', async (mode) => {
    const chemicalText = 'Сравните $\\ce{CO}$ и $\\ce{Co}$';
    const question = { type: 'OPEN_TEXT', text: chemicalText, maxScore: 1, imageId: 'old', imageUrl: 'http://localhost/old.png' };
    template.mockReturnValue({ data: { title: 'Химия', version: 3, subjectId: 1, definition: { questions: [question] } },
      isPending: false, isError: false, refetch: vi.fn() });
    const save = mode === 'create' ? create : version;
    save.mockRejectedValueOnce(new ApiError(409, 'Запись химических формул пока отключена', 'CHEMISTRY_AUTHORING_DISABLED'));
    const user = userEvent.setup();
    renderEditor(mode === 'create' ? '/workspace/tests/new' : '/workspace/tests/7/edit');
    if (mode === 'create') {
      await user.type(screen.getByRole('textbox', { name: 'Название теста' }), 'Химия');
      await user.click(screen.getByRole('button', { name: 'Добавить вопрос' }));
      await user.click(screen.getByRole('textbox', { name: 'Текст вопроса 1' }));
      await user.paste(chemicalText);
      await user.type(screen.getByRole('textbox', { name: 'Вариант 1' }), 'CO');
      await user.type(screen.getByRole('textbox', { name: 'Вариант 2' }), 'Co');
    } else {
      await user.type(screen.getByRole('textbox', { name: 'Название теста' }), ' — правка');
    }
    // KaTeX MathML trips jsdom's accessible-name calculation for formula buttons.
    // Find the save control by its text; rendering is verified in MathText tests and the browser.
    const saveButton = screen.getByText('Сохранить', { exact: true }).closest('button')!;
    await user.click(saveButton);
    expect(await screen.findByRole('alert')).toHaveTextContent('Запись химических формул пока отключена');
    expect(screen.queryByText('Загрузить актуальную версию')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Текст вопроса 1' })).toHaveValue(chemicalText);
    expect(saveButton).toBeEnabled();
    if (mode === 'edit') expect(screen.getByAltText('Рисунок к вопросу')).toHaveAttribute('src', question.imageUrl);
    await user.clear(screen.getByRole('textbox', { name: 'Текст вопроса 1' }));
    await user.type(screen.getByRole('textbox', { name: 'Текст вопроса 1' }), 'Вычислите $2+2$');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(saveButton);
    expect(await screen.findByText('Раздел тестов')).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].body.questions[0].text).toBe('Вычислите $2+2$');
    if (mode === 'edit') expect(save.mock.calls[1][0].body.questions[0].imageId).toBe('old');
  });

  it('переносит вопросы ИИ в черновик и сохраняет происхождение при явном сохранении', async () => {
    const user = userEvent.setup();
    renderEditor('/workspace/tests/new');
    await user.click(screen.getByRole('button', { name: 'Сгенерировать с ИИ' }));
    await user.click(screen.getByRole('button', { name: 'Использовать вопросы' }));
    expect(screen.getByRole('textbox', { name: 'Название теста' })).toHaveValue('Плотность');
    expect(screen.getByRole('textbox', { name: 'Текст вопроса 1' })).toHaveValue('Вопрос от ИИ');
    expect(create).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ body: expect.objectContaining({ aiJobId: 19, title: 'Плотность' }), key: expect.any(String) }));
  });

  it('сохраняет ручные вопросы до подтверждения замены и позволяет отказаться', async () => {
    const user = userEvent.setup();
    renderEditor('/workspace/tests/new');
    await user.click(screen.getByRole('button', { name: 'Добавить вопрос' }));
    await user.type(screen.getByRole('textbox', { name: 'Текст вопроса 1' }), 'Мой вопрос');
    await user.click(screen.getByRole('button', { name: 'Сгенерировать с ИИ' }));
    await user.click(screen.getByRole('button', { name: 'Использовать вопросы' }));
    expect(screen.getByText('Заменить вопросы теста?')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Текст вопроса 1', hidden: true })).toHaveValue('Мой вопрос');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отмена' }));
    expect(screen.getByRole('textbox', { name: 'Текст вопроса 1' })).toHaveValue('Мой вопрос');
    await user.click(screen.getByRole('button', { name: 'Сгенерировать с ИИ' }));
    await user.click(screen.getByRole('button', { name: 'Использовать вопросы' }));
    await user.click(screen.getByRole('button', { name: 'Заменить вопросы' }));
    expect(screen.getByRole('textbox', { name: 'Текст вопроса 1' })).toHaveValue('Вопрос от ИИ');
  });

  it('не подменяет базовую версию черновика после фонового обновления', async () => {
    const data = { title: 'Механика', version: 3, definition: { questions: [
      { type: 'OPEN_TEXT', text: 'Мой вопрос', maxScore: 1 },
    ] } };
    template.mockReturnValue({ data, isPending: false, isError: false });
    const user = userEvent.setup();
    renderEditor('/workspace/tests/7/edit');
    await screen.findByRole('textbox', { name: 'Текст вопроса 1' });
    data.version = 4;
    await user.type(screen.getByRole('textbox', { name: 'Название теста' }), ' — правка');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(version).toHaveBeenCalledWith({ body: expect.objectContaining({
      expectedVersion: 3, title: 'Механика — правка',
    }), key: expect.any(String) }));
  });

  it('запрашивает подтверждение ухода по навигационной цепочке при несохранённых правках', async () => {
    const user = userEvent.setup();
    renderEditor('/workspace/tests/new');
    await user.type(screen.getByRole('textbox', { name: 'Название теста' }), 'Механика');
    await user.click(screen.getByRole('link', { name: 'Тесты' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Уйти без сохранения?');
    expect(screen.queryByText('Раздел тестов')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Уйти' }));
    expect(await screen.findByText('Раздел тестов')).toBeInTheDocument();
  });

  it('показывает ошибку загрузки редактируемого теста', () => {
    template.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch: vi.fn() });
    renderEditor('/workspace/tests/7/edit');
    expect(screen.getByText('Не удалось загрузить данные')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
