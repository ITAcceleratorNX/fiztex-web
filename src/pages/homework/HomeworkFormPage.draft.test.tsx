import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormDraftProvider, FormDraftStore } from '@/context/FormDraftContext';
import { ToastProvider } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import type { HomeworkFormDraft } from '@/lib/homeworkDraft';
import { HomeworkFormPage } from './HomeworkFormPage';
import { HomeworkGroupsPage } from './HomeworkGroupsPage';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), card: vi.fn(), setRecipients: vi.fn(), listGroups: vi.fn(),
  listGroupSets: vi.fn(), addMaterialFile: vi.fn(), subgroupId: undefined as number | undefined,
}));
vi.mock('@/lib/homeworkApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/homeworkApi')>(),
  homeworkApi: { ...mocks, list: async () => ({ content: [] }) },
}));
vi.mock('@/lib/lessonsApi', () => ({ lessonsApi: {
  myWeek: async () => ({ lessons: [{ classId: 7, className: '7А', subjectId: 3, subjectName: 'Математика' }] }),
  list: async () => ({ content: [
    { id: 41, classId: 7, subjectId: 3, date: '2026-10-15', startTime: '08:00' },
    { id: 42, classId: 7, subjectId: 3, date: '2026-10-16', startTime: '09:00' },
  ] }),
} }));
vi.mock('@/hooks/queries', () => ({
  keys: { lesson: (id: number) => ['lesson', id] },
  useLesson: (id: number | null) => ({ data: id ? { id, classId: 7, subjectId: 3,
    className: '7А', subjectName: 'Математика', subgroupId: mocks.subgroupId } : undefined, isPending: false }),
}));

const originalGroup = { id: 10, name: 'Группа А', classId: 7, subjectId: 3, status: 'ACTIVE', studentCount: 2,
  students: [{ studentProfileId: 1, fullName: 'Анна' }, { studentProfileId: 2, fullName: 'Борис' }] };
const originalCard = { id: 8, status: 'DRAFT', title: 'Серверное название', description: 'Серверный текст',
  classId: 7, subjectId: 3, dueType: 'NONE', recipients: { type: 'CLASS', locked: false } };
const clients: QueryClient[] = [];

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  return <nav>
    <output data-testid="url">{location.pathname}{location.search}</output>
    <button onClick={() => navigate(-1)}>Back</button>
    <button onClick={() => navigate(1)}>Forward</button>
    <Link to="/elsewhere">Другой раздел</Link>
    <Link to="/homework/new?lessonId=5">Форма урока 5</Link>
    <Link to="/homework/new?lessonId=6">Форма урока 6</Link>
  </nav>;
}

function renderForm(url = '/homework/new?lessonId=5') {
  const store = new FormDraftStore();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><FormDraftProvider store={store}><ToastProvider>
    <MemoryRouter initialEntries={[url]}>
      <Navigation />
      <Routes>
        <Route path="/homework/new" element={<HomeworkFormPage mode="create" />} />
        <Route path="/homework/:homeworkId/edit" element={<HomeworkFormPage mode="edit" />} />
        <Route path="/homework/groups" element={<HomeworkGroupsPage />} />
        <Route path="*" element={<p>Другой экран</p>} />
      </Routes>
    </MemoryRouter>
  </ToastProvider></FormDraftProvider></QueryClientProvider>);
  return { store, client };
}

const titleInput = () => screen.getByPlaceholderText(/Например: Параграф/);
const descriptionInput = () => screen.getByPlaceholderText(/Подробно опишите|Что за тест/);
async function fillForm() {
  fireEvent.change(titleInput(), { target: { value: 'Мой черновик' } });
  fireEvent.change(descriptionInput(), { target: { value: 'Решить задачи 1–5' } });
  fireEvent.change(screen.getByLabelText('Дата и время сдачи'), { target: { value: '2026-10-20T15:30' } });
}
async function pick(current: string | RegExp, option: string | RegExp) {
  await userEvent.click(await screen.findByRole('button', { name: current }));
  await userEvent.click(screen.getByRole('option', { name: option }));
}
async function pickGroup() {
  await waitFor(() => expect(mocks.listGroups).toHaveBeenCalled());
  await pick('Весь класс', 'Временная группа');
  await userEvent.click(screen.getByLabelText('Временная группа'));
  await userEvent.click(screen.getByRole('option', { name: /Группа А/ }));
}
async function openGroups() {
  await userEvent.click(await screen.findByRole('link', { name: 'Настроить группы' }));
  await screen.findByRole('heading', { name: 'Временные группы' });
}
async function returnFromGroups() {
  await userEvent.click(await screen.findByRole('button', { name: 'Вернуться к заданию' }));
  await screen.findByPlaceholderText(/Например: Параграф/);
}
function unload() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.subgroupId = undefined;
  mocks.create.mockResolvedValue({ id: 99 });
  mocks.update.mockResolvedValue({ id: 8 });
  mocks.card.mockResolvedValue(originalCard);
  mocks.listGroups.mockResolvedValue([originalGroup]);
  mocks.listGroupSets.mockResolvedValue([]);
  mocks.addMaterialFile.mockResolvedValue({ id: 11 });
  mocks.setRecipients.mockResolvedValue({});
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });

