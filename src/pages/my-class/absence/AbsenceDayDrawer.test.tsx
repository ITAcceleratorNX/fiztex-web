import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import type { AbsenceDay } from '@/lib/absenceReasonModel';
import { AbsenceDayDrawer } from './AbsenceDayDrawer';

const mutateAsync = vi.fn();
const refetch = vi.fn();
let day: AbsenceDay;

vi.mock('@/hooks/absenceReasonQueries', () => ({
  useMyClassAbsenceDay: () => ({ data: day, isPending: false, isError: false, refetch }),
  useAbsenceDayCommand: () => ({ mutateAsync, isPending: false }),
}));

const LESSONS = [
  { lessonId: 1, subjectName: 'Казахский язык', startTime: '08:00:00', teacherName: 'Абенова С.Т.' },
  { lessonId: 2, subjectName: 'Математика', startTime: '09:50:00', teacherName: 'Демо М.' },
  { lessonId: 3, subjectName: 'Физкультура', startTime: '11:40:00', teacherName: 'Ким Д.В.' },
];

function baseDay(overrides: Partial<AbsenceDay> = {}): AbsenceDay {
  return {
    studentProfileId: 89,
    studentName: 'Жумабаев Ерасыл',
    date: '2026-11-17',
    status: 'NOT_SPECIFIED',
    version: undefined,
    absentLessons: LESSONS,
    guardians: [{ parentProfileId: 7, parentName: 'Жумабаева Гульнара', reachable: true, relationType: 'MOTHER' }],
    responses: [],
    requests: [],
    history: [],
    pendingResponseCount: 0,
    actions: { canSetReason: true, canRequestParent: true, canConfirmResponses: false, canRejectResponses: false },
    ...overrides,
  };
}

function renderDrawer() {
  return render(
    <AbsenceDayDrawer classId={5} className="5А класс" studentProfileId={89} date="2026-11-17" onClose={() => {}} />,
  );
}

describe('AbsenceDayDrawer', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    refetch.mockReset();
  });

  it('shows the day, its lessons and parents and offers to ask or set the reason (К3)', () => {
    day = baseDay();
    renderDrawer();
    expect(screen.getByText('Вторник, 17 ноября · 5А класс')).toBeInTheDocument();
    expect(screen.getByText('Не указана')).toBeInTheDocument();
    expect(screen.getByText('Пропущенные уроки · 3')).toBeInTheDocument();
    expect(screen.getByText('Абенова С.Т.')).toBeInTheDocument();
    expect(screen.getByText('· мама')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Запросить у родителя' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Указать причину' })).toBeEnabled();
  });

  it('disables the request when no parent is linked, but keeps setting the reason (К13)', () => {
    day = baseDay({
      guardians: [],
      actions: { canSetReason: true, canRequestParent: false, requestBlockedReason: 'NO_LINKED_PARENT' },
    });
    renderDrawer();
    expect(screen.getByText('Родитель не привязан к ученику')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Запросить у родителя' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Указать причину' })).toBeEnabled();
  });

  it('confirms the single parent answer with the version it was shown with (К7 → К8)', async () => {
    const response = {
      responseId: 41, parentName: 'Жумабаева Гульнара', parentRelationType: 'MOTHER' as const,
      reason: 'ILLNESS' as const, comment: 'Температура 38, были у врача.', status: 'PENDING' as const,
    };
    day = baseDay({
      status: 'AWAITING_CONFIRMATION', version: 3, pendingResponseCount: 1, responses: [response],
      actions: { canSetReason: true, canRequestParent: false, canConfirmResponses: true, canRejectResponses: true },
    });
    mutateAsync.mockResolvedValue({ ...day, status: 'CONFIRMED', absentLessons: LESSONS });
    renderDrawer();
    expect(screen.getByText('«Температура 38, были у врача.»')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));

    expect(mutateAsync).toHaveBeenCalledWith({ command: { kind: 'confirm', responseId: 41 }, version: 3 });
    expect(await screen.findByText('Причина подтверждена. Она появилась у 3 пропущенных уроков 17.11')).toBeInTheDocument();
  });

  it('keeps the typed clarification when rejecting fails, and refreshes a stale day (К9)', async () => {
    day = baseDay({
      status: 'AWAITING_CONFIRMATION', version: 2, pendingResponseCount: 1,
      responses: [{ responseId: 5, parentName: 'Жумабаева Гульнара', reason: 'OTHER', status: 'PENDING' }],
      actions: { canSetReason: true, canConfirmResponses: true, canRejectResponses: true },
    });
    mutateAsync.mockRejectedValue(new ApiError(409, 'conflict', 'ABSENCE_REASON_VERSION_CONFLICT'));
    renderDrawer();

    await userEvent.click(screen.getByRole('button', { name: 'Отклонить' }));
    await userEvent.type(screen.getByRole('textbox', { name: /Что нужно уточнить/ }), 'Уточните, что случилось');
    await userEvent.click(screen.getByRole('button', { name: 'Отклонить ответ' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      command: { kind: 'reject', responseId: 5, comment: 'Уточните, что случилось' }, version: 2,
    });
    expect(await screen.findByText(/день изменился/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Что нужно уточнить/ })).toHaveValue('Уточните, что случилось');
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it('offers to change a confirmed reason and is read-only for the administration', () => {
    day = baseDay({
      status: 'CONFIRMED', version: 4,
      reason: { reason: 'FAMILY', source: 'HOMEROOM_TEACHER', setByName: 'Сапарова Айгуль Каримовна' },
      actions: { canSetReason: true },
    });
    const { unmount } = renderDrawer();
    expect(screen.getByText('Семейные обстоятельства')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Изменить причину' })).toBeInTheDocument();
    unmount();

    render(<AbsenceDayDrawer classId={5} className="5А класс" studentProfileId={89} date="2026-11-17" readOnly onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Изменить причину' })).not.toBeInTheDocument();
  });
});
