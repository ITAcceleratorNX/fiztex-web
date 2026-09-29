import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReviewModal } from './ReviewModal';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

async function getApiMocks() {
  const { api } = await import('@/lib/api');
  return api as unknown as {
    getReview: ReturnType<typeof vi.fn>;
    scoreAnswer: ReturnType<typeof vi.fn>;
    confirmReview: ReturnType<typeof vi.fn>;
    openResult: ReturnType<typeof vi.fn>;
  };
}

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => toast,
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

    const api = await getApiMocks();
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
    expect(scoreInput).toHaveAttribute('aria-invalid', 'true');
    expect(scoreInput).toHaveAccessibleDescription('Укажите балл.');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await user.type(scoreInput, '5');
    expect(scoreInput).toHaveAttribute('aria-invalid', 'false');

    expect(screen.getByText('Изменено админом')).toBeInTheDocument();
  });

  it('keeps edited score/comment after successful PATCH', async () => {
    const aiScore = 2;
    const aiComment = 'AI comment';
    const finalScore = 5;
    const adminComment = 'My admin comment';

    const api = await getApiMocks();
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

  it('досылает несохранённые баллы перед подтверждением проверки', async () => {
    const api = await getApiMocks();
    api.getReview.mockResolvedValue(pendingDetail());
    api.scoreAnswer.mockImplementation(async (_a: number, _q: number, body: any) => {
      const detail = pendingDetail();
      detail.answers[0].finalScore = body.finalScore;
      detail.answers[0].adminComment = body.adminComment;
      detail.totalScore = body.finalScore;
      return detail;
    });
    api.confirmReview.mockImplementation(async () => {
      const detail = pendingDetail();
      detail.status = 'REVIEWED';
      return detail;
    });

    const user = userEvent.setup();
    render(<ReviewModal open attemptId={1} onClose={() => {}} />);

    const scoreInput = await screen.findByRole('spinbutton');
    await user.clear(scoreInput);
    await user.type(scoreInput, '5');
    expect(screen.getByText(/Не сохранено/)).toBeInTheDocument();

    // Админ не нажимал «Сохранить» у вопроса — раньше правка тихо терялась.
    await user.click(screen.getByRole('button', { name: 'Подтвердить проверку' }));

    expect(api.scoreAnswer).toHaveBeenCalledWith(1, 10, { finalScore: 5, adminComment: 'AI comment' });
    expect(api.confirmReview).toHaveBeenCalled();
  });

  it('держит ошибку сохранения рядом с баллом и даёт повторить действие', async () => {
    const api = await getApiMocks();
    api.getReview.mockReset().mockResolvedValue(pendingDetail());
    api.scoreAnswer.mockReset().mockRejectedValue(new Error('offline'));

    const user = userEvent.setup();
    render(<ReviewModal open attemptId={1} onClose={() => {}} />);

    const scoreInput = await screen.findByRole('spinbutton');
    await user.clear(scoreInput);
    await user.type(scoreInput, '5');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Не удалось сохранить балл');
    expect(scoreInput).toHaveValue(5);
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });

  it('показывает успех сохранения только после ответа сервера', async () => {
    const api = await getApiMocks();
    api.getReview.mockReset().mockResolvedValue(pendingDetail());
    let resolveSave!: (value: any) => void;
    const saveRequest = new Promise((resolve) => {
      resolveSave = resolve;
    });
    api.scoreAnswer.mockReset().mockReturnValue(saveRequest);

    toast.success.mockReset();
    const user = userEvent.setup();
    render(<ReviewModal open attemptId={1} onClose={() => {}} />);

    const scoreInput = await screen.findByRole('spinbutton');
    await user.clear(scoreInput);
    await user.type(scoreInput, '5');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(toast.success).not.toHaveBeenCalled();
    resolveSave(pendingDetail());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Балл сохранён'));
  });

  it('повторяет загрузку попытки из доступного блока ошибки', async () => {
    const api = await getApiMocks();
    api.getReview.mockReset().mockRejectedValue(new Error('сеть недоступна'));

    const user = userEvent.setup();
    render(<ReviewModal open attemptId={1} onClose={() => {}} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить попытку');
    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    await waitFor(() => expect(api.getReview).toHaveBeenCalledTimes(2));
  });
});

/** Ответ на проверке: один открытый вопрос с черновым баллом AI. */
function pendingDetail(): any {
  return {
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
        aiScore: 2,
        aiComment: 'AI comment',
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
  };
}
