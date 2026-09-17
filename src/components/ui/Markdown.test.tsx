import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

const REPORT = [
  '# Отчёт по результатам опроса "Школьное питание"',
  '',
  '## Общая сводка',
  '',
  'В опросе приняли участие 28 респондентов.',
  '',
  '*   **Частота посещения:** половина обедает каждый день.',
  '    *   Вегетарианские блюда',
  '',
  '## Рекомендации',
  '',
  '1.  **Расширить меню:**',
  '    *   Добавить салаты.',
].join('\n');

describe('Markdown', () => {
  it('не показывает разметку читателю', () => {
    const { container } = render(<Markdown source={REPORT} />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('**');
    expect(text).not.toMatch(/(^|\s)#{1,6}\s/);
    expect(text).not.toMatch(/(^|\s)\*\s/);
  });

  it('жирный фрагмент остаётся выделенным, а не растворяется в тексте', () => {
    render(<Markdown source={REPORT} />);
    expect(screen.getByText('Частота посещения:').tagName).toBe('STRONG');
  });

  it('списки становятся списками, а нумерованный сохраняет номера', () => {
    const { container } = render(<Markdown source={REPORT} />);
    expect(container.querySelectorAll('ul').length).toBeGreaterThan(0);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('по флагу снимает заглавие отчёта — оно уже стоит над карточкой', () => {
    const { rerender } = render(<Markdown source={REPORT} />);
    expect(screen.getByText(/Отчёт по результатам опроса/)).toBeInTheDocument();

    rerender(<Markdown source={REPORT} skipLeadingHeading />);
    expect(screen.queryByText(/Отчёт по результатам опроса/)).not.toBeInTheDocument();
    expect(screen.getByText('Общая сводка')).toBeInTheDocument();
  });

  it('пустой отчёт не рисует пустую карточку', () => {
    const { container } = render(<Markdown source={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('текст не превращается в html, что бы ни пришло от модели', () => {
    const { container } = render(<Markdown source={'<img src=x onerror="alert(1)"> и **текст**'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });
});
