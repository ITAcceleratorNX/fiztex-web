import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ToastProvider } from '@/context/ToastContext';
import { HomeworkFormPage } from './HomeworkFormPage';

const create = vi.fn();
const addMaterialFile = vi.fn();
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
      addMaterialFile: (...args: unknown[]) => addMaterialFile(...args),
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
  addMaterialFile.mockReset();
  addMaterialFile.mockResolvedValue({ id: 7 });
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

    await userEvent.click(screen.getByRole('radio', { name: 'До следующего урока' }));

    // Поле даты исчезает: вводить нечего, и пустое поле не блокирует сохранение.
    expect(screen.queryByLabelText('Дата и время сдачи')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ lessonId: 5, dueType: 'NEXT_LESSON' });
    expect(create.mock.calls[0][0].dueAt).toBeUndefined();
  });

  it('точный срок по-прежнему требует дату и отправляет её', async () => {
    renderForm();
    await fillRequiredFields();

    // Пока даты нет, сохранять нечего — кнопка выключена.
    expect(screen.getByRole('button', { name: 'Создать черновик' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Дата и время сдачи'), '2026-10-20T15:00');
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));

    expect(create.mock.calls[0][0]).toMatchObject({ dueType: 'EXACT' });
    expect(create.mock.calls[0][0].dueAt).toBe(new Date('2026-10-20T15:00').toISOString());
  });
  /**
   * Форма создаёт черновик и на этом заканчивается: публиковать здесь нечего — вопросы и
   * текст задания генерируются и проверяются на карточке, и до неё задание классу не уходит.
   */
  it('создание не публикует задание', async () => {
    renderForm();
    await fillRequiredFields();

    expect(screen.queryByRole('button', { name: 'Опубликовать' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'До следующего урока' }));
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    expect(create).toHaveBeenCalledTimes(1);
  });

  /**
   * Материалы прикладываются после создания, и сбой на них черновик уже не отменяет.
   * Повтор «в лоб» завёл бы второе задание — вместо этого форма ведёт в созданное.
   */
  it('сбой на материалах не создаёт второе задание, а ведёт в сохранённый черновик', async () => {
    addMaterialFile.mockRejectedValue(new ApiError(413, 'Файл больше 20 МБ'));
    renderForm();
    await fillRequiredFields();

    // Поле файла скрыто за кнопкой «Прикрепить файл»: userEvent такой input пропускает,
    // поэтому событие отправляем напрямую — проверяется поведение формы, а не клик.
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['x'], 'big.pdf', { type: 'application/pdf' })] },
    });

    await userEvent.click(screen.getByRole('radio', { name: 'До следующего урока' }));
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));

    expect(await screen.findByText(/Черновик создан, но материалы приложить не удалось/))
        .toBeInTheDocument();

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
    await userEvent.click(screen.getByRole('radio', { name: 'Без срока' }));
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

    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));

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
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));

    const payload = create.mock.calls[0][0];
    expect(payload.lessonId).toBeUndefined();
    expect(payload).toMatchObject({ classId: 7, subjectId: 3 });
  });
});
