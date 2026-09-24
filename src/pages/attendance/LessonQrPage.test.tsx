import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import type { AttendanceQrSession } from '@/lib/attendanceQrApi';
import type { Lesson } from '@/lib/lessonsApi';
import { LessonQrPage } from './LessonQrPage';

const lessonHook = vi.fn();
const qrHook = vi.fn();
const mutate = vi.fn();
const openHook = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useLesson: (...args: unknown[]) => lessonHook(...args),
  useLiveAttendanceQr: (...args: unknown[]) => qrHook(...args),
  useOpenAttendanceQr: (...args: unknown[]) => openHook(...args),
}));

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));

// Урок 1272 живого бэкенда: 5А, Математика, 24.09 15:15–16:00, уже закончился.
const LESSON: Lesson = {
  id: 1272,
  subjectName: 'Математика',
  className: '5А',
  classId: 1,
  room: '201',
  date: '2026-09-24',
  startTime: '15:15:00',
  endTime: '16:00:00',
  status: 'ACTIVE',
  temporalStatus: 'FINISHED',
};

function session(overrides: Partial<AttendanceQrSession>): AttendanceQrSession {
  return {
    lessonId: 1272,
    status: 'NONE',
    canOpen: false,
    scannedCount: 0,
    totalCount: 22,
    scans: [],
    lessonEndsAt: '2026-09-24T11:00:00Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/my-attendance/lessons/1272/qr']}>
      <Routes>
        <Route path="/my-attendance/lessons/:lessonId/qr" element={<LessonQrPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Код урока', () => {
  beforeEach(() => {
    lessonHook.mockReturnValue({ data: LESSON, error: null });
    openHook.mockReturnValue({ mutate, isPending: false, isError: false });
  });

  afterEach(() => vi.clearAllMocks());

  it('живой ответ по закончившемуся уроку: кода не было и не будет — не открываем', () => {
    qrHook.mockReturnValue({ data: session({}), isPending: false, error: null });
    renderPage();

    expect(screen.getByText('Урок закончился — код больше не действует')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
    // Журнал месяца открывается сразу на классе и месяце этого урока.
    expect(screen.getByRole('link', { name: /Посещаемость за месяц/ })).toHaveAttribute(
      'href',
      '/my-attendance/month?scope=1&month=2026-09',
    );
  });

  it('кода ещё нет, а открыть можно — страница открывает его сама и только один раз', () => {
    lessonHook.mockReturnValue({ data: { ...LESSON, temporalStatus: 'ONGOING' }, error: null });
    qrHook.mockReturnValue({ data: session({ canOpen: true }), isPending: false, error: null });
    const { rerender } = renderPage();
    rerender(
      <MemoryRouter initialEntries={['/my-attendance/lessons/1272/qr']}>
        <Routes>
          <Route path="/my-attendance/lessons/:lessonId/qr" element={<LessonQrPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Открываем код…')).toBeInTheDocument();
  });

  it('код действует — QR, счётчик отсканировавших и правда о сроке', () => {
    lessonHook.mockReturnValue({ data: { ...LESSON, temporalStatus: 'ONGOING' }, error: null });
    qrHook.mockReturnValue({
      data: session({ status: 'ACTIVE', canOpen: true, payload: 'fiztex:att:1:token', scannedCount: 18, totalCount: 24 }),
      isPending: false,
      error: null,
    });
    renderPage();

    expect(screen.getByRole('img', { name: 'QR-код для отметки посещаемости' })).toBeInTheDocument();
    expect(screen.getByText('Отсканировали: 18 / 24')).toBeInTheDocument();
    expect(screen.getByText('Код действует до конца урока')).toBeInTheDocument();
    expect(screen.getByText('Идёт сейчас')).toBeInTheDocument();
    // Действующий код не перевыпускается: класс его сейчас сканирует.
    expect(mutate).not.toHaveBeenCalled();
  });

  it('код закрыт — новый только по кнопке', async () => {
    lessonHook.mockReturnValue({ data: { ...LESSON, temporalStatus: 'ONGOING' }, error: null });
    qrHook.mockReturnValue({ data: session({ status: 'CLOSED', canOpen: true }), isPending: false, error: null });
    renderPage();

    expect(screen.getByText('Код закрыт')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Показать новый код' }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('урок ещё не начался — говорим, с какого времени', () => {
    lessonHook.mockReturnValue({ data: { ...LESSON, temporalStatus: 'UPCOMING' }, error: null });
    qrHook.mockReturnValue({ data: session({}), isPending: false, error: null });
    renderPage();
    expect(screen.getByText('Код можно показать с начала урока — с 15:15')).toBeInTheDocument();
  });

  it('чужой урок — нет права показывать код', () => {
    qrHook.mockReturnValue({ data: undefined, isPending: false, error: new ApiError(403, 'Forbidden') });
    renderPage();
    expect(screen.getByText('Код может показать только учитель этого урока')).toBeInTheDocument();
  });
});
