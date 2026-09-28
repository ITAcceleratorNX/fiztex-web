import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ admin: { email: mocks.email } }) }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => mocks.toast }));
vi.mock('@/platform/services', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/platform/services')>(),
  ...mocks,
}));
vi.mock('@/lib/scheduleSettingsApi', () => ({ scheduleSettingsApi: {
  listBellTemplates: async () => ({ content: [] }),
  getWorkingDays: async () => ({ source: 'DEFAULT' }),
} }));
vi.mock('@/lib/schedule2bApi', () => ({
  subgroupsApi: { listGroupSets: async () => [] },
  teacherAvailabilityApi: { listSummaries: async () => ({ totalElements: 0 }) },
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
