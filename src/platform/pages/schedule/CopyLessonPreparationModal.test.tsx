import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { CopyLessonPreparationModal } from './CopyLessonPreparationModal';

const copy = vi.fn();
const preview = vi.fn();
const next = vi.fn();
const lessons = vi.fn();
const refetchPreview = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useWorkspaceLessonTargets: (...args: unknown[]) => lessons(...args),
  useNextTaughtLesson: () => next(),
  useLessonPreparationCopyPreview: (source: number, target: number | null) => preview(source, target),
  useCopyLessonPreparation: (source: number) => ({ mutateAsync: (body: unknown) => copy(source, body), isPending: false }),
}));

const source = { id: 5, subjectName: 'Физика', className: '7А', date: '2026-10-06',
  academicPeriodStatus: 'ACTIVE', capabilities: ['EDIT_TEACHING_PART'] };
const nextLesson = { id: 6, subjectName: 'Физика', className: '7А', date: '2026-10-08', lessonNumber: 2,
  startTime: '09:00:00', endTime: '09:45:00', academicPeriodStatus: 'ACTIVE', capabilities: ['EDIT_TEACHING_PART'] };
const otherClass = { id: 9, subjectName: 'Физика', className: '8Б', date: '2026-10-07',
  academicPeriodStatus: 'ACTIVE', capabilities: ['EDIT_TEACHING_PART'] };

function previewOf(target: object, extra: object = {}) {
  return {
    canCopy: true, targetHasContent: false, textbookTransferable: true, targetRevision: 'b'.repeat(64), target,
    source: { topic: 'Законы Ньютона', hasSummary: true, summaryTitle: 'Конспект', hasComment: true,
      materialCount: 2, textbookId: 3, textbookTitle: 'Физика 7', pageFrom: 10, pageTo: 12 },
    existing: { materialCount: 0 },
    ...extra,
  };
}

function renderModal(onClose = vi.fn()) {
  render(<MemoryRouter><CopyLessonPreparationModal lesson={source} onClose={onClose} /></MemoryRouter>);
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  next.mockReturnValue({ data: { lesson: nextLesson }, isPending: false, isError: false });
  lessons.mockReturnValue({ data: { content: [source, otherClass], totalPages: 1 }, isPending: false, isError: false });
  preview.mockImplementation((_: number, target: number | null) => ({
    data: target === 6 ? previewOf(nextLesson) : target === 9 ? previewOf(otherClass, {
      targetHasContent: true, textbookTransferable: false,
      existing: { topic: 'Своя тема', materialCount: 1 },
    }) : undefined,
    isPending: false, isError: false, refetch: refetchPreview,
  }));
  copy.mockResolvedValue({ targetLessonId: 6, topicCopied: true, summaryCopied: true, commentCopied: true,
    addedMaterials: 2, textbookCopied: true, textbookSkipped: false });
});

describe('CopyLessonPreparationModal', () => {
  it('переносит подготовку на следующий урок класса после проверки', async () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Далее' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Физика · 7А.*2-й урок/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

    expect(screen.getByText(/Четверг, 8 октября · 2-й урок · 09:00–09:45/)).toBeInTheDocument();
    expect(screen.getByText('Законы Ньютона')).toBeInTheDocument();
    expect(screen.getByText(/Физика 7, стр. 10–12/)).toBeInTheDocument();
    expect(screen.queryByText(/уже есть/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Скопировать' }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(5, {
      targetLessonId: 6, expectedTargetRevision: 'b'.repeat(64), confirmReplace: false }));
    expect(screen.getByText('Подготовка скопирована')).toBeInTheDocument();
    expect(screen.getByText(/Перенесено: тема, конспект, комментарий, 2 материала, учебник/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть урок' })).toHaveAttribute('href', '/lesson-schedule/lessons/6');
  });

  it('предупреждает о заполненном уроке другого класса и шлёт подтверждение замены', async () => {
    renderModal();
    expect(screen.getByRole('button', { name: /Физика · 7А.*Этот урок/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Физика · 8Б/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

    expect(screen.getByText(/В выбранном уроке уже есть тема «Своя тема», 1 материал/)).toBeInTheDocument();
    expect(screen.getByText(/не назначен этому классу на дату урока/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Заменить и скопировать' }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(5, expect.objectContaining({
      targetLessonId: 9, confirmReplace: true })));
  });

  it('при изменившемся уроке показывает ошибку и перечитывает проверку', async () => {
    copy.mockRejectedValue(new ApiError(409, 'Урок изменился. Обновите его состояние перед копированием.',
      'LESSON_PREPARATION_TARGET_CHANGED'));
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /2-й урок/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
    await userEvent.click(screen.getByRole('button', { name: 'Скопировать' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Урок изменился');
    expect(refetchPreview).toHaveBeenCalled();
    expect(screen.queryByText('Подготовка скопирована')).not.toBeInTheDocument();
  });

  it('не даёт копировать, если сервер запретил, и говорит, когда следующего урока нет', async () => {
    next.mockReturnValue({ data: { lesson: undefined }, isPending: false, isError: false });
    preview.mockReturnValue({ data: previewOf(otherClass, { canCopy: false, blockedReason: 'NOTHING_TO_COPY' }),
      isPending: false, isError: false, refetch: refetchPreview });
    renderModal();
    expect(screen.getByText(/больше нет ваших уроков по этому предмету у 7А/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Физика · 8Б/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
    expect(screen.getByText(/нечего переносить/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скопировать' })).toBeDisabled();
  });
});
