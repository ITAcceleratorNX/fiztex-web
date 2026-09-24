import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoleSchedule } from '@/lib/lessonsApi';
import { TeacherAttendancePage } from './TeacherAttendancePage';
// Живой `GET /api/schedule/me/today` учителя +77001000000 на 24.09.2026: четыре урока, и
// фактический урок сгенерирован только у одного (15:15, 5А) — у остальных `lessonInstanceId`
// пуст, открывать им нечего.
import liveToday from './__fixtures__/scheduleToday.json';

const todayHook = vi.fn();

vi.mock('@/hooks/queries', () => ({ useMyTodayLessons: () => todayHook() }));

function renderPage() {
  return render(
    <MemoryRouter>
      <TeacherAttendancePage />
    </MemoryRouter>,
  );
}

describe('Посещаемость (QR) — уроки дня', () => {
  afterEach(() => vi.clearAllMocks());

  it('строка урока ведёт на его код, урок без фактического экземпляра — нет', () => {
    todayHook.mockReturnValue({ data: liveToday as RoleSchedule, isPending: false, isError: false });
    renderPage();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    const withLesson = rows.find((row) => row.textContent?.includes('15:15')) as HTMLElement;
    expect(within(withLesson).getByText('5А класс')).toBeInTheDocument();
    expect(within(withLesson).getByText('Каб. 201')).toBeInTheDocument();
    expect(within(withLesson).getByRole('link', { name: 'Показать QR' })).toHaveAttribute(
      'href',
      '/my-attendance/lessons/1272/qr',
    );
    expect(screen.getAllByText('Урок ещё не создан')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Посещаемость за месяц/ })).toHaveAttribute(
      'href',
      '/my-attendance/month',
    );
  });

  it('уроков нет — сказано прямо, с причиной от сервера', () => {
    todayHook.mockReturnValue({
      data: { status: 'non_working_day', message: 'Сегодня выходной', lessons: [] },
      isPending: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('Сегодня у вас нет уроков')).toBeInTheDocument();
    expect(screen.getByText('Сегодня выходной')).toBeInTheDocument();
  });

  it('ошибка — сообщение и «Повторить»', () => {
    todayHook.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('Не удалось загрузить уроки')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
