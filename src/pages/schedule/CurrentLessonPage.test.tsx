import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentLesson } from '@/lib/lessonsApi';
import { CurrentLessonPage } from './CurrentLessonPage';

const useCurrentLesson = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useCurrentLesson: () => useCurrentLesson(),
}));

vi.mock('@/hooks/useDocumentTitle', () => ({ useDocumentTitle: () => {} }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/current-lesson']}>
      <Routes>
        <Route path="/current-lesson" element={<CurrentLessonPage />} />
        <Route path="/lesson-schedule/lessons/:lessonId" element={<div>карточка урока 42</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function result(overrides: Partial<CurrentLesson> = {}): CurrentLesson {
  return { status: 'ok', message: 'OK', lesson: { id: 42 }, ...overrides };
}

describe('CurrentLessonPage', () => {
  beforeEach(() => {
    useCurrentLesson.mockReset();
    refetch.mockReset();
  });

  it('уводит на карточку найденного урока, не показывая своего экрана', async () => {
    useCurrentLesson.mockReturnValue({ isPending: false, isError: false, data: result(), refetch });

    renderPage();

    expect(await screen.findByText('карточка урока 42')).toBeInTheDocument();
  });

  it('сбой загрузки не выдаётся за отсутствие занятий и предлагает повторить', async () => {
    useCurrentLesson.mockReturnValue({ isPending: false, isError: true, data: undefined, refetch });

    renderPage();

    expect(screen.getByText('Не удалось определить текущий урок')).toBeInTheDocument();
    expect(screen.queryByText(/Нет доступных ближайших уроков/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('различает «расписания ещё нет» и «ближайших уроков нет»', () => {
    useCurrentLesson.mockReturnValue({
      isPending: false,
      isError: false,
      data: result({ status: 'schedule_not_published', message: 'Расписание ещё не опубликовано', lesson: undefined }),
      refetch,
    });
    const { unmount } = renderPage();
    expect(screen.getByText('Расписание ещё не опубликовано')).toBeInTheDocument();
    unmount();

    useCurrentLesson.mockReturnValue({
      isPending: false,
      isError: false,
      data: result({ status: 'no_upcoming_lessons', message: 'Нет доступных ближайших уроков', lesson: undefined }),
      refetch,
    });
    renderPage();
    expect(screen.getByText('Нет доступных ближайших уроков')).toBeInTheDocument();
  });

  it('в пустом состоянии остаётся способ попробовать снова', async () => {
    useCurrentLesson.mockReturnValue({
      isPending: false,
      isError: false,
      data: result({ status: 'no_upcoming_lessons', lesson: undefined }),
      refetch,
    });

    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Проверить снова' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('пока урок не определён, показывает скелет карточки, а не пустое состояние', () => {
    useCurrentLesson.mockReturnValue({ isPending: true, isError: false, data: undefined, refetch });

    renderPage();

    expect(screen.getByLabelText('Загрузка урока')).toBeInTheDocument();
  });
});
