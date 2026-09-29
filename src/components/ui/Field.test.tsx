import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Field, Select, TextArea, TextInput } from './Field';
import { MultiSelect } from './MultiSelect';
import { SegmentedTabs } from './SegmentedTabs';

describe('Field accessibility', () => {
  it('connects the visible label, required state, hint, and error to a native input', async () => {
    const user = userEvent.setup();
    render(
      <Field label="ФИО" required hint="Укажите имя полностью" error="Заполните это поле">
        <TextInput />
      </Field>,
    );

    const input = screen.getByLabelText(/ФИО/);
    const descriptions = input.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(input).toHaveAttribute('id', screen.getByText(/ФИО/).closest('label')?.getAttribute('for'));
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(descriptions).toHaveLength(2);
    expect(descriptions.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Укажите имя полностью',
      'Заполните это поле',
    ]);

    await user.click(screen.getByText(/ФИО/));
    expect(input).toHaveFocus();
  });

  it('gives custom selects and segmented controls the Field name and descriptions', () => {
    render(
      <>
        <Field label="Класс" required hint="Класс ученика">
          <SelectHarness />
        </Field>
        <Field label="Формат ответа" required error="Выберите формат">
          <SegmentedTabs
            value="TEXT"
            options={[{ value: 'TEXT', label: 'Текст' }, { value: 'TEST', label: 'Тест' }]}
            onChange={() => undefined}
            ariaLabel="Формат ответа"
          />
        </Field>
      </>,
    );

    const select = screen.getByLabelText(/Класс/);
    expect(select).toHaveAttribute('aria-required', 'true');
    const hintId = select.getAttribute('aria-describedby');
    expect(document.getElementById(hintId as string)).toHaveTextContent('Класс ученика');

    const radioGroup = screen.getByRole('radiogroup', { name: 'Формат ответа' });
    expect(radioGroup).toHaveAttribute('aria-required', 'true');
    expect(radioGroup).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(radioGroup.getAttribute('aria-describedby') as string)).toHaveTextContent('Выберите формат');
  });

  it('creates unique label targets when the same field is rendered more than once', () => {
    render(
      <>
        <Field label="Комментарий" hint="Первое поле"><TextArea /></Field>
        <Field label="Комментарий" hint="Второе поле"><MultiSelect options={[]} value={[]} onChange={() => undefined} /></Field>
      </>,
    );

    const [first, second] = screen.getAllByLabelText(/Комментарий/);
    expect(first).toHaveAttribute('id');
    expect(second).toHaveAttribute('id');
    expect(first.id).not.toBe(second.id);
    expect(new Set(Array.from(document.querySelectorAll('[id]'), (element) => element.id)).size)
      .toBe(document.querySelectorAll('[id]').length);
  });
});

function SelectHarness() {
  return (
    <Select value="5a" onChange={() => undefined}>
      <option value="5a">5А</option>
    </Select>
  );
}
