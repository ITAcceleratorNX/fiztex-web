import { describe, expect, it } from 'vitest';
import { parseMarkdown, parseSpans } from './markdown';

describe('parseSpans', () => {
  it('выделяет жирные фрагменты', () => {
    expect(parseSpans('**Частота:** почти половина')).toEqual([
      { text: 'Частота:', bold: true },
      { text: ' почти половина', bold: false },
    ]);
  });

  it('одиночную звёздочку разметкой не считает', () => {
    expect(parseSpans('оценка 4*5 баллов')).toEqual([{ text: 'оценка 4*5 баллов', bold: false }]);
  });

  it('незакрытый жирный оставляет текстом — терять текст нельзя', () => {
    expect(parseSpans('**Рекомендации')).toEqual([{ text: '**Рекомендации', bold: false }]);
  });
});

describe('parseMarkdown', () => {
  it('читает заголовки по числу решёток', () => {
    expect(parseMarkdown('# Отчёт\n\n## Общая сводка')).toEqual([
      { type: 'heading', level: 1, spans: [{ text: 'Отчёт', bold: false }] },
      { type: 'heading', level: 2, spans: [{ text: 'Общая сводка', bold: false }] },
    ]);
  });

  it('склеивает перенос внутри абзаца, но не через пустую строку', () => {
    const blocks = parseMarkdown('Первая строка\nпродолжение.\n\nВторой абзац.');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      spans: [{ text: 'Первая строка продолжение.', bold: false }],
    });
  });

  it('собирает маркированный список с вложенностью', () => {
    const blocks = parseMarkdown([
      '*   **Меню:**',
      '    *   Вегетарианские блюда',
      '    *   Свежие салаты',
      '*   Размер порций',
    ].join('\n'));

    expect(blocks).toHaveLength(1);
    const list = blocks[0];
    expect(list.type).toBe('list');
    if (list.type !== 'list') return;
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);
    expect(list.items[0].spans).toEqual([{ text: 'Меню:', bold: true }]);
    expect(list.items[0].children.map((c) => c.spans[0].text)).toEqual([
      'Вегетарианские блюда',
      'Свежие салаты',
    ]);
    expect(list.items[1].children).toEqual([]);
  });

  it('уровень вложенности считает от первого пункта, а не от числа пробелов', () => {
    // Модель отбивает вложенность то двумя пробелами, то четырьмя; список,
    // начатый с отступом, не должен целиком уехать во вложенные.
    const blocks = parseMarkdown('  * Первый\n      * Вложенный\n  * Второй');
    const list = blocks[0];
    if (list.type !== 'list') throw new Error('ожидался список');
    expect(list.items.map((i) => i.spans[0].text)).toEqual(['Первый', 'Второй']);
    expect(list.items[0].children[0].spans[0].text).toBe('Вложенный');
  });

  it('нумерованный и маркированный списки не сливаются в один', () => {
    const blocks = parseMarkdown('1. Расширить меню\n2. Пересмотреть порции\n\n* Заметка');
    expect(blocks.map((b) => b.type)).toEqual(['list', 'list']);
    const [ordered, bullet] = blocks;
    if (ordered.type !== 'list' || bullet.type !== 'list') throw new Error('ожидались списки');
    expect(ordered.ordered).toBe(true);
    expect(ordered.items).toHaveLength(2);
    expect(bullet.ordered).toBe(false);
  });

  it('вложенные пункты нумерованного списка остаются под своим пунктом', () => {
    const blocks = parseMarkdown([
      '1.  **Расширение меню:**',
      '    *   Вегетарианские блюда дважды в неделю.',
      '2.  **Размер порций:**',
    ].join('\n'));
    const list = blocks[0];
    if (list.type !== 'list') throw new Error('ожидался список');
    expect(list.ordered).toBe(true);
    expect(list.items).toHaveLength(2);
    expect(list.items[0].children).toHaveLength(1);
  });

  it('пустой отчёт — пустой разбор, а не пустой абзац', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown(null)).toEqual([]);
    expect(parseMarkdown('\n\n  \n')).toEqual([]);
  });

  it('не роняет текст на конструкциях, которых не знает', () => {
    const blocks = parseMarkdown('> цитата\n\n| a | b |');
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.type === 'paragraph')).toBe(true);
  });
});