describe('homework form drafts', () => {
  it('сохраняет все поля и File после групп, отправляет восстановленные значения и очищает черновик', async () => {
    const { store } = renderForm();
    expect(unload()).toBe(false);
    await fillForm();
    await userEvent.click(screen.getByRole('tab', { name: 'Вопросами теста' }));
    await userEvent.click(screen.getByRole('button', { name: /^Следить за прохождением/ }));
    await pickGroup();
    const file = new File(['tasks'], 'tasks.pdf', { type: 'application/pdf' });
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [file] } });
    await openGroups();
    expect(unload()).toBe(true);
    await returnFromGroups();
    expect(titleInput()).toHaveValue('Мой черновик');
    expect(descriptionInput()).toHaveValue('Решить задачи 1–5');
    expect(screen.getByLabelText('Дата и время сдачи')).toHaveValue('2026-10-20T15:30');
    expect(screen.getByRole('tab', { name: 'Вопросами теста' })).toHaveAttribute('aria-selected', 'true');
    expect(store.get<HomeworkFormDraft>('homework:new:5')?.values.antiCheatEnabled).toBe(true);
    expect(screen.getByText('tasks.pdf')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Создать черновик' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    await waitFor(() => expect(store.hasChanges).toBe(false));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Мой черновик', lessonId: 5,
      answerFormat: 'TEST', antiCheatEnabled: true, recipientType: 'TEMP_GROUP', tempGroupId: 10,
      dueAt: new Date('2026-10-20T15:30').toISOString() }));
    expect(mocks.addMaterialFile).toHaveBeenCalledWith(99, file);
    expect(unload()).toBe(false);
  });

  it.each([true, false])('сохраняет класс, предмет и выбор урока (привязка: %s)', async (attached) => {
    const { store } = renderForm('/homework/new');
    await pick('Выберите предмет', 'Математика');
    await pick('Выберите класс', '7А');
    await screen.findByText(/Привязанное задание видно/);
    const lessonButton = screen.getAllByRole('button').find((element) => /окт/.test(element.textContent ?? ''))!;
    await userEvent.click(lessonButton);
    await userEvent.click(screen.getByRole('option', { name: attached ? /16 окт/ : 'Без привязки к уроку' }));
    await fillForm();
    await openGroups();
    await returnFromGroups();
    expect(screen.getByRole('button', { name: 'Математика' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7А' })).toBeInTheDocument();
    expect(store.get<HomeworkFormDraft>('homework:new:standalone')?.values.pickedLessonId).toBe(attached ? 42 : undefined);
    expect(store.get<HomeworkFormDraft>('homework:new:standalone')?.values.lessonChoiceMade).toBe(true);
  });

  it('Back/Forward и меню сохраняют даже невалидную форму', async () => {
    renderForm();
    fireEvent.change(titleInput(), { target: { value: 'Ещё не готово' } });
    await userEvent.click(screen.getByRole('link', { name: 'Другой раздел' }));
    expect(unload()).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(titleInput()).toHaveValue('Ещё не готово');
    expect(screen.getByRole('button', { name: 'Создать черновик' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Forward' }));
    await userEvent.click(screen.getByRole('link', { name: 'Форма урока 5' }));
    expect(titleInput()).toHaveValue('Ещё не готово');
  });

  it('разделяет формы разных уроков без размонтирования маршрута', async () => {
    renderForm();
    await fillForm();
    await userEvent.click(screen.getByRole('link', { name: 'Форма урока 6' }));
    expect(titleInput()).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(titleInput()).toHaveValue('Мой черновик');
  });

  it('ручной выбор всего класса не заменяется подгруппой урока после возврата', async () => {
    mocks.subgroupId = 12;
    renderForm();
    await pick('Подгруппа урока', 'Весь класс');
    await fillForm();
    await openGroups();
    await returnFromGroups();
    expect(screen.getByRole('button', { name: 'Весь класс' })).toBeInTheDocument();
  });

  it('повторная загрузка редактируемого задания не стирает изменённый текст', async () => {
    renderForm('/homework/8/edit');
    await screen.findByDisplayValue('Серверное название');
    fireEvent.change(titleInput(), { target: { value: 'Изменено учителем' } });
    await openGroups();
    mocks.card.mockResolvedValue({ ...originalCard, title: 'Другой серверный текст' });
    await returnFromGroups();
    expect(titleInput()).toHaveValue('Изменено учителем');
    expect(screen.getByTestId('url')).toHaveTextContent('/homework/8/edit');
  });

  it('нетронутая форма при возврате получает свежие серверные значения', async () => {
    renderForm('/homework/8/edit');
    await screen.findByDisplayValue('Серверное название');
    expect(unload()).toBe(false);
    await openGroups();
    mocks.card.mockResolvedValue({ ...originalCard, title: 'Обновлено на сервере' });
    await returnFromGroups();
    await screen.findByDisplayValue('Обновлено на сервере');
    expect(unload()).toBe(false);
  });

  it('после появления ответов восстанавливает закрытый состав, сохраняя правку текста', async () => {
    renderForm('/homework/8/edit');
    await screen.findByDisplayValue('Серверное название');
    fireEvent.change(titleInput(), { target: { value: 'Новый текст' } });
    await pickGroup();
    await openGroups();
    mocks.card.mockResolvedValue({ ...originalCard, hasAnswers: true, recipients: { type: 'CLASS', locked: true } });
    await returnFromGroups();
    await screen.findByText(/По заданию появились ответы/);
    expect(titleInput()).toHaveValue('Новый текст');
    expect(screen.getByRole('button', { name: 'Весь класс' })).toBeDisabled();
  });

  it.each(['removed', 'ARCHIVED'])('убирает только недоступную группу (%s), оставляет форму', async (status) => {
    renderForm();
    await fillForm();
    await pickGroup();
    await openGroups();
    mocks.listGroups.mockResolvedValue(status === 'removed' ? [] : [{ ...originalGroup, status }]);
    await returnFromGroups();
    await screen.findByText(/Группа «Группа А» больше недоступна/);
    expect(titleInput()).toHaveValue('Мой черновик');
    expect(screen.getByLabelText('Временная группа')).toHaveTextContent('Выберите группу');
    expect(screen.getByRole('button', { name: 'Создать черновик' })).toBeDisabled();
  });

  it('объясняет переименование и замену ученика при неизменном количестве', async () => {
    renderForm();
    await fillForm();
    await pickGroup();
    await openGroups();
    mocks.listGroups.mockResolvedValue([{ ...originalGroup, name: 'Новая группа', students: [
      { studentProfileId: 1, fullName: 'Анна' }, { studentProfileId: 3, fullName: 'Вера' },
    ] }]);
    await returnFromGroups();
    await screen.findByText(/Добавлены: Вера. Исключены: Борис/);
    expect(screen.getByLabelText('Временная группа')).toHaveTextContent('Новая группа · 2 уч.');
    expect(titleInput()).toHaveValue('Мой черновик');
  });

  it('ошибка проверки группы не стирает выбор и позволяет повторить проверку', async () => {
    renderForm();
    await fillForm();
    await pickGroup();
    await openGroups();
    mocks.listGroups.mockRejectedValue(new Error('offline'));
    await returnFromGroups();
    await screen.findByText(/Не удалось проверить группы/);
    expect(screen.getByLabelText('Временная группа')).toHaveTextContent('Группа А · 2 уч.');
    expect(screen.getByRole('button', { name: 'Создать черновик' })).toBeDisabled();
    mocks.listGroups.mockResolvedValue([originalGroup]);
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Создать черновик' })).toBeEnabled());
  });

  it('сбой сохранения сохраняет текст и после перехода в другой раздел', async () => {
    mocks.create.mockRejectedValue(new ApiError(503, 'Сервис временно недоступен'));
    renderForm();
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    await screen.findByText(/Сервис временно недоступен/);
    await userEvent.click(screen.getByRole('link', { name: 'Другой раздел' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(titleInput()).toHaveValue('Мой черновик');
    expect(unload()).toBe(true);
  });

  it('частичный успех не позволяет создать дубль после возврата', async () => {
    mocks.addMaterialFile.mockRejectedValue(new ApiError(413, 'Слишком большой файл'));
    renderForm();
    await fillForm();
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'big.pdf')] } });
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    await screen.findByRole('button', { name: 'Открыть черновик' });
    await openGroups();
    await returnFromGroups();
    expect(screen.queryByRole('button', { name: 'Создать черновик' })).not.toBeInTheDocument();
    expect(screen.getByText('big.pdf')).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it('отмена удаления сохраняет текст и возвращает фокус; подтверждение очищает черновик', async () => {
    const { store } = renderForm();
    await fillForm();
    const trigger = screen.getByRole('button', { name: 'Удалить локальный черновик' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить редактирование' }));
    expect(titleInput()).toHaveValue('Мой черновик');
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Удалить изменения' }));
    expect(store.hasChanges).toBe(false);
    expect(unload()).toBe(false);
  });

  it('позднее сохранение не уводит пользователя из другого раздела', async () => {
    let resolve!: (value: { id: number }) => void;
    mocks.create.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { store } = renderForm();
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    await userEvent.click(screen.getByRole('link', { name: 'Другой раздел' }));
    await act(async () => resolve({ id: 99 }));
    await waitFor(() => expect(store.hasChanges).toBe(false));
    expect(screen.getByTestId('url')).toHaveTextContent('/elsewhere');
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});
