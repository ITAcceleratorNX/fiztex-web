import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ToastProvider } from '@/context/ToastContext';
import { HomeworkFormPage } from './HomeworkFormPage';

const create = vi.fn();
const publish = vi.fn();
const listGroups = vi.fn();
const listHomework = vi.fn();
const useLesson = vi.fn();
const listLessons = vi.fn();
const myWeek = vi.fn();

vi.mock('@/lib/homeworkApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/homeworkApi')>();
  return {
    ...actual,
    homeworkApi: {
      create: (...args: unknown[]) => create(...args),
      publish: (...args: unknown[]) => publish(...args),
      listGroups: (...args: unknown[]) => listGroups(...args),
      list: (...args: unknown[]) => listHomework(...args),
    },
  };
});

vi.mock('@/lib/lessonsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/lessonsApi')>();
  return {
    ...actual,
    lessonsApi: {
      list: (...args: unknown[]) => listLessons(...args),
      myWeek: (...args: unknown[]) => myWeek(...args),
    },
  };
});

vi.mock('@/hooks/queries', () => ({
  useLesson: (...args: unknown[]) => useLesson(...args),
}));

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/homework/new?lessonId=5']}>
          <Routes>
            <Route path="/homework/new" element={<HomeworkFormPage mode="create" />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Форма из раздела «Домашние задания»: урока в адресе нет, контекст выбирается руками. */
function renderStandaloneForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/homework/new']}>
          <Routes>
            <Route path="/homework/new" element={<HomeworkFormPage mode="create" />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function fillRequiredFields() {
  await userEvent.type(screen.getByPlaceholderText(/Например: Параграф 12/), 'Параграф 12');
  await userEvent.type(screen.getByPlaceholderText(/Подробно опишите задание/), 'Решить 1–5');
}

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({ id: 42 });
  publish.mockReset();
  publish.mockResolvedValue({ id: 42, status: 'PUBLISHED' });
  listGroups.mockReset();
  listGroups.mockResolvedValue([]);
  listHomework.mockReset();
  listHomework.mockResolvedValue({ content: [] });
  listLessons.mockReset();
  listLessons.mockResolvedValue({ content: [] });
  myWeek.mockReset();
  myWeek.mockResolvedValue({
    lessons: [{ classId: 7, className: '7А', subjectId: 3, subjectName: 'Математика' }],
  });
  useLesson.mockReset();
  useLesson.mockReturnValue({
    data: { id: 5, classId: 7, subjectId: 3, className: '7А', subjectName: 'Математика', date: '2026-10-15' },
    isPending: false,
    isError: false,
  });
});

describe('HomeworkFormPage — срок сдачи', () => {
  /**
   * ТЗ HOMEWORK-001 §9: «до следующего урока» — такой же срок, как дата, только момент по
   * нему считает бэкенд при публикации. Поэтому дата с фронта не уходит вовсе.
   */
  it('«до следующего урока» уходит без даты и не требует её вводить', async () => {
    renderForm();
    await fillRequiredFields();

    await userEvent.click(screen.getByRole('button', { name: 'До следующего урока' }));

    // Поле даты исчезает: вводить нечего, и пустое поле не блокирует публикацию.
    expect(screen.queryByLabelText('Срок сдачи')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ lessonId: 5, dueType: 'NEXT_LESSON' });
    expect(create.mock.calls[0][0].dueAt).toBeUndefined();
    expect(publish).toHaveBeenCalledWith(42);
  });

  it('точный срок по-прежнему требует дату и отправляет её', async () => {
    renderForm();
    await fillRequiredFields();

    // Пока даты нет, публиковать нечего — кнопка выключена.
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Срок сдачи'), '2026-10-20T15:00');
    await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));

    expect(create.mock.calls[0][0]).toMatchObject({ dueType: 'EXACT' });
    expect(create.mock.calls[0][0].dueAt).toBe(new Date('2026-10-20T15:00').toISOString());
  });
  /**
   * Публикация «до следующего урока» падает, если урока впереди нет: момент считает сервер,
   * и заранее фронт этого не знает. Черновик при этом уже создан — второго быть не должно.
   */
  it('неудачная публикация не создаёт второе задание, а ведёт в сохранённый черновик', async () => {
    publish.mockRejectedValue(
      new ApiError(400, 'Следующий урок по предмету не найден — выберите точную дату или вариант без срока'),
    );
    renderForm();
    await fillRequiredFields();

    await userEvent.click(screen.getByRole('button', { name: 'До следующего урока' }));
    await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));

    const notice = await screen.findByText(/Черновик сохранён, но опубликовать не удалось/);
    expect(notice).toBeInTheDocument();
    expect(screen.getByText(/Следующий урок по предмету не найден/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Открыть черновик' }));
    expect(create).toHaveBeenCalledTimes(1);
  });
});

