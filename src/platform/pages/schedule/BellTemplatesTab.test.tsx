import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ToastProvider } from '@/context/ToastContext';
import { BellTemplatesTab } from './BellTemplatesTab';

const updateBellTemplate = vi.fn();

vi.mock('@/lib/scheduleSettingsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/scheduleSettingsApi')>();
  return {
    ...actual,
    scheduleSettingsApi: {
      updateBellTemplate: (...args: unknown[]) => updateBellTemplate(...args),
      addPeriod: vi.fn(),
      updatePeriod: vi.fn(),
      deletePeriod: vi.fn(),
      createBellTemplate: vi.fn(),
      copyBellTemplate: vi.fn(),
    },
  };
});

const TEMPLATE = {
  id: 7,
  academicYearId: 1,
  name: 'Первая смена',
  description: null,
  status: 'ACTIVE',
  periods: [
    { id: 71, bellTemplateId: 7, lessonNumber: 1, startTime: '07:45:00', endTime: '08:25:00', sortOrder: 0 },
  ],
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
};

const USAGE = { draftSchedules: 2, publishedSchedules: 3, isUsed: true, hasPublished: true };

vi.mock('@/platform/hooks/useScheduleSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/hooks/useScheduleSettings')>();
  return {
    ...actual,
    useBellTemplates: () => ({ data: { content: [TEMPLATE] }, isLoading: false, error: null }),
    useBellTemplate: () => ({ data: TEMPLATE, isLoading: false, error: null }),
    useTemplateUsage: () => ({ data: USAGE, isLoading: false, error: null }),
    useManyTemplateBindings: () => [{ data: [] }],
  };
});

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <BellTemplatesTab yearId={1} />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function startRename(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: 'Редактировать' }));
  const input = screen.getByDisplayValue('Первая смена');
  await user.clear(input);
  await user.type(input, name);
  // Сохранение по уходу фокуса — как в самом экране.
  await user.click(document.body);
  return input;
}

function inUseError() {
  return new ApiError(
    409,
    'Bell template is used by published schedules; confirm impact to proceed',
    'BELL_TEMPLATE_IN_USE_PUBLISHED',
  );
}

describe('BellTemplatesTab · переименование', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateBellTemplate.mockResolvedValue({ ...TEMPLATE, name: 'Утро' });
  });

  it('обычное переименование уходит без подтверждения', async () => {
    const user = userEvent.setup();
    renderTab();
    await startRename(user, 'Утро');

    await waitFor(() => expect(updateBellTemplate).toHaveBeenCalledTimes(1));
    expect(updateBellTemplate).toHaveBeenCalledWith(7, { name: 'Утро', confirmImpact: false });
  });

  it('используемый шаблон спрашивает подтверждение, а не упирается в ошибку', async () => {
    updateBellTemplate.mockRejectedValueOnce(inUseError());
    const user = userEvent.setup();
    renderTab();
    await startRename(user, 'Утро');

    // Раньше здесь был красный тост и тупик: сервер требовал подтверждения,
    // а нажать его в интерфейсе было негде.
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/Этот шаблон используется в 5/)).toBeInTheDocument();
  });

  it('«Редактировать всё равно» повторяет запрос с подтверждением', async () => {
    updateBellTemplate.mockRejectedValueOnce(inUseError());
    const user = userEvent.setup();
    renderTab();
    await startRename(user, 'Утро');

    await user.click(await screen.findByRole('button', { name: 'Редактировать всё равно' }));

    await waitFor(() => expect(updateBellTemplate).toHaveBeenCalledTimes(2));
    expect(updateBellTemplate).toHaveBeenLastCalledWith(7, { name: 'Утро', confirmImpact: true });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('пока выбор не сделан, второй запрос не уходит', async () => {
    updateBellTemplate.mockRejectedValue(inUseError());
    const user = userEvent.setup();
    renderTab();
    await startRename(user, 'Утро');

    const dialog = await screen.findByRole('alertdialog');
    // Диалог предлагает ровно два выхода, и оба — решение человека.
    expect(within(dialog).getByRole('button', { name: 'Редактировать всё равно' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Создать копию' })).toBeVisible();
    expect(updateBellTemplate).toHaveBeenCalledTimes(1);
  });
});
