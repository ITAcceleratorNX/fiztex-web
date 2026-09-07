import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminJournal, UnfilledLesson } from '@/lib/attendanceAdminApi';
import { AttendanceAdminPage } from './AttendanceAdminPage';

const journalHook = vi.fn();
const unfilledHook = vi.fn();
const classStudents = vi.fn();
const classSubgroups = vi.fn();

vi.mock('@/platform/hooks/useAttendanceAdmin', () => ({
  useAdminAttendanceJournal: (...args: unknown[]) => journalHook(...args),
  useUnfilledLessons: (...args: unknown[]) => unfilledHook(...args),
}));

vi.mock('@/platform/hooks/useScheduleSettings', () => ({
  useAcademicYears: () => ({
    data: {
      content: [{ id: 3, name: '2026/2027', startDate: '2026-09-01', endDate: '2027-05-25' }],
    },
    isLoading: false,
  }),
  useSchoolClasses: () => ({
    data: {
      content: [
        { id: 11, name: '5 «А»', grade: '5', letter: 'А' },
        { id: 12, name: '5 «Б»', grade: '5', letter: 'Б' },
      ],
    },
    isLoading: false,
  }),
  useAllTeachers: () => ({
    data: {
      content: [
        { id: 2, lastName: 'Искаков', firstName: 'Алишер', middleName: 'Мақсатұлы' },
        { id: 3, lastName: 'Байтурсынова', firstName: 'Мадина', middleName: null },
      ],
    },
    isLoading: false,
  }),
  useClassStudents: (...args: unknown[]) => classStudents(...args),
}));

vi.mock('@/platform/hooks/useSubgroups', () => ({
  useSchoolSubjects: () => ({ data: { content: [{ id: 4, name: 'Математика' }] }, isLoading: false }),
  useClassSubgroups: (...args: unknown[]) => classSubgroups(...args),
}));

function journal(overrides: Partial<AdminJournal> = {}): AdminJournal {
  return {
    month: '2026-09',
    classId: 11,
    lessons: [
      {
        lessonId: 51,
        lessonDate: '2026-09-03',
        startTime: '08:00:00',
        subjectName: 'Математика',
        teacherName: 'Искаков А.М.',
        subgroupName: undefined,
        state: 'PUBLISHED',
      },
      {
        lessonId: 52,
        lessonDate: '2026-09-04',
        startTime: '08:00:00',
        subjectName: 'Математика',
        teacherName: 'Искаков А.М.',
        subgroupName: undefined,
        state: 'NOT_FILLED',
      },
    ],
    rows: [
      {
        studentProfileId: 7,
        fullName: 'Абдиров Дамир',
        attendedCount: 1,
        missedCount: 1,
        lateCount: 0,
        excusedCount: 0,
        cells: [
          { lessonId: 51, attendance: { status: 'PRESENT' } },
          { lessonId: 52, attendance: { status: 'ABSENT', reason: 'ILLNESS' } },
        ],
      },
    ],
    summary: {
      lessonCount: 2,
      filledCount: 1,
      unfilledCount: 1,
      attendedCount: 1,
      missedCount: 1,
      lateCount: 0,
      excusedCount: 0,
      reasonBreakdown: { ILLNESS: 1 },
    },
    ...overrides,
  };
}

function unfilled(): UnfilledLesson[] {
  return [
    {
      lessonId: 52,
      lessonDate: '2026-09-04',
      startTime: '08:00:00',
      className: '5 «А»',
      subgroupName: undefined,
      subjectName: 'Математика',
      teacherName: 'Искаков А.М.',
      state: 'NOT_FILLED',
    },
  ];
}

function renderPage(path = '/attendance') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AttendanceAdminPage />
    </MemoryRouter>,
  );
}

