import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmissionAntiCheat } from './SubmissionAntiCheat';

const useAntiCheatLog = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useAntiCheatLog: (...args: unknown[]) => useAntiCheatLog(...args),
}));

function query(data: unknown, overrides: Record<string, unknown> = {}) {
  return { data, isPending: false, isError: false, refetch: vi.fn(), ...overrides };
}

function event(id: number, type: string, violation: boolean, questionNumber?: number) {
  return { id, type, violation, questionNumber, occurredAt: '2026-09-09T10:00:00Z' };
}

/**
 * Журнал античита при проверке работы (ANTICHEAT-001 §6). Главное свойство блока — он
 * ничего не решает за учителя: показывает факты и молчит о выводах.
 */
describe('SubmissionAntiCheat', () => {
  beforeEach(() => vi.clearAllMocks());

  /** «Наблюдения не было» — не то же самое, что «нарушений не было». */
  it('не рисует блок, когда античит выключен и записей нет', () => {
    useAntiCheatLog.mockReturnValue(query({ enabled: false, violationCount: 0, attempts: [] }));

    const { container } = render(<SubmissionAntiCheat homeworkId={1} studentProfileId={2} />);

    expect(container).toBeEmptyDOMElement();
  });

  /** Выключить наблюдение после нарушений можно, спрятать записанное — нет. */
  it('показывает записанное даже после выключения античита', () => {
    useAntiCheatLog.mockReturnValue(query({
      enabled: false,
      violationCount: 1,
      attempts: [{ attemptId: 9, attemptNumber: 1, violationCount: 1, events: [
        event(1, 'TAB_SWITCH', true, 3),
      ] }],
    }));

    render(<SubmissionAntiCheat homeworkId={1} studentProfileId={2} />);

    expect(screen.getByText('Переключение вкладки')).toBeInTheDocument();
    expect(screen.getByText(/Наблюдение выключено/)).toBeInTheDocument();
  });

  /** §5: логи попыток не смешиваются — иначе «три нарушения» ничего не значат. */
  it('разделяет попытки и подписывает их номерами', () => {
    useAntiCheatLog.mockReturnValue(query({
      enabled: true,
      violationCount: 2,
      attempts: [
        { attemptId: 9, attemptNumber: 1, violationCount: 1, events: [event(1, 'TAB_SWITCH', true, 1)] },
        { attemptId: 10, attemptNumber: 2, violationCount: 1, events: [event(2, 'PAGE_CLOSE', true, 2)] },
      ],
    }));

    render(<SubmissionAntiCheat homeworkId={1} studentProfileId={2} />);

    expect(screen.getByText('Версия 1')).toBeInTheDocument();
    expect(screen.getByText('Версия 2')).toBeInTheDocument();
    expect(screen.getByText('2 нарушения')).toBeInTheDocument();
  });

  /** Возврат в тест фиксируется, но нарушением не считается — и это должно быть видно. */
  it('помечает события, которые нарушением не являются', () => {
    useAntiCheatLog.mockReturnValue(query({
      enabled: true,
      violationCount: 0,
      attempts: [{ attemptId: null, attemptNumber: null, violationCount: 0, events: [
        event(1, 'RE_ENTRY', false),
      ] }],
    }));

    render(<SubmissionAntiCheat homeworkId={1} studentProfileId={2} />);

    expect(screen.getByText('Возврат в задание')).toBeInTheDocument();
    expect(screen.getByText('не нарушение')).toBeInTheDocument();
    expect(screen.getByText('До отправки')).toBeInTheDocument();
  });

  /** Блок не советует оценку и не выносит вердикт: этого требует §6. */
  it('не предлагает решения по оценке', () => {
    useAntiCheatLog.mockReturnValue(query({
      enabled: true,
      violationCount: 3,
      attempts: [{ attemptId: 9, attemptNumber: 1, violationCount: 3, events: [
        event(1, 'TAB_SWITCH', true, 1),
        event(2, 'WINDOW_BLUR', true, 1),
        event(3, 'APP_BACKGROUND', true, 2),
      ] }],
    }));

    render(<SubmissionAntiCheat homeworkId={1} studentProfileId={2} />);

    expect(screen.queryByText(/списыв/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/снизить/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /оцен/i })).not.toBeInTheDocument();
  });
});
