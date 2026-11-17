import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonMaterialsPage } from './LessonMaterialsPage';

const useLesson = vi.fn();
const useLessonMaterials = vi.fn();
const useLessonTextbooks = vi.fn();
const useLessonSummary = vi.fn();
const selectTextbook = vi.fn();
const useLessonHomework = vi.fn();
const setHomeworkNotAssigned = vi.fn();
const attachWorkspace = vi.fn();

vi.mock('@/components/workspace/WorkspaceMaterialPickerModal', () => ({
  WorkspaceMaterialPickerModal: ({ onConfirm }: { onConfirm: (items: { id: number; title: string }[]) => Promise<void> }) =>
    <button onClick={() => void onConfirm([{ id: 12, title: 'Конспект урока' }])}>Выбрать Конспект урока</button>,
}));

vi.mock('@/pages/workspace/CopyHomeworkToLessonModal', () => ({
  CopyHomeworkToLessonModal: ({ sourceId }: { sourceId: number }) => <p>Копия задания {sourceId}</p>,
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

/** Команды со страницы в тесте не вызываются — проверяется, что она показывает. */
const idleMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
});

vi.mock('@/hooks/queries', () => ({
  useLesson: (...args: unknown[]) => useLesson(...args),
  useLessonMaterials: (...args: unknown[]) => useLessonMaterials(...args),
  useAddLessonMaterialFile: () => idleMutation(),
  useAddLessonMaterialLink: () => idleMutation(),
  useAttachWorkspaceDocumentToLesson: () => ({ ...idleMutation(), mutateAsync: attachWorkspace }),
  useSetLessonMaterialVisibility: () => idleMutation(),
  useDeleteLessonMaterial: () => idleMutation(),
  useLessonTextbooks: (...args: unknown[]) => useLessonTextbooks(...args),
  useSelectLessonTextbook: () => ({ mutate: selectTextbook, isPending: false }),
  useClearLessonTextbook: () => idleMutation(),
  useLessonSummary: (...args: unknown[]) => useLessonSummary(...args),
  useLessonHomework: (...args: unknown[]) => useLessonHomework(...args),
  useSetHomeworkNotAssigned: () => ({ mutate: setHomeworkNotAssigned, isPending: false }),
}));

/** Учебник урока в том виде, в каком его отдаёт GET /api/lessons/{id}/textbooks. */
function textbook(overrides: Record<string, unknown> = {}) {
  return {
    bindingId: 7,
    textbookId: 3,
    title: 'Spotlight 5. Student’s Book',
    format: 'PDF',
    pageCount: 142,
    pageNavigation: true,
    pageFrom: null,
    pageTo: null,
    active: true,
    ...overrides,
  };
}

function lesson(capabilities: string[], overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    date: '2026-09-08',
    subjectName: 'Физика',
    className: '7А',
    academicPeriodStatus: 'ACTIVE',
    capabilities,
    ...overrides,
  };
}

/** Права того, кто урок ведёт: задания и отметку «ДЗ не задано» меняет он. */
const TEACHING = ['VIEW_CARD', 'VIEW_STUDENTS', 'EDIT_TEACHING_PART'];

