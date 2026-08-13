import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormulaField } from './FormulaField';

/**
 * MathLive в jsdom не поднимается (веб-компонент + шрифты), а поведение окна проверять нужно.
 * Подставляем минимальную замену с тем же контрактом — `value`, `insert`, событие `input`.
 * Конструктор возвращает обычный `<textarea>`: от поля здесь нужны только значение, стиль
 * и события.
 */
vi.mock('mathlive', () => {
  class FakeMathfield {
    static fontsDirectory: string | null = '';
    static soundsDirectory: string | null = '';

    constructor() {
      const element = document.createElement('textarea');
      Object.assign(element, {
        insert(latex: string) {
          element.value += latex.replace(/#\?/g, '');
          element.dispatchEvent(new Event('input'));
        },
      });
      return element as unknown as FakeMathfield;
    }
  }
  return { MathfieldElement: FakeMathfield };
});

/**
 * Запросы по тексту и `title`, а не по роли: KaTeX отдаёт MathML, а jsdom падает, когда
 * считает доступное имя по узлам чужого пространства имён. Отказываться от MathML нельзя —
 * именно он даёт формулу скринридеру.
 */
function button(label: string): HTMLButtonElement {
  const element = screen.getByText(label).closest('button');
  if (!element) throw new Error(`кнопка «${label}» не найдена`);
  return element as HTMLButtonElement;
}

function latexInput(): HTMLInputElement | HTMLTextAreaElement {
  const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    '[aria-label="Разметка формулы"]',
  );
  if (!element) throw new Error('поле разметки формулы не найдено');
  return element;
}

describe('FormulaField', () => {
  it('вставляет собранную формулу на позицию курсора', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormulaField value="Найдите " onChange={onChange} ariaLabel="Текст вопроса" />);

    await user.click(button('Формула'));
    await waitFor(() => latexInput());
    await user.click(latexInput());
    await user.paste('\\frac{m}{V}');
    await user.click(button('Вставить формулу'));

    expect(onChange).toHaveBeenCalledWith('Найдите $\\frac{m}{V}$');
  });

  it('щелчок по формуле в предпросмотре правит именно её', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormulaField value="Дано $x$ и $y$" onChange={onChange} />);

    const formulaButtons = screen.getAllByTitle('Изменить формулу');
    expect(formulaButtons).toHaveLength(2);
    await user.click(formulaButtons[1]);

    await waitFor(() => expect(latexInput()).toHaveValue('y'));
    await user.clear(latexInput());
    await user.paste('z');
    await user.click(button('Вставить формулу'));

    expect(onChange).toHaveBeenCalledWith('Дано $x$ и $z$');
  });

  it('удаляет формулу из текста', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormulaField value="Дано $x$ и $y$" onChange={onChange} />);

    await user.click(screen.getAllByTitle('Удалить формулу')[0]);
    expect(onChange).toHaveBeenCalledWith('Дано и $y$');
  });

  it('без формул предпросмотр не показывается', () => {
    render(<FormulaField value="Столица Казахстана?" onChange={vi.fn()} />);
    expect(screen.queryByText('Так увидит ученик')).toBeNull();
  });

  it('не даёт вставить формулу с запрещённой командой', async () => {
    const user = userEvent.setup();
    render(<FormulaField value="" onChange={vi.fn()} />);

    await user.click(button('Формула'));
    await waitFor(() => latexInput());
    await user.click(latexInput());
    await user.paste('\\def\\x{1}x');

    expect(button('Вставить формулу')).toBeDisabled();
  });
});
