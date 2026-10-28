import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationCard } from './RecommendationCard';

const mutate = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useCorrectAiRecognition: () => ({ mutate, isPending: false }),
}));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));

const structured = {
  basis: 'COMPLETENESS' as const,
  summary: 'Формула верная, ответ не дочитан.',
  issues: ['фото 2: нет единиц измерения'],
  doubtful: ['фото 2: число в ответе'],
  solution: '$\\rho = \\frac{m}{V}$',
  percent: 74,
  score: 74,
  maxScore: 100,
  closedScore: 0,
  closedMax: 0,
  scaleCode: '4',
  suggestedScore: 7,
  suggestedMaxScore: 10,
  recognized: [
    { photo: 1, attachmentId: 11, text: 'Дано: $m = 200$ г', unclear: [] },
    { photo: 2, attachmentId: 12, text: 'Жауабы: [?] г/см³', unclear: ['число после знака равенства'] },
  ],
};

/** QA B2-021…B2-024: структурированный разбор работы, а не одна общая рекомендация. */
describe('RecommendationCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the 10-point suggestion, the model’s conclusions and the verbatim pages separately', () => {
    render(<RecommendationCard recommendation={structured} homeworkId={5} studentProfileId={7} />);

    expect(screen.getByLabelText('Предлагаемая оценка 7 из 10')).toBeInTheDocument();
    expect(screen.getByText('Не оценка: в журнал ничего не попадёт, пока вы не выставите её сами.')).toBeInTheDocument();
    expect(screen.getByText('Предполагаемые ошибки')).toBeInTheDocument();
    expect(screen.getByText('Сомнительные места — проверьте сами')).toBeInTheDocument();
    expect(screen.getByText('Правильное решение по мнению ИИ')).toBeInTheDocument();

    const pages = screen.getByRole('region', { name: 'Распознанное с фото' });
    expect(within(pages).getByText('Фото 1')).toBeInTheDocument();
    expect(within(pages).getByText('Фото 2')).toBeInTheDocument();
    expect(within(pages).getByText('число после знака равенства')).toBeInTheDocument();
  });

  it('lets the teacher correct a page without saving any grade or comment', async () => {
    const user = userEvent.setup();
    render(<RecommendationCard recommendation={structured} homeworkId={5} studentProfileId={7} />);

    await user.click(screen.getAllByRole('button', { name: 'Исправить распознанное' })[1]);
    const field = screen.getByLabelText('Текст с фото 2 — исправленный');
    expect(field).toHaveValue('Жауабы: [?] г/см³');
    await user.clear(field);
    await user.type(field, 'Жауабы: 2 г/см³');
    await user.click(screen.getByRole('button', { name: 'Сохранить правку' }));

    expect(mutate).toHaveBeenCalledWith([{ photo: 2, text: 'Жауабы: 2 г/см³' }], expect.anything());
  });

  it('shows the teacher’s correction next to the model’s text and can return to it', async () => {
    const user = userEvent.setup();
    const corrected = {
      ...structured,
      recognitionEditedByName: 'Иванова А.',
      recognized: [structured.recognized[0], { ...structured.recognized[1], correctedText: 'Жауабы: 2 г/см³' }],
    };
    render(<RecommendationCard recommendation={corrected} homeworkId={5} studentProfileId={7} />);

    expect(screen.getByText('Исправлено учителем')).toBeInTheDocument();
    expect(screen.getByText('Правки: Иванова А.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Вернуть текст ИИ' }));
    expect(mutate).toHaveBeenCalledWith([{ photo: 2, text: '' }], expect.anything());
  });

  it('puts the comment into the feedback field only on request', async () => {
    const user = userEvent.setup();
    const onUseComment = vi.fn();
    render(<RecommendationCard recommendation={structured} homeworkId={5} studentProfileId={7} onUseComment={onUseComment} />);

    expect(onUseComment).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Подставить в комментарий ученику' }));
    expect(onUseComment).toHaveBeenCalledWith('Формула верная, ответ не дочитан.');
  });

  it('falls back to the school scale when the task is not graded in points', () => {
    render(<RecommendationCard recommendation={{ ...structured, suggestedScore: undefined, recognized: [] }} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Распознанное с фото' })).not.toBeInTheDocument();
  });
});
