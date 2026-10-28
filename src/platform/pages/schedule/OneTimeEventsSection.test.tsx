import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { OneTimeEventsSection } from './OneTimeEventsSection';

const list = vi.fn();
const create = vi.fn();
const get = vi.fn();
const update = vi.fn();

vi.mock('@/lib/oneTimeEventsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/oneTimeEventsApi')>();
  return {
    ...actual,
    oneTimeEventsApi: {
      ...actual.oneTimeEventsApi,
      list: (...args: unknown[]) => list(...args),
      create: (...args: unknown[]) => create(...args),
      get: (...args: unknown[]) => get(...args),
      update: (...args: unknown[]) => update(...args),
    },
  };
});

vi.mock('@/platform/hooks/useScheduleSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/hooks/useScheduleSettings')>();
  return {
    ...actual,
    useSchoolClasses: () => ({
      data: { content: [{ id: 3, academicYearId: 1, name: '7А', grade: '7', letter: 'А' }] },
      isLoading: false,
    }),
  };
});

const assembly = {
  id: 9, title: 'Общешкольная линейка', date: '2026-11-02', startTime: '08:00:00', endTime: '09:15:00',
  audience: 'GRADE', grade: '7', status: 'ACTIVE', classes: [{ id: 3, name: '7А' }],
  impact: { classCount: 1, studentCount: 25, lessons: [] },
};

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider><OneTimeEventsSection yearId={1} /></ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** QA B3-008: разовое мероприятие со временем и охватом заводится и правится из школьного календаря. */
describe('OneTimeEventsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue({ content: [assembly], totalPages: 1 });
    get.mockResolvedValue(assembly);
  });

  it('lists the year’s events with date, time and audience', async () => {
    wrap();
    const row = await screen.findByRole('button', { name: /Общешкольная линейка/ });
    expect(within(row).getByText('08:00–09:15')).toBeInTheDocument();
    expect(within(row).getByText('Параллель 7')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ academicYearId: 1, status: 'ACTIVE' }), expect.anything());
  });

  it('creates an event with start, end and audience and then shows what the server saved', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(assembly);
    wrap();
    await user.click(await screen.findByRole('button', { name: '+ Разовое мероприятие' }));
    await user.type(screen.getByLabelText(/Название/), 'Общешкольная линейка');
    await user.type(screen.getByLabelText(/Начало/), '0800');
    await user.type(screen.getByLabelText(/Окончание/), '0915');
    await user.click(screen.getByRole('radio', { name: 'Параллель' }));
    // Выпадающий список у формы свой (кнопка + listbox), а не нативный <select>.
    await user.click(within(screen.getByRole('dialog', { name: /Новое разовое событие/ })).getByRole('button', { name: /Параллель/ }));
    await user.click(screen.getByRole('option', { name: /^7/ }));
    await user.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith(1, expect.objectContaining({
      startTime: '08:00', endTime: '09:15', audience: 'GRADE', grade: '7',
    })));
    await waitFor(() => expect(get).toHaveBeenCalledWith(9, expect.anything()));
  });

  it('edits the time of an existing event from its card', async () => {
    const user = userEvent.setup();
    update.mockResolvedValue({ ...assembly, endTime: '09:30:00' });
    wrap();
    await user.click(await screen.findByRole('button', { name: /Общешкольная линейка/ }));
    await user.click(await screen.findByRole('button', { name: /Изменить/ }));
    const end = screen.getByLabelText(/Окончание/);
    expect(end).toHaveValue('09:15');
    await user.clear(end);
    await user.type(end, '0930');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(9, expect.objectContaining({ startTime: '08:00', endTime: '09:30' })));
  });
});
