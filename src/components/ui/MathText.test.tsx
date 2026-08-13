import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MathText } from './MathText';
import { hasMath, splitMath, wrapFormula } from '@/lib/mathMarkup';

describe('splitMath', () => {
  it('делит текст на обычные и математические куски', () => {
    expect(splitMath('Дано $x^2$ и $$y = 2$$')).toEqual([
      { kind: 'text', value: 'Дано ' },
      { kind: 'math', value: 'x^2', display: false },
      { kind: 'text', value: ' и ' },
      { kind: 'math', value: 'y = 2', display: true },
    ]);
  });

  it('не считает экранированный доллар разделителем', () => {
    expect(hasMath('Цена 5\\$ и 10\\$')).toBe(false);
  });

  it('незакрытую формулу оставляет текстом, а не съедает', () => {
    expect(splitMath('Ответ: $\\frac{1}{2')).toEqual([
      { kind: 'text', value: 'Ответ: $\\frac{1}{2' },
    ]);
  });

  it('оборачивает формулу для вставки из редактора', () => {
    expect(wrapFormula('\\frac{1}{2}')).toBe('$\\frac{1}{2}$');
    expect(wrapFormula('x = 1', true)).toBe('$$x = 1$$');
  });
});

describe('MathText', () => {
  it('рендерит формулу через KaTeX', () => {
    const { container } = render(<MathText text="Найдите $\frac{1}{2}$" />);
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.textContent).toContain('Найдите');
  });

  it('текст без формул выводит как есть, сохраняя переводы строк', () => {
    const { container } = render(<MathText text={'Первая строка\nвторая'} />);
    expect(container.querySelector('.katex')).toBeNull();
    expect(container.textContent).toBe('Первая строка\nвторая');
  });

  it('сломанную формулу показывает сырым LaTeX, а не пустотой', () => {
    const { container } = render(<MathText text="Ответ $\frac{1}$$" />);
    const fallback = container.querySelector('code');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain('\\frac{1}');
  });

  it('не отдаёт рендереру запрещённые команды', () => {
    const { container } = render(<MathText text="$\def\x{1}x$" />);
    expect(container.querySelector('.katex')).toBeNull();
    expect(container.querySelector('code')?.getAttribute('title')).toContain('недопустимая команда');
  });

  it('блочную формулу выводит отдельным блоком с прокруткой', () => {
    const { container } = render(<MathText text={'$$\\begin{cases} x = 1 \\\\ y = 2 \\end{cases}$$'} />);
    const block = container.querySelector('span.block');
    expect(block).not.toBeNull();
    expect(block?.className).toContain('overflow-x-auto');
  });

  it('литеральный доллар показывает знаком доллара', () => {
    const { container } = render(<MathText text="Цена 5\$" />);
    expect(container.textContent).toBe('Цена 5$');
  });
});
