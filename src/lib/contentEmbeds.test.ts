import { describe, expect, it } from 'vitest';
import fixtures from '../test/fixtures/content-embed-fixtures.json';
import {
  canMoveEmbed,
  embedBlocks,
  embedFileProblem,
  embedIds,
  embedToken,
  fillSlot,
  insertEmbed,
  moveEmbed,
  removeEmbed,
  replaceEmbed,
  serializeEmbedBlocks,
  stripEmbeds,
  updateTextBlock,
  type ContentEmbedPolicy,
} from './contentEmbeds';

const A = fixtures.legend.A;
const B = fixtures.legend.B;
const image = (id: string) => embedToken('image', id);
const file = (id: string) => embedToken('file', id);

describe('общий набор примеров вставок', () => {
  it('разбирает на блоки и собирает обратно ту же строку', () => {
    for (const fixture of fixtures.blocks) {
      const blocks = embedBlocks(fixture.text);
      const expected = fixture.blocks.map((block) => ('text' in block
        ? { type: 'text', text: block.text }
        : { type: 'embed', kind: block.kind, id: block.id, line: block.line }));
      expect(blocks, fixture.name).toEqual(expected);
      expect(serializeEmbedBlocks(blocks), fixture.name).toBe(fixture.text);
    }
  });

  it('id и текст без вставок — как в наборе', () => {
    for (const fixture of fixtures.ids) expect(embedIds(fixture.text), fixture.name).toEqual(fixture.ids);
    for (const fixture of fixtures.strip) expect(stripEmbeds(fixture.text)).toBe(fixture.expected);
  });
});

describe('операции редактора', () => {
  it('вставка посреди абзаца разрезает строку, на границе строк — не плодит пустых строк', () => {
    expect(insertEmbed('Первый\nВторой', { block: 0, offset: 6 }, 'image', A)).toBe(`Первый\n${image(A)}\nВторой`);
    expect(insertEmbed('Первый\nВторой', { block: 0, offset: 7 }, 'image', A)).toBe(`Первый\n${image(A)}\nВторой`);
    expect(insertEmbed('Первый', { block: 0, offset: 3 }, 'file', B)).toBe(`Пер\n${file(B)}\nвый`);
    expect(insertEmbed('Текст', { block: 0, offset: 0 }, 'image', A)).toBe(`${image(A)}\nТекст`);
  });

  it('без курсора — в конец, в пустой текст — единственной строкой, в пустое место — на него', () => {
    expect(insertEmbed('Текст', null, 'image', A)).toBe(`Текст\n${image(A)}`);
    expect(insertEmbed('', null, 'image', A)).toBe(image(A));
    expect(insertEmbed(`${image(A)}\n${file(B)}`, { slot: 1 }, 'image', A))
      .toBe(`${image(A)}\n${image(A)}\n${file(B)}`);
  });

  it('удаление склеивает текст до и после — вставка и удаление возвращают исходный текст', () => {
    const original = 'Первый\nВторой';
    const inserted = insertEmbed(original, { block: 0, offset: 6 }, 'image', A);
    expect(removeEmbed(inserted, 1)).toBe(original);
    expect(removeEmbed(`${image(A)}\nТекст`, 0)).toBe('Текст');
  });

  it('замена меняет файл на том же месте', () => {
    expect(replaceEmbed(`Текст\n${image(A)}\nещё`, 1, 'file', B)).toBe(`Текст\n${file(B)}\nещё`);
  });

  it('перемещение — на абзац или мимо соседней вставки, края неактивны', () => {
    const value = `Один\nДва\n${image(A)}\nТри`;
    expect(moveEmbed(value, 1, -1)).toBe(`Один\n${image(A)}\nДва\nТри`);
    expect(moveEmbed(value, 1, 1)).toBe(`Один\nДва\nТри\n${image(A)}`);
    expect(moveEmbed(`${image(A)}\n${file(B)}`, 1, -1)).toBe(`${file(B)}\n${image(A)}`);
    expect(canMoveEmbed(`${image(A)}\nТекст`, 0, -1)).toBe(false);
    expect(canMoveEmbed(`Текст\n${image(A)}`, 1, 1)).toBe(false);
    // Обратный сдвиг возвращает исходный текст.
    expect(moveEmbed(moveEmbed(value, 1, -1), 1, 1)).toBe(value);
  });

  it('опустевший блок рядом со вставкой исчезает, текст в пустом месте становится блоком', () => {
    expect(updateTextBlock(`Текст\n${image(A)}`, 0, '')).toBe(image(A));
    expect(updateTextBlock('Текст', 0, '')).toBe('');
    expect(fillSlot(`${image(A)}\n${file(B)}`, 1, 'между')).toBe(`${image(A)}\nмежду\n${file(B)}`);
    expect(fillSlot(image(A), 1, '')).toBe(image(A));
  });
});

describe('проверка файла до отправки', () => {
  const policy: ContentEmbedPolicy = {
    enabled: true, maxEmbedsPerField: 20,
    image: { maxBytes: 10 * 1024 * 1024, extensions: ['jpeg', 'jpg', 'png', 'webp'] },
    file: { maxBytes: 50 * 1024 * 1024, extensions: ['docx', 'pdf'] },
  };

  it('отказывает по формату и размеру с причиной', () => {
    expect(embedFileProblem({ name: 'scan.heic', size: 10 }, 'image', policy)).toContain('JPG, PNG или WebP');
    expect(embedFileProblem({ name: 'big.png', size: 11 * 1024 * 1024 }, 'image', policy)).toContain('10 МБ');
    expect(embedFileProblem({ name: 'plan.DOCX', size: 10 }, 'file', policy)).toBeNull();
    expect(embedFileProblem({ name: 'empty.pdf', size: 0 }, 'file', policy)).toContain('пустой');
  });
});
