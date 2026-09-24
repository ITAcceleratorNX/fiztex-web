import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeacherJournal, TeacherJournalOptions } from '@/lib/attendanceApi';
import { AttendanceMonthPage } from './AttendanceMonthPage';
// Ответы живого бэкенда (учитель +77001000000, 5А, сентябрь 2026), урезанные до четырёх учеников:
// 01.09 все присутствуют, 02.09 Айгерим опоздала, 03.09 Айгуль пропустила и Нурай освобождена,
// 04.09 — черновик без публикации, остальные уроки месяца не заполнялись.
import liveJournal from './__fixtures__/teacherJournal5A.json';
import liveOptions from './__fixtures__/teacherJournalOptions.json';

const optionsHook = vi.fn();
const journalHook = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useTeacherJournalOptions: () => optionsHook(),
  useTeacherJournal: (...args: unknown[]) => journalHook(...args),
}));

const options = liveOptions as TeacherJournalOptions;
const journal = liveJournal as TeacherJournal;

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AttendanceMonthPage />
    </MemoryRouter>,
  );
}

function cellOf(studentName: string, day: string) {
  const row = screen.getByRole('rowheader', { name: studentName }).closest('tr') as HTMLElement;
  const header = screen.getAllByRole('columnheader');
  const index = header.findIndex((cell) => cell.textContent?.endsWith(day));
  return within(row).getAllByRole('cell')[index - 1];
}

describe('Посещаемость за месяц', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-24T21:00:00'));
    optionsHook.mockReturnValue({ data: options, isPending: false, isError: false });
    journalHook.mockReturnValue({ data: journal, isPending: false, isError: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('без выбранного класса — приглашение выбрать, и журнал не запрашивается', () => {
    renderAt('/my-attendance/month');

    expect(screen.getByText('Выберите класс и месяц, чтобы увидеть журнал посещаемости')).toBeInTheDocument();
    expect(journalHook).toHaveBeenLastCalledWith(null);
    // Месяц встаёт на текущий, раз он внутри учебного года.
    expect(screen.getByRole('button', { name: 'Месяц' })).toHaveTextContent('Сентябрь 2026');
  });

  it('класс из адреса — таблица «ученики × дни» с точками по опубликованному', () => {
    renderAt('/my-attendance/month?scope=1&month=2026-09');

    expect(journalHook).toHaveBeenLastCalledWith({ month: '2026-09', classId: 1, subgroupId: null });
    expect(screen.getAllByRole('columnheader')).toHaveLength(1 + 30);
    // Близнецы с одинаковыми инициалами различаются именем — на живых данных это не выдумка.
    expect(screen.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual([
      'Амангельдиева Айгерим М.',
      'Амангельдиева Айгуль М.',
      'Байтурсынова Н.Е.',
      'Бекмуратов А.Т.',
    ]);

    expect(cellOf('Амангельдиева Айгерим М.', '01')).toHaveTextContent('Присутствовал');
    expect(cellOf('Амангельдиева Айгерим М.', '02')).toHaveTextContent('Опоздал');
    expect(cellOf('Амангельдиева Айгуль М.', '03')).toHaveTextContent('Пропустил');
    expect(cellOf('Байтурсынова Н.Е.', '03')).toHaveTextContent('Освобождён');
    // Черновик учителя ученикам не виден — в журнале это «не опубликовано».
    expect(cellOf('Бекмуратов А.Т.', '04')).toHaveTextContent('Не опубликовано');
    // Выходной — пусто; будущий урок (после 24-го) — тоже пусто, долгом он не считается.
    expect(cellOf('Бекмуратов А.Т.', '05').textContent).toBe('');
    expect(cellOf('Бекмуратов А.Т.', '25').textContent).toBe('');
  });

  it('чужая пара в адресе не выбирается — вместо чужого журнала приглашение', () => {
    renderAt('/my-attendance/month?scope=999');
    expect(screen.getByText('Выберите класс и месяц, чтобы увидеть журнал посещаемости')).toBeInTheDocument();
    expect(journalHook).toHaveBeenLastCalledWith(null);
  });

  it('месяц без уроков — сказано прямо', () => {
    journalHook.mockReturnValue({ data: { month: '2026-10', lessons: [], students: [] }, isPending: false, isError: false });
    renderAt('/my-attendance/month?scope=2&month=2026-10');
    expect(screen.getByText('В этом месяце у вас не было уроков в этом классе')).toBeInTheDocument();
  });

  it('ошибка журнала — сообщение и «Повторить»', () => {
    const refetch = vi.fn();
    journalHook.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch });
    renderAt('/my-attendance/month?scope=1&month=2026-09');
    expect(screen.getByText('Не удалось загрузить журнал')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Повторить' }).click();
    expect(refetch).toHaveBeenCalled();
  });
});