function material(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    kind: 'FILE',
    fileName: 'конспект.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    visibleToStudents: true,
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/lesson-schedule/lessons/1/materials']}>
      <Routes>
        <Route
          path="/lesson-schedule/lessons/:lessonId/materials"
          element={<LessonMaterialsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LessonMaterialsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLessonMaterials.mockReturnValue({ data: [], isPending: false, isError: false });
    useLessonTextbooks.mockReturnValue({
      data: { canSelect: false, selected: null, available: [] }, isPending: false, isError: false,
    });
    useLessonSummary.mockReturnValue({ data: { canEdit: false }, isPending: false, isError: false });
    useLessonHomework.mockReturnValue({ data: [], isPending: false, isError: false });
    attachWorkspace.mockResolvedValue({ id: 13 });
  });

  /**
   * Учитель урока — единственный, кто видит здесь кнопки. Проверяется не вёрстка, а
   * ветка прав: в браузере её не достать без учительской сессии, а разъехаться с
   * бэкендом она может незаметно.
   */
  it('учителю показывает загрузку файла и форму ссылки', () => {
    useLesson.mockReturnValue({ data: lesson(['VIEW_CARD', 'EDIT_TEACHING_PART']) });
    renderPage();

    expect(screen.getByRole('button', { name: /Загрузить файл/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Выбрать из рабочего пространства/ })).toBeInTheDocument();
    expect(screen.getByText(/Приложите презентацию/)).toBeInTheDocument();
  });

  it('прикрепляет выбранный материал к уроку с видимостью для учеников', async () => {
    useLesson.mockReturnValue({ data: lesson(['EDIT_TEACHING_PART']) });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Выбрать из рабочего пространства/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать Конспект урока' }));
    await waitFor(() => expect(attachWorkspace).toHaveBeenCalledWith({ lessonId: 1, itemId: 12, visibleToStudents: true }));
  });

  it('без права на учебную часть кнопок нет, а пустое состояние другое', () => {
    useLesson.mockReturnValue({ data: lesson(['VIEW_CARD']) });
    renderPage();

    expect(screen.queryByRole('button', { name: /Загрузить файл/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Материалы к уроку прикладывает учитель/)).toBeInTheDocument();
  });

  /** Слово, а не иконка: «скрыт» должно читаться без догадок. */
  it('скрытый материал помечен подписью «Только для учителя»', () => {
    useLesson.mockReturnValue({ data: lesson(['VIEW_CARD', 'EDIT_TEACHING_PART']) });
    useLessonMaterials.mockReturnValue({
      data: [material({ visibleToStudents: false })],
      isPending: false,
      isError: false,
    });
    renderPage();

    expect(screen.getByText('Только для учителя')).toBeInTheDocument();
    expect(screen.getByText('Скрыт')).toBeInTheDocument();
  });

  it('видимый материал подписан «Видно ученикам» и без пометки', () => {
    useLesson.mockReturnValue({ data: lesson(['VIEW_CARD', 'EDIT_TEACHING_PART']) });
    useLessonMaterials.mockReturnValue({
      data: [material()],
      isPending: false,
      isError: false,
    });
    renderPage();

    expect(screen.getByText('Видно ученикам')).toBeInTheDocument();
    expect(screen.queryByText('Только для учителя')).not.toBeInTheDocument();
  });

  it('ошибку загрузки показывает с повтором', () => {
    useLesson.mockReturnValue({ data: lesson(['VIEW_CARD']) });
    useLessonMaterials.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByText(/Не удалось загрузить материалы/)).toBeInTheDocument();
  });

  /**
   * KSP-FE-001: учебник переехал сюда с карточки урока (Figma 2212:9448 / 9521). Выбор тот же —
   * раскрывается по «Выбрать учебник», а не стоит открытым: страницу смотрят чаще, чем меняют.
   */
  describe('учебник урока', () => {
    it('учитель выбирает из назначенного классу; пока не выбрал — подсказка из макета', async () => {
      const user = userEvent.setup();
      useLesson.mockReturnValue({ data: lesson(['VIEW_CARD', 'EDIT_TEACHING_PART']) });
      useLessonTextbooks.mockReturnValue({
        data: { canSelect: true, selected: null, available: [textbook()] }, isPending: false, isError: false,
      });
      renderPage();

      expect(screen.getByText('Учебник к уроку не выбран')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Выбрать учебник' }));
      expect(screen.getByText(/Ученики всё равно смогут открыть учебники/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Учебник' }));
      await user.click(screen.getByRole('option', { name: 'Spotlight 5. Student’s Book' }));

      // Выбор уходит назначением, а не учебником: учебник действует у класса через него.
      expect(selectTextbook).toHaveBeenCalledWith({ bindingId: 7 }, expect.anything());
    });

    it('страницы у PDF сохраняются диапазоном, когда фокус уходит из обоих полей', async () => {
      const user = userEvent.setup();
      useLesson.mockReturnValue({ data: lesson(['VIEW_CARD', 'EDIT_TEACHING_PART']) });
      useLessonTextbooks.mockReturnValue({
        data: { canSelect: true, selected: textbook(), available: [textbook()] }, isPending: false, isError: false,
      });
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Изменить' }));
      await user.type(screen.getByRole('textbox', { name: 'С какой страницы' }), '24');
      await user.click(screen.getByRole('textbox', { name: 'По какую страницу' }));
      expect(selectTextbook).not.toHaveBeenCalled();

      await user.keyboard('26');
      await user.click(document.body);
      expect(selectTextbook).toHaveBeenCalledTimes(1);
      expect(selectTextbook).toHaveBeenCalledWith({ bindingId: 7, pageFrom: 24, pageTo: 26 }, expect.anything());
    });

    it('у администратора — только чтение выбранного учителем', () => {
      useLesson.mockReturnValue({ data: lesson(['VIEW_CARD']) });
      useLessonTextbooks.mockReturnValue({
        data: { canSelect: false, selected: textbook({ pageFrom: 24, pageTo: 26, active: false }), available: [] },
        isPending: false,
        isError: false,
      });
      renderPage();

      expect(screen.getByText('Spotlight 5. Student’s Book · стр. 24–26')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Открыть' })).toBeInTheDocument();
      expect(screen.getByText(/больше не назначен классу/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Выбрать учебник|Изменить/ })).not.toBeInTheDocument();
    });
  });

  describe('конспект урока', () => {
    it('без конспекта учитель создаёт его на прежней странице конспекта', () => {
      useLesson.mockReturnValue({ data: lesson(['VIEW_CARD', 'EDIT_TEACHING_PART']) });
      useLessonSummary.mockReturnValue({ data: { canEdit: true }, isPending: false, isError: false });
      renderPage();

      expect(screen.getByText(/Конспект пока не создан. ИИ составит его/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Создать с ИИ/ })).toHaveAttribute('href', '/lesson-schedule/lessons/1/summary');
    });

    it('черновик открывается и помечен', () => {
      useLesson.mockReturnValue({ data: lesson(['VIEW_CARD', 'EDIT_TEACHING_PART']) });
      useLessonSummary.mockReturnValue({
        data: { canEdit: true, content: { title: 'Умножение дробей' } }, isPending: false, isError: false,
      });
      renderPage();

      expect(screen.getByText('Умножение дробей')).toBeInTheDocument();
      expect(screen.getByText('Черновик')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Открыть' })).toHaveAttribute('href', '/lesson-schedule/lessons/1/summary');
    });
  });

  /*
   * Раздел «Домашнее задание» переехал сюда с карточки урока и стоит сразу после учебника.
   * Он отвечает не только «что задано», но и «закрыт ли вопрос»: пустой список одинаков у урока,
   * до которого не дошли руки, и у урока, на который решили не задавать.
   */
  describe('домашнее задание', () => {
    it('стоит после учебника и перед конспектом', () => {
      useLesson.mockReturnValue({ data: lesson(TEACHING) });
      renderPage();

      const titles = screen.getAllByText(/^(Учебник|Домашнее задание|Конспект урока)$/).map((node) => node.textContent);
      expect(titles).toEqual(['Учебник', 'Домашнее задание', 'Конспект урока']);
    });

    it('показывает задания урока списком, их число и срок', () => {
      useLesson.mockReturnValue({ data: lesson(['VIEW_CARD', 'VIEW_STUDENTS', 'MANAGE_STRUCTURE']) });
      useLessonHomework.mockReturnValue({
        data: [
          {
            id: 12, title: 'Параграф 12, упражнения 1–5', status: 'PUBLISHED', dueType: 'NEXT_LESSON', dueAt: null,
            lesson: { id: 1 }, progress: { submitted: 3, total: 25 },
          },
          // Задание без привязки: к уроку его относит срок (LessonHomeworkScope).
          {
            id: 13, title: 'Задано из раздела', status: 'PUBLISHED', dueType: 'EXACT', dueAt: '2026-09-08T09:00:00Z',
            progress: { submitted: 0, total: 25 },
          },
          { id: 14, title: 'Черновик', status: 'DRAFT', dueType: 'NONE', dueAt: null, lesson: { id: 1 } },
        ],
        isPending: false,
        isError: false,
      });
      renderPage();

      expect(screen.getByText('Параграф 12, упражнения 1–5')).toBeInTheDocument();
      expect(screen.getByText('До следующего урока')).toBeInTheDocument();
      expect(screen.getByText('3 / 25')).toBeInTheDocument();
      expect(screen.getByText('3 задания · 1 в черновике')).toBeInTheDocument();
      expect(screen.getByText(/срок на этом уроке/)).toBeInTheDocument();
      // Карточку задания бэкенд отдаёт только учителю урока: у админа строка не ведёт никуда.
      expect(screen.getByRole('button', { name: /Параграф 12/ })).toBeDisabled();
      expect(screen.getByRole('link', { name: 'Все задания' })).toHaveAttribute('href', '/lesson-schedule/lessons/1/homework');
    });

    it('учитель использует задание повторно', async () => {
      useLesson.mockReturnValue({ data: lesson(TEACHING) });
      useLessonHomework.mockReturnValue({
        data: [{ id: 12, title: 'Тест по дробям', status: 'PUBLISHED', answerFormat: 'TEST',
          dueType: 'NONE', dueAt: null, lesson: { id: 1 }, progress: { submitted: 3, total: 25 } }],
        isPending: false,
        isError: false,
      });
      renderPage();

      await userEvent.click(screen.getByRole('button', { name: 'Использовать повторно: Тест по дробям' }));
      expect(screen.getByText('Копия задания 12')).toBeInTheDocument();
    });

    it('урок без заданий говорит об этом и предлагает создать', () => {
      useLesson.mockReturnValue({ data: lesson(TEACHING) });
      renderPage();

      expect(screen.getByText('К этому уроку заданий нет')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Создать задание/ })).toHaveAttribute('href', '/homework/new?lessonId=1');
    });

    it('говорит учителю, что действие по ДЗ не завершено, и предлагает его закрыть', async () => {
      useLesson.mockReturnValue({ data: lesson(TEACHING, { homeworkState: 'NOT_SPECIFIED' }) });
      renderPage();

      expect(screen.getByText('Домашнее задание пока не указано')).toBeInTheDocument();
      expect(screen.getByText(/действие по ДЗ не завершено/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'ДЗ не задано' }));
      expect(setHomeworkNotAssigned).toHaveBeenCalledWith(true, expect.anything());
    });

    it('после отметки предлагает передумать, а не отметить второй раз', async () => {
      useLesson.mockReturnValue({ data: lesson(TEACHING, { homeworkState: 'NOT_ASSIGNED' }) });
      renderPage();

      expect(screen.getByText('Заданий по этому уроку не будет')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Отменить отметку' }));
      expect(setHomeworkNotAssigned).toHaveBeenCalledWith(false, expect.anything());
    });

    it('не предлагает «ДЗ не задано» поверх выданного задания', () => {
      useLesson.mockReturnValue({ data: lesson(TEACHING, { homeworkState: 'ASSIGNED' }) });
      useLessonHomework.mockReturnValue({
        data: [{ id: 12, title: 'Упражнения 1–5', status: 'PUBLISHED', lesson: { id: 1 } }],
        isPending: false,
        isError: false,
      });
      renderPage();

      // Бэкенд ответил бы 409: два финальных состояния одновременно ТЗ запрещает.
      expect(screen.queryByRole('button', { name: 'ДЗ не задано' })).toBeNull();
      expect(screen.getByText('ДЗ задано')).toBeInTheDocument();
    });

    it('черновик показывает учителю как незакрытое действие', () => {
      useLesson.mockReturnValue({ data: lesson(TEACHING, { homeworkState: 'DRAFT' }) });
      useLessonHomework.mockReturnValue({
        data: [{ id: 14, title: 'Черновик', status: 'DRAFT', lesson: { id: 1 } }],
        isPending: false,
        isError: false,
      });
      renderPage();

      expect(screen.getByText('Черновик. Не опубликовано')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ДЗ не задано' })).toBeInTheDocument();
    });

    it('в закрытом периоде состояние видно, а действий нет', () => {
      useLesson.mockReturnValue({
        data: lesson(TEACHING, { homeworkState: 'NOT_SPECIFIED', academicPeriodStatus: 'CLOSED' }),
      });
      renderPage();

      expect(screen.getByText('Домашнее задание пока не указано')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'ДЗ не задано' })).toBeNull();
      expect(screen.queryByRole('link', { name: /Создать задание/ })).toBeNull();
    });

    it('без права видеть состав урока за заданиями не ходим', () => {
      useLesson.mockReturnValue({ data: lesson(['VIEW_CARD']) });
      renderPage();

      expect(useLessonHomework).toHaveBeenCalledWith(1, false);
      expect(screen.getByText('Задания урока видны его учителю и администратору')).toBeInTheDocument();
    });
  });
});
