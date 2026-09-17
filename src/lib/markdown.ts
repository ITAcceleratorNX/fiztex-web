/**
 * Разбор той разметки, которой отвечает модель, — и только её.
 *
 * Библиотеки нет намеренно: разметка приходит из одного места (наши же промпты
 * AI-анализа), и нужна ровно одна операция — «дай блоки, чтобы их нарисовать».
 * `react-markdown` с `remark` притащил бы разбор ссылок, таблиц, html и сносок ради
 * четырёх конструкций, которых модель придерживается: заголовок, абзац, список
 * (маркированный и нумерованный, с одним уровнем вложенности) и жирный фрагмент.
 *
 * Разбор ничего не исполняет и не строит html: результат — данные, а рисует их
 * React. Поэтому текст отчёта не может ничего внедрить в страницу, что бы модель
 * ни написала.
 *
 * Чего здесь нет и не нужно: ссылок, картинок, таблиц, цитат, кода. Встретив их,
 * разбор оставит строку обычным текстом — потерять форматирование в отчёте не
 * страшно, потерять текст нельзя.
 */

/** Жирный фрагмент внутри строки — единственная инлайновая разметка отчёта. */
export interface MarkdownSpan {
  text: string;
  bold: boolean;
}

export interface MarkdownHeading {
  type: 'heading';
  /** 1 — название отчёта, 2 и глубже — разделы. */
  level: number;
  spans: MarkdownSpan[];
}

export interface MarkdownParagraph {
  type: 'paragraph';
  spans: MarkdownSpan[];
}

export interface MarkdownListItem {
  spans: MarkdownSpan[];
  /** Вложенные пункты — второй уровень, глубже модель не уходит. */
  children: MarkdownListItem[];
}

export interface MarkdownList {
  type: 'list';
  ordered: boolean;
  items: MarkdownListItem[];
}

export type MarkdownBlock = MarkdownHeading | MarkdownParagraph | MarkdownList;

const HEADING = /^(#{1,6})\s+(.*)$/;
/** `*`, `-`, `•` — маркер; `1.` и `1)` — номер. Отступ слева задаёт уровень. */
const BULLET = /^(\s*)[*\-•]\s+(.*)$/;
const ORDERED = /^(\s*)\d+[.)]\s+(.*)$/;

/**
 * Жирный размечается `**…**`. Одиночная звёздочка курсивом не считается: в этих
 * отчётах она чаще маркер списка, съехавший в середину строки, чем разметка.
 */
export function parseSpans(line: string): MarkdownSpan[] {
  const spans: MarkdownSpan[] = [];
  let rest = line;
  while (rest.length > 0) {
    const open = rest.indexOf('**');
    if (open < 0) break;
    const close = rest.indexOf('**', open + 2);
    if (close < 0) break;
    if (open > 0) spans.push({ text: rest.slice(0, open), bold: false });
    const bold = rest.slice(open + 2, close);
    if (bold) spans.push({ text: bold, bold: true });
    rest = rest.slice(close + 2);
  }
  if (rest) spans.push({ text: rest, bold: false });
  return spans.length ? spans : [{ text: line, bold: false }];
}

interface ListLine {
  indent: number;
  ordered: boolean;
  text: string;
}

function listLine(line: string): ListLine | null {
  const ordered = ORDERED.exec(line);
  if (ordered) return { indent: ordered[1].length, ordered: true, text: ordered[2] };
  const bullet = BULLET.exec(line);
  if (bullet) return { indent: bullet[1].length, ordered: false, text: bullet[2] };
  return null;
}

/**
 * Собирает подряд идущие пункты в один список.
 *
 * Вложенность определяется отступом относительно **первого** пункта, а не
 * абсолютной величиной: модель отбивает вложенный уровень то двумя пробелами, то
 * четырьмя, и порог, прибитый к числу, разваливал бы половину отчётов.
 */
function takeList(lines: string[], start: number): { block: MarkdownList; next: number } {
  const first = listLine(lines[start])!;
  const items: MarkdownListItem[] = [];
  let index = start;

  while (index < lines.length) {
    const parsed = listLine(lines[index]);
    if (!parsed) break;
    // Смена вида списка на верхнем уровне — это уже другой список.
    if (parsed.indent <= first.indent && parsed.ordered !== first.ordered) break;

    if (parsed.indent > first.indent && items.length) {
      items[items.length - 1].children.push({ spans: parseSpans(parsed.text), children: [] });
    } else {
      items.push({ spans: parseSpans(parsed.text), children: [] });
    }
    index += 1;
  }

  return { block: { type: 'list', ordered: first.ordered, items }, next: index };
}

export function parseMarkdown(source: string | null | undefined): MarkdownBlock[] {
  if (!source) return [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, spans: parseSpans(heading[2]) });
      index += 1;
      continue;
    }

    if (listLine(line)) {
      const { block, next } = takeList(lines, index);
      blocks.push(block);
      index = next;
      continue;
    }

    // Абзац идёт до пустой строки или до начала другого блока: перенос внутри
    // абзаца у модели означает продолжение мысли, а не новый абзац.
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !HEADING.test(lines[index]) && !listLine(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', spans: parseSpans(paragraph.join(' ')) });
  }

  return blocks;
}
