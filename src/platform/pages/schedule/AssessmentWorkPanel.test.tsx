import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessmentWorkPanel } from './AssessmentWorkPanel';

const conduct = vi.fn();
const update = vi.fn();
const create = vi.fn();
const useAssessmentLimits = vi.fn();

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock('@/hooks/queries', () => ({
  useAssessmentLimits: (...a: unknown[]) => useAssessmentLimits(...a),
  useAssessmentResults: () => ({ data: { students: [{ inAudience: true }, { inAudience: true }, { inAudience: true }] } }),
  useConductAssessmentWork: () => ({ mutateAsync: conduct, isPending: false }),
  useUpdateAssessmentWork: () => ({ mutateAsync: update, isPending: false }),
  useCreateAssessmentWork: () => ({ mutateAsync: create, isPending: false }),
  useCancelAssessmentWork: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRescheduleAssessmentWork: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRescheduleCandidates: () => ({ data: { content: [] }, isPending: false }),
}));

const baseLesson = {
  id: 6, status: 'ACTIVE', academicPeriodStatus: 'ACTIVE', classId: 1, subjectId: 2, academicPeriodId: 3,
  subjectName: 'Математика', className: '5А', date: '2026-11-13', lessonNumber: 1,
};
const planned = { id: 71, kind: 'SOR', number: 1, status: 'PLANNED', maxScore: 20, reminderDaysBefore: 1, hasResults: false, version: 0 };

function renderPanel(lesson: Record<string, unknown>, canEdit = true) {
  return render(<MemoryRouter><AssessmentWorkPanel lesson={lesson as never} canEdit={canEdit} /></MemoryRouter>);
}

describe('СОР/СОЧ в карточке урока', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAssessmentLimits.mockReturnValue({ data: { sorAllowed: true, sorLimit: 3, sorUsed: 1, sochAllowed: true, sochUsed: 1 }, isPending: false });
    conduct.mockResolvedValue({});
    update.mockResolvedValue({});
    create.mockResolvedValue({});
  });

  it('запланированную работу можно провести, перенести и отменить', async () => {
    renderPanel({ ...baseLesson, assessmentWorks: [planned] });
    expect(screen.getByText('Работа запланирована')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Изменить дату' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отменить СОР' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Отметить как проведён/ }));
    expect(conduct).toHaveBeenCalledWith(71);
  });

  it('проведённую работу без баллов нельзя перенести, только отменить', () => {
    renderPanel({ ...baseLesson, assessmentWorks: [{ ...planned, status: 'CONDUCTED', hasResults: false }] });
    expect(screen.queryByRole('button', { name: 'Изменить дату' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Отменить СОР' })).toBeInTheDocument();
    expect(screen.getByText(/не переносят/)).toBeInTheDocument();
  });

  it('после первого балла максимум закрыт, перенос и отмена недоступны, есть переход в журнал', () => {
    renderPanel({ ...baseLesson, assessmentWorks: [{ ...planned, status: 'CONDUCTED', hasResults: true, resultsCount: 2 }] });
    expect(screen.getByText('Баллы выставлены')).toBeInTheDocument();
    expect(screen.getByText('Выставлено 2 из 3 учеников')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Изменить дату' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Отменить СОР/ })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Максимальный балл' })).toBeNull();
    expect(screen.getByText(/после выставления баллов нельзя/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть в журнале' })).toHaveAttribute('href', expect.stringContaining('/grades?classId=1'));
  });

  it('не принимает неверный максимум: ошибка в поле и запрос не уходит', async () => {
    renderPanel({ ...baseLesson, assessmentWorks: [planned] });
    const max = screen.getByRole('textbox', { name: 'Максимальный балл' });
    await userEvent.clear(max);
    await userEvent.type(max, '0');
    await userEvent.tab();
    expect(screen.getByRole('alert')).toHaveTextContent(/больше 0/);
    expect(update).not.toHaveBeenCalled();
  });

  it('сохраняет новый максимум и напоминание', async () => {
    renderPanel({ ...baseLesson, assessmentWorks: [planned] });
    const max = screen.getByRole('textbox', { name: 'Максимальный балл' });
    await userEvent.clear(max);
    await userEvent.type(max, '25');
    await userEvent.tab();
    expect(update).toHaveBeenCalledWith({ workId: 71, maxScore: 25, expectedVersion: 0 });
  });

  it('без работы предлагает назначить; недоступный СОЧ объясняется причиной', async () => {
    renderPanel({ ...baseLesson, assessmentWorks: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Назначить СОР/СОЧ' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Будет СОР 2: в четверти 3 СОР, назначено 1')).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'СОЧ' })).toBeDisabled();
    expect(within(dialog).getByText(/уже назначен СОЧ/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });

  it('назначает СОР с максимумом и напоминанием', async () => {
    renderPanel({ ...baseLesson, assessmentWorks: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Назначить СОР/СОЧ' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('radio', { name: 'За 3 дня' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
    expect(create).toHaveBeenCalledWith({ lessonId: 6, kind: 'SOR', maxScore: 20, reminderDaysBefore: 3 });
  });

  it('роль без права видит работу, но не управляет ею', () => {
    renderPanel({ ...baseLesson, assessmentWorks: [planned] }, false);
    expect(screen.queryByRole('button', { name: /Отметить как проведён/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Изменить дату' })).toBeNull();
  });

  it('в закрытом или отменённом уроке назначать нельзя', () => {
    const { container } = renderPanel({ ...baseLesson, status: 'CANCELLED', assessmentWorks: [] });
    expect(container).toBeEmptyDOMElement();
  });
});

it('лимит СОР исчерпан — СОР закрыт с причиной, сохранить нельзя', async () => {
  useAssessmentLimits.mockReturnValue({ data: { sorAllowed: true, sorLimit: 3, sorUsed: 3, sochAllowed: true, sochUsed: 1 }, isPending: false });
  renderPanel({ ...baseLesson, assessmentWorks: [] });
  await userEvent.click(screen.getByRole('button', { name: 'Назначить СОР/СОЧ' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(/Лимит СОР исчерпан/)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Сохранить' })).toBeDisabled();
});
