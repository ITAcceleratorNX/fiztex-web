import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReviewModal } from './ReviewModal';

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/lib/api', () => {
  const api = {
    getReview: vi.fn(),
    scoreAnswer: vi.fn(),
    confirmReview: vi.fn(),
    openResult: vi.fn(),
  };

  class ApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
      this.name = 'ApiError';
    }
  }

  return { api, ApiError };
});

describe('ReviewModal AI prefill', () => {
  it('prefills open answer score/comment from aiScore/aiComment and shows change badge after edit', async () => {
    const aiScore = 2;
    const aiComment = 'AI comment';

    const { api } = await import('@/lib/api');
    api.getReview.mockResolvedValue({
      resultId: null,
      attemptId: 1,
      assignmentId: 1,
      applicantName: 'Applicant',
      testTitle: 'Test',
      totalScore: 0,
      percent: 0,
      minScore: 1,
      passed: false,
      status: 'PENDING',
      schoolComment: null,
      internalComment: null,
      attemptStatus: 'AWAITING_REVIEW',
      answers: [
        {
          questionId: 10,
          topic: null,
          type: 'OPEN_TEXT',
          questionText: 'Q',
          applicantAnswer: 'short answer',
          options: [],
          referenceAnswer: 'Ref',
          photos: [],
          autoScore: null,
          aiScore,
          aiComment,
          aiConfidence: 'LOW',
          aiWarning: 'Черновая эвристика (не AI): проверьте вручную',
          finalScore: null,
          maxScore: 6,
          adminComment: null,
        },
      ],
      suspiciousLogs: [],
      tabSwitchCount: 0,
      violationCount: 0,
      topicBreakdown: {},
      weakTopics: [],
      finishedAt: null,
    });

    const user = userEvent.setup();
    render(<ReviewModal open attemptId={1} onClose={() => {}} />);

    const scoreInput = await screen.findByRole('spinbutton');
    expect(scoreInput).toHaveValue(aiScore);

    const commentInputs = screen.getAllByPlaceholderText(/Комментарий к ответу/i);
    const commentInput = commentInputs[0];
    expect(commentInput).toHaveValue(aiComment);

    expect(screen.queryByText('Изменено админом')).not.toBeInTheDocument();

    await user.clear(scoreInput);
    await user.type(scoreInput, '5');

    expect(screen.getByText('Изменено админом')).toBeInTheDocument();
  });

  it('keeps edited score/comment after successful PATCH', async () => {
    const aiScore = 2;
    const aiComment = 'AI comment';
    const finalScore = 5;
    const adminComment = 'My admin comment';

    const { api } = await import('@/lib/api');
    api.getReview.mockResolvedValue({
      resultId: null,
      attemptId: 1,
      assignmentId: 1,
      applicantName: 'Applicant',
      testTitle: 'Test',
      totalScore: 0,
      percent: 0,
      minScore: 1,
      passed: false,
      status: 'PENDING',
      schoolComment: null,
      internalComment: null,
      attemptStatus: 'AWAITING_REVIEW',
      answers: [
        {
          questionId: 10,
          topic: null,
          type: 'OPEN_TEXT',
          questionText: 'Q',
          applicantAnswer: 'short answer',
          options: [],
          referenceAnswer: 'Ref',
          photos: [],
          autoScore: null,
          aiScore,
          aiComment,
          aiConfidence: 'LOW',
          aiWarning: 'Черновая эвристика (не AI): проверьте вручную',
          finalScore: null,
          maxScore: 6,
          adminComment: null,
        },
      ],
      suspiciousLogs: [],
      tabSwitchCount: 0,
      violationCount: 0,
      topicBreakdown: {},
      weakTopics: [],
      finishedAt: null,
    });

    api.scoreAnswer.mockImplementation(async (_attemptId: number, _questionId: number, body: any) => {
      return {
        resultId: null,
        attemptId: 1,
        assignmentId: 1,
        applicantName: 'Applicant',
        testTitle: 'Test',
        totalScore: finalScore,
        percent: 0,
        minScore: 1,
        passed: true,
        status: 'PENDING',
        schoolComment: null,
        internalComment: null,
        attemptStatus: 'AWAITING_REVIEW',
        answers: [
          {
            questionId: 10,
            topic: null,
            type: 'OPEN_TEXT',
            questionText: 'Q',
            applicantAnswer: 'short answer',
            options: [],
            referenceAnswer: 'Ref',
            photos: [],
            autoScore: null,
            aiScore,
            aiComment,
            aiConfidence: 'LOW',
            aiWarning: 'Черновая эвристика (не AI): проверьте вручную',
            finalScore: body.finalScore,
            maxScore: 6,
            adminComment: body.adminComment,
          },
        ],
        suspiciousLogs: [],
        tabSwitchCount: 0,
        violationCount: 0,
        topicBreakdown: {},
        weakTopics: [],
        finishedAt: null,
      };
    });

    const user = userEvent.setup();
    render(<ReviewModal open attemptId={1} onClose={() => {}} />);

    const scoreInput = await screen.findByRole('spinbutton');
    const commentInputs = screen.getAllByPlaceholderText(/Комментарий к ответу/i);
    const commentInput = commentInputs[0];

    await user.clear(scoreInput);
    await user.type(scoreInput, String(finalScore));
    await user.clear(commentInput);
    await user.type(commentInput, adminComment);

    const saveButtons = screen.getAllByRole('button', { name: 'Сохранить' });
    await user.click(saveButtons[0]);

    // Inputs should remain what admin typed (no reset/backfill).
    expect(scoreInput).toHaveValue(finalScore);
    expect(commentInput).toHaveValue(adminComment);
    expect(screen.getByText(/Выставлено:/)).toHaveTextContent(`Выставлено: ${finalScore}`);
  });
});

