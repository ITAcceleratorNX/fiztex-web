import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KspPage } from './KspPage';

const useKspContext = vi.fn();
const useKspDocument = vi.fn();
const useKspJob = vi.fn();
const start = vi.fn();
const save = vi.fn();
const dismiss = vi.fn();

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('@/hooks/queries', () => ({
  keys: {
    kspContext: (id: number) => ['lessons', id, 'ksp', 'context'],
    kspDocument: (id: number) => ['lessons', id, 'ksp', 'document'],
  },
  useKspContext: (...args: unknown[]) => useKspContext(...args),
  useKspDocument: (...args: unknown[]) => useKspDocument(...args),
  useKspJob: (...args: unknown[]) => useKspJob(...args),
  useLesson: () => ({ data: { id: 6, startTime: '08:00:00', endTime: '08:45:00' } }),
  useKspCommands: () => ({
    start: { mutateAsync: start, isPending: false },
    save: { mutateAsync: save, isPending: false },
    dismiss: { mutateAsync: dismiss, isPending: false },
    exportFile: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

const ktp = { section: 'Раздел 2. Обыкновенные дроби', topic: 'Умножение дробей', learningObjectives: '5.1.2.4 умножать дроби' };

function context(overrides: Record<string, unknown> = {}) {
  return {
    lessonId: 6, lessonDate: '2026-11-13', className: '5А', subjectName: 'Математика', durationMinutes: 45,
    organizationName: 'Школа-гимназия', teacherName: 'Марина Демо', ktp, topicMismatch: false,
    missingFields: [], canEdit: true, generationEnabled: true, ksp: { exists: false },
    entryState: 'NOT_CREATED', defaultLanguage: 'ru',
    hints: [{ id: 'GROUP_WORK', label: 'Групповая работа' }],
    ...overrides,
  };
}

const result = {
  language: 'ru', organizationName: 'Школа-гимназия', section: ktp.section, teacherName: 'Марина Демо',
  lessonDate: '2026-11-13', className: '5А', topic: ktp.topic, learningObjectives: ktp.learningObjectives,
  lessonObjectives: 'Научиться умножать дроби',
  stages: [
    { stage: 'Начало', durationMinutes: 10, teacherActions: 'А', studentActions: 'Б', assessment: 'В', resources: 'Г' },
    { stage: 'Конец', durationMinutes: 35, teacherActions: 'Д', studentActions: 'Е', assessment: 'Ж', resources: 'З' },
  ],
};

function renderPage() {
  const router = createMemoryRouter(
    [{ path: '/lesson-schedule/lessons/:lessonId/ksp', element: <KspPage /> }],
    { initialEntries: ['/lesson-schedule/lessons/6/ksp'] },
  );
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('KspPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useKspContext.mockReturnValue({ data: context(), isError: false });
    useKspDocument.mockReturnValue({ data: { exists: false, canEdit: true }, isError: false });
    useKspJob.mockReturnValue({ data: undefined, isError: false });
    start.mockResolvedValue({ id: 41, status: 'PENDING' });
  });

  it('с КТП ничего вводить не надо: генерация уходит с данными КТП, подсказками и пустой посещаемостью', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Проверьте данные урока и добавьте пожелания. ИИ составит план по форме приказа №130.')).toBeInTheDocument();
    expect(screen.getAllByText('из КТП')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Групповая работа' }));
    await user.click(screen.getByRole('button', { name: 'Сгенерировать КСП' }));

    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0].body).toEqual({
      ...ktp, hintIds: ['GROUP_WORK'], language: 'ru',
      wishes: undefined, presentCount: undefined, absentCount: undefined,
    });
  });

  it('при расхождении тем без выбора учителя генерация не уходит', async () => {
    const user = userEvent.setup();
    useKspContext.mockReturnValue({
      data: context({ topicMismatch: true, lesson: { topic: 'Решение задач на дроби' } }), isError: false,
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Сгенерировать КСП' }));
    expect(start).not.toHaveBeenCalled();
    expect(screen.getByText('Выберите тему, по которой составить КСП')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Фактически/ }));
    await user.click(screen.getByRole('button', { name: 'Сгенерировать КСП' }));
    expect(start.mock.calls[0][0].body.topic).toBe('Решение задач на дроби');
  });

  it('без КТП подсвечивает обязательные поля и не придумывает цели', async () => {
    const user = userEvent.setup();
    useKspContext.mockReturnValue({ data: context({ ktp: undefined }), isError: false });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Сгенерировать КСП' }));
    expect(start).not.toHaveBeenCalled();
    expect(screen.getByText('Укажите раздел')).toBeInTheDocument();
    expect(screen.getByText('Укажите тему урока')).toBeInTheDocument();
    expect(screen.getByText('Укажите хотя бы одну цель обучения')).toBeInTheDocument();
    expect(screen.getByText('Заполните выделенные поля, чтобы сгенерировать КСП.')).toBeInTheDocument();
  });

  it('готовый результат — в редакторе «Не сохранён», сохраняется с номером задачи', async () => {
    const user = userEvent.setup();
    useKspContext.mockReturnValue({ data: context({ pendingJobId: 41, entryState: 'UNSAVED' }), isError: false });
    useKspJob.mockImplementation((_id: number, jobId: number | null) => ({
      data: jobId === 41 ? { id: 41, status: 'DONE', result, source: {} } : undefined, isError: false,
    }));
    save.mockResolvedValue({ exists: true, revision: 1 });
    renderPage();

    expect(await screen.findByText('Не сохранён')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Word' })).toBeDisabled();
    expect(screen.getByText('Время этапов: 45 мин из 45')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const { key, body } = save.mock.calls[0][0];
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).toMatchObject({ generationId: 41, replace: false, expectedRevision: undefined });
    expect(body.document.stages).toHaveLength(2);
  });

  it('сохранённый КСП: «Сохранён», действия и документ; правка включает «Есть несохранённые правки»', async () => {
    const user = userEvent.setup();
    useKspContext.mockReturnValue({ data: context({ entryState: 'SAVED', ksp: { exists: true, revision: 3 } }), isError: false });
    useKspDocument.mockReturnValue({
      data: { exists: true, revision: 3, updatedAt: '2026-11-12T09:20:00Z', document: result, canEdit: true }, isError: false,
    });
    renderPage();

    expect(await screen.findByText('КСП сохранён за уроком')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скачать Word' })).toBeEnabled();
    expect(screen.getByText('5А · Количество присутствующих: — · отсутствующих: —')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Редактировать' }));
    await user.type(screen.getByRole('textbox', { name: 'Цели урока' }), '!');
    expect(screen.getByText('Есть несохранённые правки')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].body).toMatchObject({ expectedRevision: 3, generationId: undefined });
  });

  it('ошибка генерации: «Изменить данные» закрывает задачу и возвращает к подготовке с прежним вводом', async () => {
    const user = userEvent.setup();
    useKspContext.mockReturnValue({ data: context({ ktp: undefined, pendingJobId: 41 }), isError: false });
    useKspJob.mockImplementation((_id: number, jobId: number | null) => ({
      data: jobId === 41 ? {
        id: 41, status: 'FAILED', errorMessage: 'Сервис генерации временно недоступен.',
        source: { section: 'Раздел 3', topic: 'Строение клетки', learningObjectives: '5.1.1.1', wishes: 'Рисунки' },
      } : undefined,
      isError: false,
    }));
    dismiss.mockResolvedValue({ id: 41, resolution: 'DISMISSED' });
    renderPage();

    expect(await screen.findByText('КСП не сгенерирован')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Изменить данные' }));

    expect(dismiss).toHaveBeenCalledWith(41);
    expect(await screen.findByDisplayValue('Строение клетки')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Рисунки')).toBeInTheDocument();
  });
});
