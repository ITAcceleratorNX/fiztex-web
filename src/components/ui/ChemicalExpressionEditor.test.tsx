import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ChemicalExpressionEditor } from './ChemicalExpressionEditor';

function renderEditor(initial = '', allowCreate = true) {
  function Editor() {
    const [latex, setLatex] = useState(initial);
    return <><ChemicalExpressionEditor latex={latex} onChange={setLatex} allowCreate={allowCreate} /><output data-testid="saved-source">{latex}</output></>;
  }
  render(<Editor />);
}
function button(label: string) { return screen.getByText(label, { exact: true }).closest('button')!; }
function element(symbol: string) { return document.querySelector<HTMLButtonElement>(`button[aria-label*=', ${symbol}, атомный номер']`)!; }
function digit(number: number) { return screen.getByLabelText(`Цифра ${number}`); }
function source() { return screen.getByTestId('saved-source').textContent; }

describe('ChemicalExpressionEditor', () => {
  it('собирает своё вещество с нуля кнопками и сразу обновляет готовую запись', async () => {
    const user = userEvent.setup();
    renderEditor();
    expect(screen.getByLabelText('Вещество или реакция')).toHaveValue('');
    await user.click(element('H')); await user.click(digit(2));
    await user.click(element('S')); await user.click(element('O')); await user.click(digit(4));
    expect(source()).toBe('\\ce{H2SO4}');
    expect(screen.getByLabelText('Вещество или реакция')).toHaveValue('H2SO4');
  });

  it('поиск элемента сохраняет выделение, регистр и соседние математические и химические блоки', async () => {
    const user = userEvent.setup();
    renderEditor('x+\\ce{CO}+\\ce{Fe^{2+}}');
    const argument = screen.getByLabelText('Вещество или реакция') as HTMLInputElement;
    argument.focus(); argument.setSelectionRange(0, 2); fireEvent.select(argument);
    await user.click(button('Таблица Менделеева'));
    await user.type(screen.getByLabelText('Найти элемент'), 'Co');
    await user.click(element('Co'));
    expect(source()).toBe('x+\\ce{Co}+\\ce{Fe^{2+}}');
    expect(argument).toHaveFocus();
    expect(argument.selectionStart).toBe(2);
    await user.click(button('Отменить действие'));
    expect(source()).toBe('x+\\ce{CO}+\\ce{Fe^{2+}}');
  });

  it('оборачивает выделенное в группу, дописывает индекс и возвращает исходный блок', async () => {
    const user = userEvent.setup();
    renderEditor('\\ce{NH4}');
    const argument = screen.getByLabelText('Вещество или реакция') as HTMLInputElement;
    argument.focus(); argument.setSelectionRange(0, 3); fireEvent.select(argument);
    await user.click(button('( ) Группа')); await user.click(digit(2));
    await user.click(element('S')); await user.click(element('O')); await user.click(digit(4));
    expect(source()).toBe('\\ce{(NH4)2SO4}');
    await user.click(button('Отменить правку блока'));
    expect(source()).toBe('\\ce{NH4}');
  });

  it('сохраняет ввод с незаконченной скобкой и восстанавливает правильную запись после дописывания', async () => {
    const user = userEvent.setup();
    renderEditor('x+\\ce{Fe}');
    const argument = screen.getByLabelText('Вещество или реакция');
    await user.clear(argument); await user.paste('Fe^{2');
    expect(argument).toHaveValue('Fe^{2');
    expect(source()).toBe('x+\\ce{Fe^{2}');
    await user.type(argument, '+}');
    expect(argument).toHaveValue('Fe^{2+}');
    expect(source()).toBe('x+\\ce{Fe^{2+}}');
  });

  it('добавляет отдельную химическую запись после существующей, сохраняя её', async () => {
    const user = userEvent.setup();
    renderEditor('x+\\ce{H2O}');
    await user.click(screen.getByLabelText('Химический блок'));
    await user.click(screen.getByRole('option', { name: 'Новая химическая запись' }));
    await user.click(element('C')); await user.click(element('O')); await user.click(digit(2));
    expect(source()).toBe('x+\\ce{H2O} \\ce{CO2}');
  });

  it('подставляет атомный номер из таблицы и собирает изотоп без ручного LaTeX', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(button('Ионы и изотопы'));
    await user.click(screen.getByLabelText('Элемент или группа'));
    await user.click(element('C'));
    expect(screen.getByLabelText('Атомный номер')).toHaveValue('6');
    await user.type(screen.getByLabelText('Массовое число'), '14');
    await user.click(button('Собрать ион или изотоп'));
    expect(source()).toBe('\\ce{^{14}_{6}C}');
    await user.click(button('2+'));
    expect(source()).toBe('\\ce{^{14}_{6}C^{2+}}');
  });

  it('собирает обычный ион без лишнего атомного номера', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(button('Ионы и изотопы'));
    await user.click(screen.getByLabelText('Элемент или группа'));
    await user.click(element('Fe'));
    await user.type(screen.getByLabelText('Заряд'), '3+');
    await user.click(button('Собрать ион или изотоп'));
    expect(source()).toBe('\\ce{Fe^{3+}}');
  });

  it('после закрытия дополнительных полей кнопки продолжают редактировать видимую запись', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(button('Реакция с условиями'));
    await user.click(screen.getByLabelText('Реагенты'));
    await user.click(element('H'));
    await user.click(button('Реакция с условиями'));
    await user.click(element('O'));
    expect(source()).toBe('\\ce{O}');
  });

  it('вставляет элементы в реагенты и продукты, собирает реакцию и добавляет знак газа', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(button('Реакция с условиями'));
    await user.click(screen.getByLabelText('Реагенты'));
    await user.click(element('Zn')); await user.click(button('+ Сложение веществ'));
    await user.click(digit(2)); await user.click(element('H')); await user.click(element('Cl'));
    await user.click(screen.getByLabelText('Продукты'));
    await user.click(element('Zn')); await user.click(element('Cl')); await user.click(digit(2));
    await user.click(button('+ Сложение веществ')); await user.click(element('H')); await user.click(digit(2));
    await user.click(button('Δ Нагревание'));
    await user.click(button('Собрать реакцию')); await user.click(button('↑ Газ'));
    expect(source()).toBe('\\ce{Zn + 2HCl ->[\\Delta] ZnCl2 + H2 ^}');
    expect(screen.getByLabelText('Вещество или реакция')).toHaveFocus();
  });
});
