import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonSchedulePage } from './LessonSchedulePage';
import { ScheduleBreadcrumbs } from './schedule/ScheduleBreadcrumbs';
import type { ClassSchedule } from '@/platform/services';

const mocks = vi.hoisted(() => ({
  email: 'admin-a',
  listAcademicYears: vi.fn(), listPeriods: vi.fn(), listClasses: vi.fn(), listSchedules: vi.fn(),
  getSchedule: vi.fn(), getScheduleGrid: vi.fn(), listScheduleHistory: vi.fn(), getConstructorContext: vi.fn(),
  listBellTemplates: vi.fn(), getWorkingDays: vi.fn(), listAvailabilitySummaries: vi.fn(), listGroupSets: vi.fn(),
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ admin: { email: mocks.email } }) }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => mocks.toast }));
vi.mock('@/platform/services', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/platform/services')>(),
  ...mocks,
}));
vi.mock('@/lib/scheduleSettingsApi', () => ({ scheduleSettingsApi: {
  listBellTemplates: mocks.listBellTemplates,
  getWorkingDays: mocks.getWorkingDays,
} }));
vi.mock('@/lib/schedule2bApi', () => ({
  subgroupsApi: { listGroupSets: mocks.listGroupSets },
  teacherAvailabilityApi: { listSummaries: mocks.listAvailabilitySummaries },
}));
vi.mock('./schedule/LessonHorizonCard', () => ({ LessonHorizonCard: () => null }));

const SOURCE = '/lesson-schedule?year=2&periodId=22&classId=4&scheduleId=402';
const years = [{ id: '1', name: '2026/2027', status: 'ACTIVE' }, { id: '2', name: '2027/2028', status: 'PLANNED' }];
const periods = [{ id: '21', name: 'Первый период' }, { id: '22', name: 'Второй период' }];
const classes = [{ id: '1', name: '5А' }, { id: '4', name: '6Б' }];
const makeSchedule = (id: number, classId: number, status: ClassSchedule['status']): ClassSchedule => ({
  id, classId, academicYearId: 2, academicPeriodId: 22, status, current: status === 'PUBLISHED',
  bellTemplateId: 7, bellTemplateName: 'Звонки', version: 1, copiedFromScheduleId: null,
  createdAt: '', updatedAt: '', publishedAt: null,
});
const schedules = [makeSchedule(101, 1, 'DRAFT'), makeSchedule(401, 4, 'DRAFT'), makeSchedule(402, 4, 'PUBLISHED')];
const clients: QueryClient[] = [];

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="url">{location.pathname}{location.search}</output>
    <button onClick={() => navigate(-1)}>Browser Back</button>
    <button onClick={() => navigate(1)}>Browser Forward</button>
    <Link to="/elsewhere">Другой раздел</Link>
    <Link to="/lesson-schedule">Расписание в меню</Link>
  </>;
}

function renderPage(url = SOURCE) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}>
    <Navigation />
    <Routes>
      <Route path="/lesson-schedule" element={<LessonSchedulePage />} />
      <Route path="/lesson-schedule/:setting" element={<ScheduleBreadcrumbs current="Настройка" />} />
      <Route path="/elsewhere" element={<p>Другой экран</p>} />
    </Routes>
  </MemoryRouter></QueryClientProvider>);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function gridFor(schedule: ClassSchedule) {
  return {
    schedule,
    weekdays: [],
    periods: [{
      id: schedule.bellTemplateId,
      bellTemplateId: schedule.bellTemplateId,
      lessonNumber: 1,
      startTime: '08:00',
      endTime: '08:45',
      sortOrder: 1,
    }],
    lessons: [],
  };
}

