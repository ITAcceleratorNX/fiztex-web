import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ToastProvider } from '@/context/ToastContext';
import type { OneTimeEventOnSchedule } from '@/lib/oneTimeEventsApi';
import type { ScheduleGridView } from '@/platform/services/schedules';
import { OneTimeEventFormModal } from './OneTimeEventFormModal';
import { ScheduleWeeklyGrid } from './ScheduleWeeklyGrid';

const create = vi.fn();

vi.mock('@/lib/oneTimeEventsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/oneTimeEventsApi')>();
  return {
    ...actual,
    oneTimeEventsApi: {
      ...actual.oneTimeEventsApi,
      create: (...args: unknown[]) => create(...args),
    },
  };
});

vi.mock('@/platform/hooks/useScheduleSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/hooks/useScheduleSettings')>();
  return {
    ...actual,
    useSchoolClasses: () => ({
      data: {
        content: [
          { id: 3, academicYearId: 1, name: '7А', grade: '7', letter: 'А' },
          { id: 4, academicYearId: 1, name: '7Б', grade: '7', letter: 'Б' },
        ],
      },
      isLoading: false,
    }),
  };
});

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>{node}</ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function lesson(id: number, lessonNumber: number, subjectName: string) {
  return {
    id,
    scheduleId: 1,
    weekday: 'MONDAY',
    lessonPeriodId: 100 + lessonNumber,
    lessonNumber,
    startTime: `0${7 + lessonNumber}:00:00`,
    endTime: `0${7 + lessonNumber}:45:00`,
    subjectId: id,
    subjectName,
    teacherId: 1,
    teacherFullName: 'Иванова Анна Сергеевна',
    targetType: 'CLASS' as const,
    subgroupId: null,
    subgroupName: null,
    room: null,
  };
}

const GRID = {
  schedule: { id: 1 },
  weekdays: ['MONDAY', 'TUESDAY'],
  periods: [1, 2, 3].map((n) => ({
    id: 100 + n, lessonNumber: n, startTime: `0${7 + n}:00:00`, endTime: `0${7 + n}:45:00`, sortOrder: n,
  })),
  lessons: [lesson(10, 1, 'Математика'), lesson(11, 2, 'Физика'), lesson(12, 3, 'Химия')],
} as unknown as ScheduleGridView;

const EVENT: OneTimeEventOnSchedule = {
  id: 31,
  title: 'Классный час',
  date: '2026-10-12',
  startTime: '08:00:00',
  endTime: '09:15:00',
  overlaps: [
    { lessonId: 10, coverage: 'FULL', overlapStart: '08:00:00', overlapEnd: '08:45:00' },
    { lessonId: 11, coverage: 'PARTIAL', overlapStart: '09:00:00', overlapEnd: '09:15:00' },
  ],
};

const DATES = { MONDAY: '2026-10-12', TUESDAY: '2026-10-13' };

describe('ScheduleWeeklyGrid с разовыми событиями', () => {
  it('ставит событие вместо урока при полном перекрытии и рядом — при частичном', () => {
    const onOpenEvent = vi.fn();
    wrap(
      <ScheduleWeeklyGrid
        grid={GRID}
        readOnly
        onAddSlot={vi.fn()}
        onEditLesson={vi.fn()}
        dates={DATES}
        oneTimeEvents={[EVENT]}
        onOpenEvent={onOpenEvent}
      />,
    );

    // Полное: урок остаётся только зачёркнутой подписью под событием.
    const instead = screen.getByText('Математика').closest('button')!;
    expect(within(instead).getByText('Классный час')).toBeInTheDocument();
    expect(screen.getByText('Математика')).toHaveClass('line-through');

    // Частичное: урок на месте, событие — полоской с временем пересечения.
    expect(screen.getByText('Физика')).not.toHaveClass('line-through');
    expect(screen.getByText('09:00–09:15')).toBeInTheDocument();

    // Урок вне события не тронут.
    expect(screen.getByText('Химия').closest('button')).not.toHaveTextContent('Классный час');
  });

  it('показывает событие в шапке дня, даже если оно не задело уроков', async () => {
    const onOpenEvent = vi.fn();
    const lonely: OneTimeEventOnSchedule = {
      id: 32, title: 'Экскурсия', date: '2026-10-13', startTime: '14:00:00', endTime: '15:00:00', overlaps: [],
    };
    wrap(
      <ScheduleWeeklyGrid
        grid={GRID}
        readOnly
        onAddSlot={vi.fn()}
        onEditLesson={vi.fn()}
        dates={DATES}
        oneTimeEvents={[lonely]}
        onOpenEvent={onOpenEvent}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /Экскурсия/ }));
    expect(onOpenEvent).toHaveBeenCalledWith(32);
  });

  it('без дат (черновик) события не рисует', () => {
    wrap(
      <ScheduleWeeklyGrid grid={GRID} readOnly onAddSlot={vi.fn()} onEditLesson={vi.fn()} oneTimeEvents={[EVENT]} />,
    );
    expect(screen.queryByText('Классный час')).not.toBeInTheDocument();
  });
});

describe('OneTimeEventFormModal', () => {
  beforeEach(() => create.mockReset());

  async function fill(user: ReturnType<typeof userEvent.setup>, start: string, end: string) {
    await user.type(screen.getByLabelText(/Название/), 'Линейка');
    await user.type(screen.getByLabelText(/Начало/), start);
    await user.type(screen.getByLabelText(/Окончание/), end);
  }

  it('не отправляет форму, если окончание не позже начала', async () => {
    const user = userEvent.setup();
    wrap(
      <OneTimeEventFormModal open onClose={vi.fn()} yearId={1} event={null} defaultDate="2026-10-12" onSaved={vi.fn()} />,
    );
    await fill(user, '1000', '0900');
    await user.click(screen.getByRole('button', { name: 'Создать' }));
    expect(await screen.findByText('Окончание должно быть позже начала')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('отправляет аудиторию и сохраняет введённое при ошибке сервера', async () => {
    const user = userEvent.setup();
    create.mockRejectedValueOnce(new ApiError(400, 'Выберите хотя бы один класс'));
    wrap(
      <OneTimeEventFormModal
        open
        onClose={vi.fn()}
        yearId={1}
        event={null}
        defaultDate="2026-10-12"
        defaultClassId="3"
        onSaved={vi.fn()}
      />,
    );
    await fill(user, '0800', '0915');
    await user.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(1, expect.objectContaining({
      title: 'Линейка',
      date: '2026-10-12',
      startTime: '08:00',
      endTime: '09:15',
      audience: 'CLASSES',
      classIds: [3],
    }));
    expect(await screen.findByText('Выберите хотя бы один класс')).toBeInTheDocument();
    expect(screen.getByLabelText(/Название/)).toHaveValue('Линейка');
  });
});