/**
 * Привязка к уроку из раздела «Домашние задания» (иначе она была только у входа с карточки
 * урока, и задание из раздела не показывалось на уроке ни у учителя, ни у ученика).
 */
describe('HomeworkFormPage — привязка к уроку', () => {
  const lesson = (over: Record<string, unknown> = {}) => ({
    id: 41,
    date: '2026-08-24',
    startTime: '08:00:00',
    startsAt: '2026-08-24T03:00:00Z',
    classId: 7,
    subjectId: 3,
    subjectName: 'Математика',
    className: '7А',
    ...over,
  });

  /** Поля формы — кастомный listbox, а не <select>: открыть триггер и выбрать опцию. */
  async function pick(fieldLabel: string, optionName: string | RegExp) {
    const field = screen.getByText(fieldLabel).closest('div') as HTMLElement;
    await userEvent.click(within(field).getByRole('button'));
    await userEvent.click(screen.getByRole('option', { name: optionName }));
  }

  /** Срок не про этот сценарий: берём «без срока», чтобы не заполнять дату. */
  async function chooseNoDueDate() {
    await userEvent.click(screen.getByRole('button', { name: 'Без срока' }));
  }

  async function chooseClassAndSubject() {
    await userEvent.click(await screen.findByRole('button', { name: 'Выберите предмет' }));
    await userEvent.click(screen.getByRole('option', { name: 'Математика' }));
    await userEvent.click(screen.getByRole('button', { name: 'Выберите класс' }));
    await userEvent.click(screen.getByRole('option', { name: '7А' }));
  }

  it('подставляет ближайший урок и шлёт его вместо класса с предметом', async () => {
    listLessons.mockResolvedValue({
      content: [
        // Урок через неделю после ближайшего — предвыбор должен взять не его.
        lesson({ id: 40, date: '2036-08-31', startsAt: '2036-08-31T03:00:00Z' }),
        lesson(),
        // Урок другого предмета в том же классе в выбор не попадает.
        lesson({ id: 42, subjectId: 9, subjectName: 'Физика' }),
      ],
    });
    renderStandaloneForm();
    await fillRequiredFields();
    await chooseNoDueDate();
    await chooseClassAndSubject();

    // Список уроков подгрузился: подсказка про привязку появляется только с уроками.
    await screen.findByText(/Привязанное задание видно на карточке урока/);

    await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));

    const payload = create.mock.calls[0][0];
    expect(payload.lessonId).toBe(41);
    // Класс и предмет бэкенд берёт из урока — слать их рядом значило бы спорить с ним.
    expect(payload.classId).toBeUndefined();
    expect(payload.subjectId).toBeUndefined();
    // Отбор по предмету: урок физики того же класса в выдачу не попал.
    expect(listLessons.mock.calls[0][0]).toMatchObject({ classId: 7, status: 'ACTIVE' });
  });

  it('«без привязки» оставляет задание на классе и предмете', async () => {
    listLessons.mockResolvedValue({ content: [lesson()] });
    renderStandaloneForm();
    await fillRequiredFields();
    await chooseNoDueDate();
    await chooseClassAndSubject();
    await screen.findByText(/Привязанное задание видно на карточке урока/);

    await pick('Урок', 'Без привязки к уроку');
    await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));

    const payload = create.mock.calls[0][0];
    expect(payload.lessonId).toBeUndefined();
    expect(payload).toMatchObject({ classId: 7, subjectId: 3 });
  });
});
