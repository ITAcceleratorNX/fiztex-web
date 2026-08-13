import { describe, expect, it } from 'vitest';
import {
  insertFormulaAt,
  removeFormulaAt,
  replaceFormulaAt,
  splitMath,
  stripPlaceholders,
} from './mathMarkup';
import { checkFormulas, hasBlockingProblem } from './formulaChecks';

describe('вставка и правка формул', () => {
  it('вставляет формулу на позицию курсора и добавляет пробелы по необходимости', () => {
    expect(insertFormulaAt('Найдитепри x=2', 'Найдите'.length, 'v', false)).toEqual({
      text: 'Найдите $v$ при x=2',
      cursor: 'Найдите $v$ '.length,
    });
  });

  it('не приклеивает пробел перед знаком препинания', () => {
    expect(insertFormulaAt('Ответ: .', 'Ответ: '.length, 'x^2').text).toBe('Ответ: $x^2$.');
  });

  it('меняет именно ту формулу, по которой щёлкнули', () => {
    const text = 'Дано $x$ и $x$, найдите $y$';
    expect(replaceFormulaAt(text, 1, 'z', false)).toBe('Дано $x$ и $z$, найдите $y$');
  });

  it('сохраняет блочность остальных формул при правке', () => {
    const text = 'Система: $$x + y$$ и $z$';
    expect(replaceFormulaAt(text, 1, 'w', false)).toBe('Система: $$x + y$$ и $w$');
  });

  it('удаляет формулу вместе с разделителями', () => {
    expect(removeFormulaAt('Дано $x$ и $y$', 0)).toBe('Дано и $y$');
  });

  it('считает формулы по порядку, а не по сегментам текста', () => {
    const segments = splitMath('$a$ текст $b$ текст $c$');
    expect(segments.filter((s) => s.kind === 'math')).toHaveLength(3);
  });
});

describe('живая проверка формул в редакторе', () => {
  it('нераспознанный фрагмент блокирует публикацию', () => {
    const problems = checkFormulas([{ where: 'Текст вопроса', text: 'Вычислите $16^{[?]}$' }]);
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe('error');
    expect(hasBlockingProblem(problems)).toBe(true);
  });

  it('непарный доллар блокирует публикацию', () => {
    const problems = checkFormulas([{ where: 'Вариант 1', text: 'Ответ $\\frac{1}{2}' }]);
    expect(problems[0].severity).toBe('error');
    expect(problems[0].where).toBe('Вариант 1');
  });

  it('нерисуемая формула — предупреждение, а не блокировка', () => {
    const problems = checkFormulas([{ where: 'Текст вопроса', text: '$\\frac{1}{2$' }]);
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe('warning');
    expect(hasBlockingProblem(problems)).toBe(false);
  });

  it('на исправном тексте молчит', () => {
    expect(
      checkFormulas([
        { where: 'Текст вопроса', text: 'Найдите $\\rho = \\frac{m}{V}$ при $m = 2{,}5$ кг' },
        { where: 'Вариант 1', text: '$833$ кг/м³' },
        { where: 'Эталонный ответ', text: '' },
      ]),
    ).toEqual([]);
  });

  it('экранированный доллар не считается непарным', () => {
    expect(checkFormulas([{ where: 'Текст вопроса', text: 'Цена 5\\$' }])).toEqual([]);
  });
});

describe('метки визуального редактора', () => {
  it('снимает \\placeholder перед вставкой в текст', () => {
    expect(stripPlaceholders('\\begin{cases}\\placeholder{}\\\\ \\placeholder{}\\end{cases}')).toBe(
      '\\begin{cases}\\\\ \\end{cases}',
    );
    expect(stripPlaceholders('\\frac{\\placeholder{2}}{\\placeholder{3}}')).toBe('\\frac{2}{3}');
    expect(stripPlaceholders('\\sqrt{\\placeholder[label]{x}}')).toBe('\\sqrt{x}');
  });

  it('обычную формулу не меняет', () => {
    expect(stripPlaceholders('\\frac{m}{V}')).toBe('\\frac{m}{V}');
  });
});

describe('подсказки по записям, которые LaTeX рисует не так, как прочитаны', () => {
  it('предупреждает про неэкранированный процент', () => {
    const problems = checkFormulas([{ where: 'Текст вопроса', text: 'Скидка $50% \\text{от цены}$' }]);
    expect(problems.map((p) => p.message).join(' ')).toContain('\\%');
    expect(hasBlockingProblem(problems)).toBe(false);
  });

  it('предупреждает про многозначный показатель без скобок', () => {
    const problems = checkFormulas([{ where: 'Вариант 1', text: '$10^-19$' }]);
    expect(problems.map((p) => p.message).join(' ')).toContain('в скобках');
  });

  it('на правильной записи молчит', () => {
    expect(
      checkFormulas([{ where: 'Текст вопроса', text: '$50\\%$ и $10^{-19}$ и $\\sqrt{\\sqrt{2}}$' }]),
    ).toEqual([]);
  });
});
