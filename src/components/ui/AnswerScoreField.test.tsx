import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnswerScoreField } from './AnswerScoreField';

function renderField(overrides: Partial<Parameters<typeof AnswerScoreField>[0]> = {}) {
  const props = {
    inputId: 'answer-score-1',
    score: '',
    maxScore: 2,
    onScoreChange: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
  render(<AnswerScoreField {...props} />);
  return props;
}

describe('AnswerScoreField', () => {
  it('показывает автопроверку отдельно от поля решения учителя', () => {
    renderField({ autoScore: 1 });

    expect(screen.getByText('Автопроверка')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Балл учителя/ })).toHaveValue(null);
    expect(screen.getByText(/Оставьте поле пустым/)).toBeInTheDocument();
  });

  it('показывает рекомендацию ИИ с обоснованием и принимает её только по явному действию', async () => {
    const user = userEvent.setup();
    const onAcceptSuggestion = vi.fn();
    renderField({
      aiSuggestedScore: 1.5,
      aiRationale: 'Ответ верный, но не хватает единиц измерения.',
      onAcceptSuggestion,
    });

    expect(screen.getByText('Предлагает ИИ')).toBeInTheDocument();
    expect(screen.getByText('Ответ верный, но не хватает единиц измерения.')).toBeInTheDocument();
    expect(screen.getByText('1,5 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Принять предложенное' }));
    expect(onAcceptSuggestion).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Сохранить балл' })).toBeDisabled();
  });

  it('балл больше максимального объясняет прямо у поля и не даёт сохранить', () => {
    renderField({ score: '3', dirty: true });

    expect(screen.getByText('Введите число от 0 до 2.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить балл' })).toBeDisabled();
  });

  /**
   * Поле контролируемое, поэтому набор проверяется на живом состоянии: с неизменным
   * `score` в пропе браузер печатал бы поверх старого значения, и наверх уходил бы
   * мусор вроде «35» — тест мерил бы собственную обёртку, а не компонент.
   */
  it('набранный балл доходит наверх и снимает запрет на сохранение', async () => {
    const user = userEvent.setup();
    const onScoreChange = vi.fn();
    render(<ControlledField onScoreChange={onScoreChange} />);

    const input = screen.getByRole('spinbutton', { name: /Балл учителя/ });
    await user.type(input, '1.25');

    expect(input).toHaveValue(1.25);
    expect(onScoreChange).toHaveBeenLastCalledWith('1.25');
    expect(screen.getByRole('button', { name: 'Сохранить балл' })).toBeEnabled();
  });
});

/** Обёртка с состоянием — так же, как поле живёт на экране проверки работы. */
function ControlledField({ onScoreChange }: { onScoreChange: (score: string) => void }) {
  const [score, setScore] = useState('');
  return (
    <AnswerScoreField
      inputId="answer-score-1"
      score={score}
      maxScore={2}
      dirty={score.length > 0}
      onScoreChange={(next) => {
        setScore(next);
        onScoreChange(next);
      }}
      onSave={vi.fn()}
    />
  );
}
