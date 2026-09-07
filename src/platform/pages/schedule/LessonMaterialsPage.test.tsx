import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonMaterialsPage } from './LessonMaterialsPage';

const useLesson = vi.fn();
const useLessonMaterials = vi.fn();

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
});