describe('AttendanceAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classSubgroups.mockReturnValue({
      data: [
        { id: 31, name: 'Группа 1', groupSet: { name: 'Английский' } },
        { id: 32, name: 'Группа 2', groupSet: null },
      ],
      isLoading: false,
    });
    classStudents.mockReturnValue({
      data: {
        content: [
          { id: 7, lastName: 'Абдиров', firstName: 'Дамир', middleName: null },
          { id: 8, lastName: 'Бекмуратова', firstName: 'Аяна', middleName: 'Ерланқызы' },
        ],
      },
      isLoading: false,
    });
    journalHook.mockReturnValue({ data: journal(), isLoading: false, isError: false, refetch: vi.fn() });
    unfilledHook.mockReturnValue({
      data: { content: unfilled(), totalPages: 1 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  /**
   * Таблицы «ученики × уроки» без класса не существует, поэтому запрос не уходит вовсе:
   * спросить её значит получить отказ вместо данных.
   */
  it('без класса журнал не запрашивается', () => {
    renderPage();

    expect(journalHook).toHaveBeenCalledWith(null);
    expect(screen.getByText('Класс не выбран')).toBeInTheDocument();
  });

  it('фильтры уходят в запрос, а не отбирают строки на клиенте', () => {
    renderPage(
      '/attendance?classId=11&month=2026-09&subgroupId=31&subjectId=4&teacherId=2&studentId=7' +
        '&status=ABSENT&reason=ILLNESS',
    );

    expect(journalHook).toHaveBeenCalledWith({
      month: '2026-09',
      classId: 11,
      subgroupId: 31,
      subjectId: 4,
      teacherProfileId: 2,
      studentProfileId: 7,
      status: 'ABSENT',
      reason: 'ILLNESS',
    });
  });

  it('учитель и ученик выбираются фамилией с инициалами', async () => {
    const user = userEvent.setup();
    renderPage('/attendance?classId=11');

    await user.click(screen.getByRole('button', { name: 'Учитель' }));
    await user.click(screen.getByRole('option', { name: 'Искаков А.М.' }));
    expect(journalHook).toHaveBeenLastCalledWith(
      expect.objectContaining({ teacherProfileId: 2 }),
    );

    await user.click(screen.getByRole('button', { name: 'Ученик' }));
    await user.click(screen.getByRole('option', { name: 'Бекмуратова А.Е.' }));
    expect(journalHook).toHaveBeenLastCalledWith(
      expect.objectContaining({ teacherProfileId: 2, studentProfileId: 8 }),
    );
  });

  /**
   * Ученики и подгруппы берутся из класса, поэтому смена класса роняет обоих: иначе
   * журнал 5«Б» молча фильтровался бы по сущностям 5«А» и всегда оставался пустым.
   */
  it('смена класса сбрасывает выбранных ученика и подгруппу', async () => {
    const user = userEvent.setup();
    renderPage('/attendance?classId=11&studentId=7&subgroupId=31');

    await user.click(screen.getByRole('button', { name: 'Класс' }));
    await user.click(screen.getByRole('option', { name: '5 «Б»' }));

    expect(journalHook).toHaveBeenLastCalledWith(
      expect.objectContaining({ classId: 12, studentProfileId: null, subgroupId: null }),
    );
  });

  it('подгруппа подписана своим делением и выбирается в запрос', async () => {
    const user = userEvent.setup();
    renderPage('/attendance?classId=11');

    await user.click(screen.getByRole('button', { name: 'Подгруппа' }));
    // Имя «Группа 1» само по себе не говорит, какого оно деления, а делений бывает
    // несколько; у подгруппы без набора остаётся одно имя.
    expect(screen.getByRole('option', { name: 'Группа 2' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Группа 1 · Английский' }));

    expect(journalHook).toHaveBeenLastCalledWith(expect.objectContaining({ subgroupId: 31 }));
  });

  it('класс без делений говорит об этом, а не выглядит сломанным фильтром', () => {
    classSubgroups.mockReturnValue({ data: [], isLoading: false });
    renderPage('/attendance?classId=11');

    const subgroup = screen.getByRole('button', { name: 'Подгруппа' });
    expect(subgroup).toBeDisabled();
    expect(subgroup).toHaveTextContent('Делений нет');
  });

  it('без класса ученика выбрать нельзя — список у него классовый', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Ученик' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Подгруппа' })).toHaveTextContent('Сначала класс');
    expect(classStudents).toHaveBeenCalledWith(3, null);
  });

  it('месяц по умолчанию берётся из границ учебного года', async () => {
    const user = userEvent.setup();
    renderPage('/attendance?classId=11');

    // Сентябрь — первый месяц года, он же и подставлен без параметра в адресе.
    expect(journalHook).toHaveBeenCalledWith(expect.objectContaining({ month: '2026-09' }));

    await user.click(screen.getByRole('button', { name: 'Месяц' }));
    expect(screen.getByRole('option', { name: 'Сентябрь 2026' })).toBeInTheDocument();
    // Год кончается в мае — июня в списке нет.
    expect(screen.queryByRole('option', { name: 'Июнь 2027' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Октябрь 2026' }));
    expect(journalHook).toHaveBeenLastCalledWith(
      expect.objectContaining({ month: '2026-10', classId: 11 }),
    );
  });

  it('клетка и заголовок столбца ведут в лист урока — правят отметку там', () => {
    renderPage('/attendance?classId=11');

    const links = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href?.includes('/lessons/'));

    expect(links).toContain('/lesson-schedule/lessons/51/attendance');
    expect(links).toContain('/lesson-schedule/lessons/52/attendance');
  });

  it('сводка показывается как пришла — экран ничего не пересчитывает', () => {
    renderPage('/attendance?classId=11');

    expect(screen.getByText('Заполнено').parentElement).toHaveTextContent('1');
    // «Не заполнено» — и цифра в сводке, и состояние листа в шапке столбца: сводка
    // берётся именно из сводки, а не из первого попавшегося совпадения текста.
    const summaryUnfilled = screen
      .getAllByText('Не заполнено')
      .map((node) => node.parentElement)
      .find((node) => node?.className.includes('flex-col'));
    expect(summaryUnfilled).toHaveTextContent('1');
    expect(screen.getByText(/Болезнь/)).toBeInTheDocument();
  });

  /**
   * Регрессия: ученик попадает в журнал вместе со своей отметкой, поэтому у месяца, где
   * ничего не заполняли, `rows` пуст при непустых `lessons`. Спрятать за этим сводку —
   * значит спрятать «124 урока не заполнено», ради чего экран и открывают.
   */
  it('месяц без единой отметки показывает сводку, а не «данных нет»', () => {
    journalHook.mockReturnValue({
      data: journal({ rows: [], summary: { ...journal().summary, filledCount: 0, unfilledCount: 2 } }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage('/attendance?classId=11');

    expect(screen.getByText('Ни один урок месяца не отмечен')).toBeInTheDocument();
    expect(screen.getByText('Уроков').parentElement).toHaveTextContent('2');
  });

  it('месяц без уроков — другой случай, и говорит он другое', () => {
    journalHook.mockReturnValue({
      data: journal({ lessons: [], rows: [] }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage('/attendance?classId=11');

    expect(screen.getByText('За этот месяц уроков нет')).toBeInTheDocument();
  });

  it('вкладка незаполненных уроков живёт в адресе и класс ей не обязателен', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Незаполненные уроки' }));

    expect(unfilledHook).toHaveBeenLastCalledWith(
      expect.objectContaining({ classId: null, page: 0 }),
    );
    expect(screen.getByText('Математика')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть →' })).toHaveAttribute(
      'href',
      '/lesson-schedule/lessons/52/attendance',
    );
  });

  it('пустой список незакрытых уроков — это хорошая новость, а не ошибка', async () => {
    const user = userEvent.setup();
    unfilledHook.mockReturnValue({
      data: { content: [], totalPages: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Незаполненные уроки' }));

    expect(screen.getByText('Незаполненных уроков нет')).toBeInTheDocument();
  });
});
