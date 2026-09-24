import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonMaterialsPage } from './LessonMaterialsPage';

const useLesson = vi.fn();
const useLessonMaterials = vi.fn();
const useLessonAiNotes = vi.fn();
const useLessonTextbooks = vi.fn();
const startNote = vi.fn();

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
  useSetLessonMaterialVisibility: () => idleMutation(),
  useDeleteLessonMaterial: () => idleMutation(),
  useLessonAiNotes: (...args: unknown[]) => useLessonAiNotes(...args),
  useLessonTextbooks: (...args: unknown[]) => useLessonTextbooks(...args),
  useStartLessonAiNote: () => ({ mutateAsync: startNote, isPending: false }),
}));

function lesson(capabilities: string[]) {
  return {
    id: 1,
    date: '2026-09-08',
    subjectName: 'Физика',
    className: '7А',
    capabilities,
  };
}

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
    useLessonAiNotes.mockReturnValue({ data: [], isPending: false, isError: false });
    useLessonTextbooks.mockReturnValue({ data: {} });
    startNote.mockResolvedValue({});
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
    expect(screen.getByRole('button', { name: /Добавить ссылку/ })).toBeInTheDocument();
    expect(screen.getByText(/Приложите конспект/)).toBeInTheDocument();
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

  describe('AI-шпаргалка', () => {
    const teacher = () =>
      useLesson.mockReturnValue({ data: lesson(['VIEW_CARD', 'EDIT_TEACHING_PART']) });

    it('ученику и родителю блока нет', () => {
      useLesson.mockReturnValue({ data: lesson(['VIEW_CARD']) });
      renderPage();

      expect(screen.queryByText('AI-шпаргалка к уроку')).not.toBeInTheDocument();
    });

    /** Ссылку модель не читает — в источниках её нет вовсе, а не «выбрана и пропущена». */
    it('отправляет выбранные файлы без ссылок и снятых галочек', () => {
      teacher();
      useLessonMaterials.mockReturnValue({
        data: [
          material({ id: 10, fileName: 'параграф.pdf' }),
          material({ id: 11, fileName: 'фото.jpg', kind: 'PHOTO' }),
          material({ id: 12, kind: 'LINK', fileName: undefined, url: 'https://example.org' }),
        ],
        isPending: false,
        isError: false,
      });
      renderPage();

      fireEvent.click(screen.getByRole('checkbox', { name: 'фото.jpg' }));
      fireEvent.change(screen.getByPlaceholderText(/второй закон Ньютона/), {
        target: { value: 'Плотность' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Сгенерировать конспект/ }));

      expect(startNote).toHaveBeenCalledWith({
        kind: 'SUMMARY',
        materialIds: [10],
        useTextbook: false,
        teacherPrompt: 'Плотность',
      });
    });

    it('учебник без страниц не выбирается и говорит почему', () => {
      teacher();
      useLessonTextbooks.mockReturnValue({
        data: { selected: { title: 'Физика 7', format: 'PDF', pageFrom: undefined } },
      });
      renderPage();

      expect(screen.getByRole('checkbox', { name: /Учебник: Физика 7/ })).toBeDisabled();
      expect(screen.getByText(/укажите страницы в карточке урока/)).toBeInTheDocument();
    });

    it('без материалов и темы генерировать не из чего', () => {
      teacher();
      renderPage();

      expect(screen.getByRole('button', { name: /Сгенерировать конспект/ })).toBeDisabled();
    });

    it('готовый план показывается во вкладке «План урока», конспект — в своей', () => {
      useLesson.mockReturnValue({
        data: { ...lesson(['VIEW_CARD', 'EDIT_TEACHING_PART']), topic: 'Плотность вещества' },
      });
      useLessonAiNotes.mockReturnValue({
        data: [
          { id: 1, kind: 'SUMMARY', status: 'DONE', text: '## Главное\nПро плотность' },
          { id: 2, kind: 'PLAN', status: 'RUNNING' },
        ],
        isPending: false,
        isError: false,
      });
      renderPage();

      expect(screen.getByText('Про плотность')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Сгенерировать заново/ })).toBeEnabled();

      // Полноэкранное чтение: тот же текст крупно, Esc закрывает.
      fireEvent.click(screen.getByRole('button', { name: /На весь экран/ }));
      const reader = screen.getByRole('dialog', { name: 'Конспект' });
      expect(reader).toHaveTextContent('Про плотность');
      expect(reader).toHaveTextContent('Физика · 7А · Плотность вещества');
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: 'План урока' }));
      expect(screen.queryByText('Про плотность')).not.toBeInTheDocument();
      // Пока идёт генерация, второй раз её не запустить.
      expect(screen.getByRole('button', { name: /Сгенерировать план/ })).toBeDisabled();
    });
  });
});
