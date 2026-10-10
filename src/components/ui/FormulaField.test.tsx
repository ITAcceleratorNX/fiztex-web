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
  class FakeKeyboard extends EventTarget {
    layouts = [];
    container: HTMLElement | null = null;
    visible = false;
    boundingRect = { height: 0 };
    show() { this.visible = true; this.boundingRect.height = 200; this.dispatchEvent(new Event('geometrychange')); }
    hide() { this.visible = false; this.boundingRect.height = 0; this.dispatchEvent(new Event('geometrychange')); }
  }
  const keyboard = new FakeKeyboard();
  Object.assign(window, { mathVirtualKeyboard: keyboard });
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
  it('открывает химический конструктор с пустого поля и вставляет выбранное вещество без промежуточного применения', async () => {
    const user = userEvent.setup(); const onChange = vi.fn();
    render(<FormulaField profile="CHEMISTRY" value="" onChange={onChange} />);
    await user.click(button('Формула'));
    expect(screen.getByLabelText('Вещество или реакция')).toHaveValue('');
    expect(button('Математические обозначения')).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByLabelText('Водород, H, атомный номер 1'));
    await user.click(screen.getByLabelText('Цифра 2'));
    await user.click(screen.getByLabelText('Кислород, O, атомный номер 8'));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(button('Вставить формулу'));
    expect(onChange).toHaveBeenCalledWith('$\\ce{H2O}$');
  });

  it('не сохраняет собранную химическую запись после отмены общего окна', async () => {
    const user = userEvent.setup(); const onChange = vi.fn();
    render(<FormulaField profile="CHEMISTRY" value="" onChange={onChange} />);
    await user.click(button('Формула'));
    await user.click(screen.getByLabelText('Кальций, Ca, атомный номер 20'));
    await user.click(button('2+'));
    await user.click(button('Отмена'));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(button('Формула'));
    expect(screen.getByLabelText('Вещество или реакция')).toHaveValue('');
  });

  it('блокирует вставку незаконченной химической записи и сохраняет исправленную', async () => {
    const user = userEvent.setup(); const onChange = vi.fn();
    render(<FormulaField profile="CHEMISTRY" value={'$\\ce{Fe}$'} onChange={onChange} />);
    await user.click(screen.getByTitle('Изменить формулу'));
    const argument = screen.getByLabelText('Вещество или реакция');
    await user.clear(argument); await user.paste('Fe^{2');
    expect(button('Вставить формулу')).toBeDisabled();
    await user.type(argument, '+}');
    expect(button('Вставить формулу')).toBeEnabled();
    await user.click(button('Вставить формулу'));
    expect(onChange).toHaveBeenCalledWith('$\\ce{Fe^{2+}}$');
  });

  it('сохраняет химическую запись при открытии математического редактора и скрывает его клавиатуру', async () => {
    const user = userEvent.setup(); const onChange = vi.fn();
    render(<FormulaField profile="CHEMISTRY" value={'$\\ce{H2O}$'} onChange={onChange} />);
    await user.click(screen.getByTitle('Изменить формулу'));
    await user.click(button('Математические обозначения'));
    await waitFor(() => expect(button('Показать клавиатуру')).toBeInTheDocument());
    await user.click(button('Показать клавиатуру'));
    await user.click(button('Скрыть математический редактор'));
    expect(window.mathVirtualKeyboard.visible).toBe(false);
    expect(screen.getByLabelText('Вещество или реакция')).toHaveValue('H2O');
    await user.click(button('Вставить формулу'));
    expect(onChange).toHaveBeenCalledWith('$\\ce{H2O}$');
  });

  it('размещает клавиатуру внутри диалога, скрывает по кнопке и при закрытии без потери формулы', async () => {
    const user = userEvent.setup();
    render(<FormulaField value="Дано $x^2$" onChange={vi.fn()} />);
    await user.click(screen.getByTitle('Изменить формулу'));
    await waitFor(() => expect(button('Показать клавиатуру')).toBeInTheDocument());
    expect(window.mathVirtualKeyboard.container).toBe(document.querySelector('[data-formula-keyboard]'));
    expect(document.querySelector('[role="dialog"]')).toContainElement(window.mathVirtualKeyboard.container);
    await user.click(button('Показать клавиатуру'));
    expect(button('Скрыть клавиатуру')).toHaveAttribute('aria-expanded', 'true');
    await user.click(button('Скрыть клавиатуру'));
    expect(window.mathVirtualKeyboard.visible).toBe(false);
    expect(latexInput()).toHaveValue('x^2');
    await user.click(button('Показать клавиатуру'));
    await user.click(button('Отмена'));
    expect(window.mathVirtualKeyboard.visible).toBe(false);
    expect(window.mathVirtualKeyboard.container).toBeNull();
    await user.click(screen.getByTitle('Изменить формулу'));
    await waitFor(() => expect(button('Показать клавиатуру')).toBeInTheDocument());
    expect(latexInput()).toHaveValue('x^2');
  });

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

  it('при сохранении блокирует текст и правку формул, оставляя предпросмотр', () => {
    render(<FormulaField value="Дано $x$" onChange={vi.fn()} disabled ariaLabel="Текст вопроса" />);
    expect(screen.getByLabelText('Текст вопроса')).toBeDisabled();
    expect(screen.queryByText('Формула')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Изменить формулу')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Удалить формулу')).not.toBeInTheDocument();
    expect(screen.getByText('Предпросмотр')).toBeInTheDocument();
  });

  it('без формул предпросмотр не показывается', () => {
    render(<FormulaField value="Столица Казахстана?" onChange={vi.fn()} />);
    expect(screen.queryByText('Предпросмотр')).toBeNull();
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
  it('правит выбранный химический блок, сохраняя соседнюю формулу и окружающий LaTeX', async () => {
    const user = userEvent.setup(); const onChange = vi.fn();
    render(<FormulaField profile="CHEMISTRY" value={'Дано $x+\\ce{H2O}+\\ce{Fe^{2+}}$'} onChange={onChange} />);
    await user.click(screen.getByTitle('Изменить формулу'));
    await waitFor(() => latexInput());
    await user.click(screen.getByLabelText('Химический блок'));
    await user.click(screen.getByRole('option', { name: '2. Fe^{2+}' }));
    const argument = screen.getByLabelText('Вещество или реакция');
    await user.clear(argument); await user.paste('Fe^{3+}');
    await user.click(button('Вставить формулу'));
    expect(onChange).toHaveBeenCalledWith('Дано $x+\\ce{H2O}+\\ce{Fe^{3+}}$');
  });

  it('отмена химической правки и закрытие окна сохраняют исходный текст', async () => {
    const user = userEvent.setup(); const onChange = vi.fn();
    render(<FormulaField profile="CHEMISTRY" value={'$\\ce{H2O}$'} onChange={onChange} />);
    await user.click(screen.getByTitle('Изменить формулу'));
    await user.clear(screen.getByLabelText('Вещество или реакция'));
    await user.paste('CO2');
    await user.click(button('Отменить правку блока'));
    expect(screen.getByLabelText('Вещество или реакция')).toHaveValue('H2O');
    await user.click(button('Отмена'));
    expect(onChange).not.toHaveBeenCalled();
  });

});