async function expectSelection(className = '6Б', scheduleId = 402) {
  await screen.findByRole('button', { name: '2027/2028' });
  await screen.findByRole('button', { name: 'Второй период' });
  await screen.findByRole('button', { name: className });
  await waitFor(() => expect(mocks.getSchedule).toHaveBeenLastCalledWith(scheduleId));
  await waitFor(() => expect(screen.getByTestId('url').textContent).toContain(`scheduleId=${scheduleId}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.email = 'admin-a';
  mocks.listAcademicYears.mockResolvedValue(years);
  mocks.listPeriods.mockResolvedValue(periods);
  mocks.listClasses.mockResolvedValue(classes);
  mocks.listBellTemplates.mockResolvedValue({ content: [] });
  mocks.getWorkingDays.mockResolvedValue({ source: 'DEFAULT' });
  mocks.listAvailabilitySummaries.mockResolvedValue({ totalElements: 0 });
  mocks.listGroupSets.mockResolvedValue([]);
  mocks.listSchedules.mockImplementation(async (params: { academicYearId: number; academicPeriodId?: number; classId?: number }) => schedules
    .filter((s) => !params.classId || s.classId === params.classId)
    .map((s) => ({ ...s, academicYearId: params.academicYearId, academicPeriodId: params.academicPeriodId ?? 21 })));
  mocks.getSchedule.mockImplementation(async (id: number) => schedules.find((s) => s.id === id));
  mocks.getScheduleGrid.mockImplementation(async (id: number) => ({ schedule: schedules.find((s) => s.id === id), weekdays: [], periods: [], lessons: [] }));
  mocks.listScheduleHistory.mockResolvedValue([]);
  mocks.getConstructorContext.mockResolvedValue({ periods: [], classes: [], subjects: [], teachers: [], weekdays: [] });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  sessionStorage.clear();
});

describe('LessonSchedulePage · navigation context', () => {
  it('shows a retryable initial error when academic years cannot load, then resumes the full flow', async () => {
    const user = userEvent.setup();
    mocks.listAcademicYears.mockRejectedValueOnce(new Error('API unavailable'));
    renderPage();

    expect(await screen.findByText(/Не удалось загрузить учебные годы/)).toBeInTheDocument();
    expect(screen.queryByText('Загрузка…')).not.toBeInTheDocument();
    expect(screen.queryByText('Нет шаблонов')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
    expect(mocks.listAcademicYears).toHaveBeenCalledTimes(2);
    expect(mocks.listPeriods).toHaveBeenCalledTimes(1);
    expect(mocks.listSchedules).toHaveBeenCalled();
  });

  it('shows and retries metadata failures without showing false empty states', async () => {
    const user = userEvent.setup();
    mocks.listPeriods.mockRejectedValueOnce(new Error('periods unavailable'));
    mocks.getWorkingDays.mockRejectedValueOnce(new Error('calendar unavailable'));
    renderPage();

    expect(await screen.findByText(/Не удалось загрузить периоды, классы и шаблоны звонков/)).toBeInTheDocument();
    expect(screen.queryByText('Загрузка…')).not.toBeInTheDocument();
    expect(screen.queryByText('Нет шаблонов')).not.toBeInTheDocument();
    expect(screen.queryByText('По умолчанию')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
    expect(mocks.listPeriods).toHaveBeenCalledTimes(2);
    expect(mocks.listClasses).toHaveBeenCalledTimes(2);
    expect(mocks.listBellTemplates).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state when no academic years exist', async () => {
    mocks.listAcademicYears.mockResolvedValueOnce([]);
    renderPage('/lesson-schedule');

    expect(await screen.findByText('Учебные годы не найдены')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть учебные годы' })).toHaveAttribute('href', '/admin/academic-year');
    expect(screen.queryByText(/Загружаем/)).not.toBeInTheDocument();
    expect(screen.queryByText('Нет шаблонов')).not.toBeInTheDocument();
    expect(screen.queryByText('По умолчанию')).not.toBeInTheDocument();
  });

  it('retries the schedule list after its own initial request fails', async () => {
    const user = userEvent.setup();
    mocks.listSchedules.mockRejectedValueOnce(new Error('schedule list unavailable'));
    renderPage();

    expect(await screen.findByText(/Не удалось загрузить расписание/)).toBeInTheDocument();
    expect(screen.queryByText('Загрузка…')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
    expect(mocks.listSchedules).toHaveBeenCalledTimes(2);
  });

  it('uses loading badges instead of claiming settings are empty or default', async () => {
    const pendingPeriods = deferred<typeof periods>();
    const pendingClasses = deferred<typeof classes>();
    const pendingTemplates = deferred<{ content: never[] }>();
    mocks.listPeriods.mockReturnValueOnce(pendingPeriods.promise);
    mocks.listClasses.mockReturnValueOnce(pendingClasses.promise);
    mocks.listBellTemplates.mockReturnValueOnce(pendingTemplates.promise);
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Загрузка').length).toBeGreaterThanOrEqual(1));
    expect(screen.queryByText('Нет шаблонов')).not.toBeInTheDocument();

    await act(async () => {
      pendingPeriods.resolve(periods);
      pendingClasses.resolve(classes);
      pendingTemplates.resolve({ content: [] });
    });
    expect(await screen.findByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
  });

  it('marks failed settings summaries and subgroup requests in their own badges', async () => {
    mocks.getWorkingDays.mockRejectedValueOnce(new Error('calendar unavailable'));
    mocks.listGroupSets.mockRejectedValueOnce(new Error('groups unavailable'));
    renderPage();

    const calendarCard = await screen.findByRole('link', { name: /Школьный календарь/ });
    const teachersCard = screen.getByRole('link', { name: /Занятость учителей/ });
    const groupsCard = screen.getByRole('link', { name: /Подгруппы классов/ });

    await waitFor(() => {
      expect(within(calendarCard).getByText('Не удалось загрузить')).toBeInTheDocument();
      expect(within(teachersCard).getByText('Не удалось загрузить')).toBeInTheDocument();
      expect(within(groupsCard).getByText('Не удалось загрузить')).toBeInTheDocument();
    });
  });

  it('changes year, period, and class with the keyboard only', async () => {
    const user = userEvent.setup();
    renderPage('/lesson-schedule?year=2&periodId=22&classId=1');

    const year = await screen.findByRole('button', { name: '2027/2028' });
    year.focus();
    await user.keyboard('{Enter}{ArrowUp}{Enter}');
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('year=1'));

    const period = await screen.findByRole('button', { name: 'Первый период' });
    period.focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('periodId=22'));

    const schoolClass = await screen.findByRole('button', { name: '5А' });
    schoolClass.focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('classId=4'));
    expect(await screen.findByRole('button', { name: '6Б' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.listSchedules).toHaveBeenLastCalledWith({
      academicYearId: 1,
      academicPeriodId: 22,
      classId: 4,
    }));
  });

  it('keeps year, period, class and detail response aligned through A→B→A', async () => {
    const user = userEvent.setup();
    const delayedA = deferred<ClassSchedule>();
    const staleA = { ...makeSchedule(701, 7, 'DRAFT'), academicYearId: 1, academicPeriodId: 11, bellTemplateName: 'Устаревшее расписание A' };
    const currentA = { ...staleA, bellTemplateName: 'Актуальное расписание A' };
    const scheduleB = { ...makeSchedule(801, 8, 'DRAFT'), academicYearId: 2, academicPeriodId: 22, bellTemplateName: 'Расписание B' };
    let aDetailCalls = 0;

    mocks.listPeriods.mockImplementation(async (yearId: string) => yearId === '1'
      ? [{ id: '11', name: 'Период A' }]
      : [{ id: '22', name: 'Период B' }]);
    mocks.listClasses.mockImplementation(async ({ academicYearId }: { academicYearId: string }) => academicYearId === '1'
      ? [{ id: '7', name: 'Класс A' }]
      : [{ id: '8', name: 'Класс B' }]);
    mocks.listSchedules.mockImplementation(async ({ academicYearId }: { academicYearId: number }) =>
      academicYearId === 1 ? [staleA] : [scheduleB]);
    mocks.getSchedule.mockImplementation(async (id: number) => {
      if (id === 701) {
        aDetailCalls += 1;
        return aDetailCalls === 1 ? delayedA.promise : currentA;
      }
      return scheduleB;
    });
    mocks.getScheduleGrid.mockImplementation(async (id: number) => gridFor(id === 701
      ? (aDetailCalls === 1 ? staleA : currentA)
      : scheduleB));
    renderPage('/lesson-schedule?year=1&periodId=11&classId=7&scheduleId=701');
    await waitFor(() => expect(mocks.getSchedule).toHaveBeenCalledWith(701));

    await user.click(screen.getByRole('button', { name: '2026/2027' }));
    await user.click(screen.getByRole('option', { name: '2027/2028' }));
    expect(await screen.findByText('Расписание B')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('year=2&periodId=22&classId=8');
    expect(mocks.listSchedules).toHaveBeenLastCalledWith({ academicYearId: 2, academicPeriodId: 22, classId: 8 });

    await user.click(screen.getByRole('button', { name: '2027/2028' }));
    await user.click(screen.getByRole('option', { name: '2026/2027' }));
    expect(await screen.findByText('Актуальное расписание A')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('year=1&periodId=11&classId=7');
    expect(mocks.getConstructorContext).toHaveBeenLastCalledWith({
      academicYearId: 1,
      classId: 7,
      academicPeriodId: 11,
    });

    await act(async () => { delayedA.resolve(staleA); });
    expect(screen.getByText('Актуальное расписание A')).toBeInTheDocument();
    expect(screen.queryByText('Устаревшее расписание A')).not.toBeInTheDocument();
  });

  it('ignores an old schedule-list response when the same year is selected again', async () => {
    const user = userEvent.setup();
    const delayedListA = deferred<ClassSchedule[]>();
    const scheduleA = { ...makeSchedule(701, 7, 'DRAFT'), academicYearId: 1, academicPeriodId: 11, bellTemplateName: 'Расписание A' };
    const staleVersionA = { ...makeSchedule(702, 7, 'PUBLISHED'), academicYearId: 1, academicPeriodId: 11 };
    const scheduleB = { ...makeSchedule(801, 8, 'DRAFT'), academicYearId: 2, academicPeriodId: 22, bellTemplateName: 'Расписание B' };
    let aListCalls = 0;

    mocks.listPeriods.mockImplementation(async (yearId: string) => yearId === '1'
      ? [{ id: '11', name: 'Период A' }]
      : [{ id: '22', name: 'Период B' }]);
    mocks.listClasses.mockImplementation(async ({ academicYearId }: { academicYearId: string }) => academicYearId === '1'
      ? [{ id: '7', name: 'Класс A' }]
      : [{ id: '8', name: 'Класс B' }]);
    mocks.listSchedules.mockImplementation(async ({ academicYearId }: { academicYearId: number }) => {
      if (academicYearId === 1) {
        aListCalls += 1;
        return aListCalls === 1 ? delayedListA.promise : [scheduleA];
      }
      return [scheduleB];
    });
    mocks.getSchedule.mockImplementation(async (id: number) => id === 701 ? scheduleA : scheduleB);
    mocks.getScheduleGrid.mockImplementation(async (id: number) => gridFor(id === 701 ? scheduleA : scheduleB));
    renderPage('/lesson-schedule?year=1&periodId=11&classId=7&scheduleId=701');
    await waitFor(() => expect(mocks.listSchedules).toHaveBeenCalledWith({
      academicYearId: 1,
      academicPeriodId: 11,
      classId: 7,
    }));

    await user.click(screen.getByRole('button', { name: '2026/2027' }));
    await user.click(screen.getByRole('option', { name: '2027/2028' }));
    expect(await screen.findByText('Расписание B')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '2027/2028' }));
    await user.click(screen.getByRole('option', { name: '2026/2027' }));
    expect(await screen.findByText('Расписание A')).toBeInTheDocument();
    expect(aListCalls).toBe(2);

    await act(async () => { delayedListA.resolve([scheduleA, staleVersionA]); });
    expect(screen.queryByRole('button', { name: 'Опубликовано' })).not.toBeInTheDocument();
    expect(screen.getByText('Расписание A')).toBeInTheDocument();
  });

  it('ignores detail results after the schedule screen unmounts', async () => {
    const delayedDetail = deferred<ClassSchedule>();
    mocks.getSchedule.mockImplementation(async (id: number) => id === 402
      ? delayedDetail.promise
      : schedules.find((schedule) => schedule.id === id));
    const view = renderPage();
    await waitFor(() => expect(mocks.getSchedule).toHaveBeenCalledWith(402));

    view.unmount();
    await act(async () => { delayedDetail.resolve(schedules.find((schedule) => schedule.id === 402)!); });

    expect(mocks.getConstructorContext).not.toHaveBeenCalled();
  });

  it.each(['grid', 'history', 'context'] as const)('shows a retryable detail error when %s fails and hides stale actions', async (source) => {
    const user = userEvent.setup();
    renderPage();
    await expectSelection();
    await screen.findByRole('button', { name: 'Редактировать' });
    const failure = new Error(`Ошибка ${source}`);
    if (source === 'grid') mocks.getScheduleGrid.mockRejectedValueOnce(failure);
    else if (source === 'history') mocks.listScheduleHistory.mockRejectedValueOnce(failure);
    else mocks.getConstructorContext.mockRejectedValueOnce(failure);

    await user.click(screen.getByRole('button', { name: 'Черновик' }));
    expect(await screen.findByText(failure.message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Проверить' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
  });

  it('does not enable schedule actions when the constructor context response is empty', async () => {
    const user = userEvent.setup();
    renderPage();
    await expectSelection();
    await screen.findByRole('button', { name: 'Редактировать' });
    mocks.getConstructorContext.mockResolvedValueOnce(null);
    await user.click(screen.getByRole('button', { name: 'Черновик' }));

    expect(await screen.findByText('Контекст конструктора не загрузился. Повторите загрузку расписания.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Проверить' })).not.toBeInTheDocument();
  });

  it('rejects a grid whose schedule context differs from the selected detail', async () => {
    const user = userEvent.setup();
    renderPage();
    await expectSelection();
    await screen.findByRole('button', { name: 'Редактировать' });
    const mismatchedSchedule = { ...schedules.find((schedule) => schedule.id === 401)!, classId: 1 };
    mocks.getScheduleGrid.mockResolvedValueOnce(gridFor(mismatchedSchedule));

    await user.click(screen.getByRole('button', { name: 'Черновик' }));

    expect(await screen.findByText('Ответ сервера относится к другому контексту. Повторите загрузку расписания.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Проверить' })).not.toBeInTheDocument();
  });

  it.each(['Шаблоны звонков', 'Школьный календарь', 'Занятость учителей', 'Подгруппы классов', 'Загрузка из Excel'])('возвращает выбранную публикацию из «%s»', async (name) => {
    const user = userEvent.setup();
    renderPage();
    await expectSelection();
    await user.click(screen.getByRole('link', { name: new RegExp(`^${name}`) }));
    const back = screen.getByRole('link', { name: 'Расписание' });
    expect(back).toHaveAttribute('href', SOURCE);
    await user.click(back);
    await expectSelection();
    expect(screen.getByTestId('url')).toHaveTextContent(SOURCE);
    expect(await screen.findByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
  });

  it('после возврата из настройки открывает черновик в режиме просмотра', async () => {
    const user = userEvent.setup();
    renderPage(SOURCE.replace('402', '401'));
    await expectSelection('6Б', 401);
    await user.click(await screen.findByRole('button', { name: 'Редактировать' }));
    expect(screen.getByRole('button', { name: 'Проверить' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /^Подгруппы классов/ }));
    await user.click(screen.getByRole('link', { name: 'Расписание' }));
    await expectSelection('6Б', 401);
    expect(await screen.findByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Проверить' })).not.toBeInTheDocument();
  });

  it('восстанавливает фильтр и версию через Back/Forward', async () => {
    const user = userEvent.setup();
    renderPage();
    await expectSelection();
    await user.click(screen.getByRole('button', { name: '6Б' }));
    await user.click(screen.getByRole('option', { name: '5А' }));
    await expectSelection('5А', 101);
    await user.click(screen.getByRole('button', { name: 'Browser Back' }));
    await expectSelection();
    await user.click(screen.getByRole('button', { name: 'Browser Forward' }));
    await expectSelection('5А', 101);
  });

  it('запоминает ручное переключение версии и восстанавливает его через историю', async () => {
    const user = userEvent.setup();
    renderPage();
    await expectSelection();
    await user.click(screen.getByRole('button', { name: 'Черновик' }));
    await expectSelection('6Б', 401);
    await user.click(screen.getByRole('button', { name: 'Browser Back' }));
    await expectSelection('6Б', 402);
    await user.click(screen.getByRole('button', { name: 'Browser Forward' }));
    await expectSelection('6Б', 401);
  });

  it('восстанавливает прямую ссылку после нового монтирования без памяти раздела', async () => {
    const view = renderPage();
    await expectSelection();
    const url = screen.getByTestId('url').textContent!;
    view.unmount();
    sessionStorage.clear();
    renderPage(url);
    await expectSelection();
  });

  it('возвращает последнее состояние из меню, но явный URL имеет приоритет', async () => {
    const user = userEvent.setup();
    const view = renderPage();
    await expectSelection();
    await user.click(screen.getByRole('link', { name: 'Другой раздел' }));
    await user.click(screen.getByRole('link', { name: 'Расписание в меню' }));
    await expectSelection();
    view.unmount();
    renderPage('/lesson-schedule?year=2&periodId=22&classId=1');
    await expectSelection('5А', 101);
  });

  it('не переносит последнее состояние на другой аккаунт', async () => {
    const view = renderPage();
    await expectSelection();
    view.unmount();
    mocks.email = 'admin-b';
    renderPage('/lesson-schedule');
    await screen.findByRole('button', { name: '2026/2027' });
    await screen.findByRole('button', { name: 'Первый период' });
    await screen.findByRole('button', { name: '5А' });
    await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('classId=1'));
  });

  it('сбрасывает недоступную версию с объяснением', async () => {
    renderPage(SOURCE.replace('402', '999'));
    await expectSelection('6Б', 401);
    expect(mocks.toast.info).toHaveBeenCalledWith(expect.stringContaining('версия расписания недоступна'));
    expect(mocks.getSchedule).not.toHaveBeenCalledWith(999);
  });

  it('не запрашивает удалённый год, класс или период', async () => {
    renderPage('/lesson-schedule?year=999&periodId=999&classId=999&scheduleId=999');
    await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('year=1&periodId=21&classId=1'));
    expect(mocks.listPeriods).not.toHaveBeenCalledWith('999');
    expect(mocks.listSchedules).not.toHaveBeenCalledWith(expect.objectContaining({ classId: 999 }));
    expect(mocks.toast.info).toHaveBeenCalledWith(expect.stringContaining('учебный год недоступен'));
  });

  it('проверяет класс и период внутри выбранного года до загрузки списка', async () => {
    renderPage('/lesson-schedule?year=2&periodId=999&classId=999');
    await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('year=2&periodId=21&classId=1'));
    expect(mocks.listSchedules).not.toHaveBeenCalledWith(expect.objectContaining({ academicPeriodId: 999 }));
    expect(mocks.toast.info).toHaveBeenCalledWith(expect.stringContaining('период или класс недоступен'));
  });

  it('сохраняет явно очищенный класс вместо автоматического выбора первого', async () => {
    const user = userEvent.setup();
    renderPage();
    await expectSelection();
    await user.click(screen.getByRole('button', { name: '6Б' }));
    await user.click(screen.getByRole('option', { name: 'Класс' }));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('/lesson-schedule?year=2&periodId=22&classId='));
    expect(screen.getByRole('button', { name: 'Класс' })).toBeInTheDocument();
  });
});
