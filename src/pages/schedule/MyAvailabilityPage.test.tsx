import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyTeacherAvailability, TeacherAvailabilityProposal } from '@/lib/schedule2bTypes';
import { MyAvailabilityPage } from './MyAvailabilityPage';

const useMyAvailability = vi.fn();
const submit = vi.fn();
const withdraw = vi.fn();
const error = vi.fn();

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), success: vi.fn(), error: (...args: unknown[]) => error(...args), info: vi.fn() }),
}));

vi.mock('@/platform/hooks/useTeacherAvailability', () => ({
  useMyAvailability: () => useMyAvailability(),
  useSubmitAvailabilityProposal: () => ({ mutateAsync: submit, isPending: false }),
  useWithdrawAvailabilityProposal: () => ({ mutateAsync: withdraw, isPending: false }),
}));

function proposal(overrides: Partial<TeacherAvailabilityProposal> = {}): TeacherAvailabilityProposal {
  return {
    id: 4,
    teacherId: 7,
    status: 'PENDING',
    workingDays: ['MONDAY', 'TUESDAY'],
    preferredShift: 'SECOND',
    intervals: [
      { dayOfWeek: 'MONDAY', startTime: '09:00:00', endTime: '14:00:00', type: 'AVAILABLE' },
    ],
    teacherComment: 'Прошу вторую смену',
    decisionComment: null,
    submittedAt: '2026-09-01T08:00:00Z',
    decidedBy: null,
    decidedAt: null,
    ...overrides,
  };
}

function view(overrides: Partial<MyTeacherAvailability> = {}): MyTeacherAvailability {
  return {
    availability: {
      teacherId: 7,
      exists: true,
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY'],
      preferredShift: null,
      status: 'APPROVED',
      approvedBy: 1,
      approvedAt: '2026-08-20T10:00:00Z',
      version: 3,
      intervals: [
        { id: 1, dayOfWeek: 'MONDAY', startTime: '08:00:00', endTime: '16:00:00', type: 'AVAILABLE' },
      ],
      pendingProposal: null,
    },
    lastDecision: null,
    canSubmit: true,
    ...overrides,
  };
}

function renderPage(data: MyTeacherAvailability) {
  useMyAvailability.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });
  render(<MyAvailabilityPage />);
}

describe('MyAvailabilityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submit.mockResolvedValue(view());
    withdraw.mockResolvedValue(view());
  });

  it('отправляет заявку, а не правит занятость: в теле нет version', async () => {
    const user = userEvent.setup();
    renderPage(view());

    await user.click(screen.getByRole('button', { name: 'Изменить рабочее время' }));
    await user.click(screen.getByRole('button', { name: 'Четверг' }));
    await user.click(screen.getByRole('button', { name: 'Отправить на согласование' }));

    expect(submit).toHaveBeenCalledTimes(1);
    const body = submit.mock.calls[0]![0] as Record<string, unknown>;
    // Версии в теле нет: заявка ничего не перезаписывает, и передавать её было бы
    // обещанием, что учитель правит утверждённые часы.
    expect(body).not.toHaveProperty('version');
    expect(body.workingDays).toEqual(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']);
  });

  it('рабочий день с интервалами не снимается молча', async () => {
    const user = userEvent.setup();
    renderPage(view());

    await user.click(screen.getByRole('button', { name: 'Изменить рабочее время' }));
    await user.click(screen.getByRole('button', { name: 'Понедельник' }));

    // То же правило В5, что и на бэкенде: интервал не может остаться вне рабочих дней.
    expect(screen.getByText('Сначала удалите интервалы этого дня')).toBeInTheDocument();
  });

  it('заявка на рассмотрении видна учителю и её можно отозвать', async () => {
    const user = userEvent.setup();
    const pending = proposal();
    renderPage(view({ availability: { ...view().availability, pendingProposal: pending } }));

    expect(screen.getByText('Заявка на рассмотрении')).toBeInTheDocument();
    expect(screen.getByText(/Прошу вторую смену/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Отозвать заявку' }));
    expect(withdraw).toHaveBeenCalledTimes(1);
  });

  /**
   * Причина отказа — единственное, что учитель получает обратно: без неё он отправит
   * ту же заявку снова.
   */
  it('показывает причину отказа, пока новой заявки нет', () => {
    renderPage(
      view({
        lastDecision: proposal({
          status: 'REJECTED',
          decisionComment: 'Вторник занят другим предметом',
          decidedAt: '2026-09-02T09:00:00Z',
        }),
      }),
    );

    expect(screen.getByText('Прошлая заявка отклонена')).toBeInTheDocument();
    expect(screen.getByText(/Вторник занят другим предметом/)).toBeInTheDocument();
  });

  it('правка продолжается с заявки, а не с утверждённых часов', async () => {
    const user = userEvent.setup();
    renderPage(view({ availability: { ...view().availability, pendingProposal: proposal() } }));

    await user.click(screen.getByRole('button', { name: 'Изменить заявку' }));
    await user.click(screen.getByRole('button', { name: 'Четверг' }));
    await user.click(screen.getByRole('button', { name: 'Отправить на согласование' }));

    // Утверждено Пн–Ср, в заявке Пн–Вт: со среды продолжила бы правка не того состояния.
    const body = submit.mock.calls[0]![0] as Record<string, unknown>;
    expect(body.workingDays).toEqual(['MONDAY', 'TUESDAY', 'THURSDAY']);
    expect(body.comment).toBe('Прошу вторую смену');
  });

  it('архивной карточке отправлять нечего — считает бэкенд, не экран', () => {
    renderPage(view({ canSubmit: false }));

    expect(screen.getByRole('button', { name: 'Изменить рабочее время' })).toBeDisabled();
    expect(screen.getByText(/Карточка учителя в архиве/)).toBeInTheDocument();
  });

  it('не даёт отправить черновик, который бэкенд отвергнет', async () => {
    const user = userEvent.setup();
    renderPage(view());

    await user.click(screen.getByRole('button', { name: 'Изменить рабочее время' }));
    // Второй AVAILABLE поверх существующего 08:00–16:00 — пересечение одного типа (В3).
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(screen.getAllByText('Пересечение с другим интервалом того же типа').length)
      .toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Отправить на согласование' }));
    expect(submit).not.toHaveBeenCalled();
  });
});
