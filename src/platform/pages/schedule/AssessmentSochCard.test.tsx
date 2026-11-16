import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessmentSochCard } from './AssessmentSochCard';

const useAssessmentResults = vi.fn();
const useAssessmentHistory = vi.fn();
const correct = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useAssessmentResults: (...args: unknown[]) => useAssessmentResults(...args),
  useAssessmentHistory: (...args: unknown[]) => useAssessmentHistory(...args),
  useCorrectAssessmentResult: () => ({ mutateAsync: correct, isPending: false }),
}));

const lesson = {
  id: 6,
  assessmentWorks: [
    { id: 71, kind: 'SOCH', status: 'CONDUCTED' },
    { id: 72, kind: 'SOR', status: 'PLANNED' },
  ],
} as never;

function sheet(canCorrect: boolean) {
  return {
    data: {
      canManage: true,
      canCorrect,
      work: { id: 71, kind: 'SOCH', maxScore: 40 },
      students: [
        { studentProfileId: 1, studentName: 'Айдар Нурланов', score: 20, version: 3 },
        { studentProfileId: 2, studentName: 'Мария Ким', score: 0, version: 0 },
        { studentProfileId: 3, studentName: 'Данияр Сатов', score: null },
      ],
    },
    isPending: false,
    isError: false,
  };
}

describe('баллы СОЧ и исправление', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAssessmentHistory.mockReturnValue({ data: { results: [] }, isPending: false, isError: false });
    correct.mockResolvedValue({});
  });

  it('карточки нет, если на уроке нет СОЧ', () => {
    useAssessmentResults.mockReturnValue(sheet(true));
    const { container } = render(<AssessmentSochCard lesson={{ assessmentWorks: [{ id: 1, kind: 'SOR', status: 'PLANNED' }] } as never} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ноль и невыставленный балл различаются; СОР в карточке не показывается', () => {
    useAssessmentResults.mockReturnValue(sheet(true));
    render(<AssessmentSochCard lesson={lesson} />);
    expect(useAssessmentResults).toHaveBeenCalledWith(71);
    expect(screen.getByText('0 / 40')).toBeInTheDocument();
    expect(screen.getByText('20 / 40')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    // «Исправить» только там, где балл есть.
    expect(screen.getAllByRole('button', { name: /Исправить балл СОЧ/ })).toHaveLength(2);
  });

  it('без права, которое называет сервер, кнопок исправления нет', () => {
    useAssessmentResults.mockReturnValue(sheet(false));
    render(<AssessmentSochCard lesson={lesson} />);
    expect(screen.queryByRole('button', { name: /Исправить балл СОЧ/ })).toBeNull();
  });

  it('не сохраняет без причины и вне диапазона, а с причиной отправляет версию балла', async () => {
    const user = userEvent.setup();
    useAssessmentResults.mockReturnValue(sheet(true));
    render(<AssessmentSochCard lesson={lesson} />);
    await user.click(screen.getByRole('button', { name: 'Исправить балл СОЧ: Айдар Нурланов' }));

    const dialog = screen.getByRole('dialog');
    const save = within(dialog).getByRole('button', { name: 'Сохранить исправление' });
    const score = within(dialog).getByLabelText(/Новый балл/);
    expect(save).toBeDisabled();

    await user.clear(score);
    await user.type(score, '41');
    await user.type(within(dialog).getByLabelText('Причина исправления'), 'Не засчитана задача 4');
    expect(save).toBeDisabled();

    await user.clear(score);
    await user.type(score, '31');
    expect(save).toBeEnabled();
    await user.click(save);

    expect(correct).toHaveBeenCalledWith({
      workId: 71,
      studentProfileId: 1,
      score: 31,
      reason: 'Не засчитана задача 4',
      expectedVersion: 3,
    });
  });

  it('история показывает было, стало, причину и автора', async () => {
    const user = userEvent.setup();
    useAssessmentResults.mockReturnValue(sheet(true));
    useAssessmentHistory.mockReturnValue({
      data: {
        results: [{
          id: 9, studentName: 'Айдар Нурланов', scoreBefore: 20, scoreAfter: 31,
          reason: 'Не засчитана задача 4', actorName: 'Иванова А.', actorRole: 'TEACHER',
          at: '2026-11-10T10:00:00Z',
        }],
      },
      isPending: false,
      isError: false,
    });
    render(<AssessmentSochCard lesson={lesson} />);
    await user.click(screen.getByRole('button', { name: /История исправлений/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Исправлено: 20 \/ 40 → 31 \/ 40/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Причина: Не засчитана задача 4/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Иванова А\. · Учитель/)).toBeInTheDocument();
  });
});
