import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PointsPicker } from './PointsPicker';

function setup(type: 'FORMATIVE' | 'SUMMATIVE_SECTION' | 'SUMMATIVE_TERM' = 'SUMMATIVE_TERM', busy = false) {
  const onSubmit = vi.fn();
  render(<PointsPicker workTypes={[
    { type: 'FORMATIVE', scoring: 'TEN_POINT' },
    { type: 'SUMMATIVE_SECTION', scoring: 'RAW_POINTS' },
    { type: 'SUMMATIVE_TERM', scoring: 'RAW_POINTS' },
  ]} defaultType={type} suggestedMax={() => 20} busy={busy} onSubmit={onSubmit} onClose={() => undefined} />);
  return onSubmit;
}

describe('PointsPicker', () => {
  it.each([12, 14, 16])('uses server maximum %i for intermediate assessment, overriding old values and suggestions', async (maximum) => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PointsPicker
      workTypes={[{ type: 'INTERMEDIATE_ASSESSMENT', component: 'INTERMEDIATE', scoring: 'RAW_POINTS', fixedMax: maximum }]}
      defaultType="INTERMEDIATE_ASSESSMENT"
      value={{ gradeType: 'INTERMEDIATE_ASSESSMENT', score: 8, maxScore: 20 }}
      suggestedMax={() => 99}
      onSubmit={onSubmit}
      onClose={() => undefined}
    />);
    const maxInput = screen.getByRole('textbox', { name: /Макс/ });
    expect(maxInput).toHaveValue(String(maximum));
    expect(maxInput).toHaveAttribute('readonly');
    expect(maxInput).toHaveAccessibleDescription('Максимум установлен правилами оценивания для этого класса.');
    fireEvent.change(maxInput, { target: { value: '99' } });
    expect(maxInput).toHaveValue(String(maximum));
    const scoreInput = screen.getByRole('textbox', { name: /Балл/ });
    for (const score of [0, maximum]) {
      fireEvent.change(scoreInput, { target: { value: String(score) } });
      await user.click(screen.getByRole('button', { name: 'Сохранить' }));
      expect(onSubmit).toHaveBeenLastCalledWith({ score, maxScore: maximum, gradeType: 'INTERMEDIATE_ASSESSMENT' });
    }
    fireEvent.change(scoreInput, { target: { value: String(maximum + 1) } });
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    fireEvent.submit(scoreInput.closest('form')!);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('takes the fixed maximum when switching from formative to intermediate assessment', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PointsPicker
      workTypes={[
        { type: 'FORMATIVE', component: 'FORMATIVE', scoring: 'TEN_POINT', fixedMax: 10 },
        { type: 'INTERMEDIATE_ASSESSMENT', component: 'INTERMEDIATE', scoring: 'RAW_POINTS', fixedMax: 14 },
      ]}
      defaultType="FORMATIVE"
      suggestedMax={() => 20}
      onSubmit={onSubmit}
      onClose={() => undefined}
    />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Вид работы' }), 'INTERMEDIATE_ASSESSMENT');
    expect(screen.getByRole('textbox', { name: /Макс/ })).toHaveValue('14');
    expect(screen.getByRole('textbox', { name: /Балл/ })).toHaveValue('');
    fireEvent.change(screen.getByRole('textbox', { name: /Балл/ }), { target: { value: '13' } });
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(onSubmit).toHaveBeenCalledWith({ score: 13, maxScore: 14, gradeType: 'INTERMEDIATE_ASSESSMENT' });
  });

  it.each(['-1', '−1', '21', '', '1.5', '1e1', '0x10', 'Infinity', ' '])('rejects %j without rewriting the input', async (value) => {
    const onSubmit = setup();
    const input = screen.getByRole('textbox', { name: /Балл/ });
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    expect(input).toHaveValue(value);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Введите целый балл от 0 до 20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['SUMMATIVE_SECTION', 'SUMMATIVE_TERM'] as const)('accepts zero and maximum for %s', async (type) => {
    const user = userEvent.setup();
    const onSubmit = setup(type);
    for (const score of ['0', '20']) {
      fireEvent.change(screen.getByRole('textbox', { name: /Балл/ }), { target: { value: score } });
      await user.click(screen.getByRole('button', { name: 'Сохранить' }));
      expect(onSubmit).toHaveBeenLastCalledWith({ score: Number(score), maxScore: 20, gradeType: type });
    }
  });

  it.each(['-1', '0', '', '1001', '1.5'])('rejects maximum %j', (value) => {
    const onSubmit = setup();
    fireEvent.change(screen.getByRole('textbox', { name: /Балл/ }), { target: { value: '1' } });
    const input = screen.getByRole('textbox', { name: /Макс/ });
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    expect(input).toHaveValue(value);
    expect(screen.getByText('Введите целый максимальный балл от 1 до 1000')).toBeInTheDocument();
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends no command while busy', () => {
    const onSubmit = setup('SUMMATIVE_TERM', true);
    const score = screen.getByRole('textbox', { name: /Балл/ });
    fireEvent.change(score, { target: { value: '20' } });
    fireEvent.submit(score.closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers only 1–10 for formative grades', async () => {
    const user = userEvent.setup();
    const onSubmit = setup('FORMATIVE');
    expect(screen.queryByRole('button', { name: '0' })).not.toBeInTheDocument();
    for (const score of [1, 10]) {
      await user.click(screen.getByRole('button', { name: String(score) }));
      expect(onSubmit).toHaveBeenLastCalledWith({ score, maxScore: 10, gradeType: 'FORMATIVE' });
    }
  });
});
