import type { Schema } from './apiSchemas';

/**
 * Вставки в тексте учебного материала (CONTENT-EMBED-001,
 * `fiztex-back/docs/content-embeds-contract.md`).
 *
 * Вставка — строка текста целиком: `[[image:<uuid>]]` или `[[file:<uuid>]]`. Последовательность
 * «текст — рисунок — файл — текст» живёт в той же строке, что и раньше, как формулы `$…$`.
 *
 * Главное свойство: `serializeEmbedBlocks(embedBlocks(s)) === s` для любой строки. Открыть старый
 * текст и сохранить его без правок обязано вернуть ровно то же самое — поэтому строки делятся
 * только по `\n`, а у вставки запоминается исходная строка вместе с пробелами вокруг маркера.
 *
 * Та же модель — в `fiztex-back` (`EmbedMarkup`) и в мобилке (`shared/content/embedMarkup.js`);
 * общий набор примеров — `src/test/fixtures/content-embed-fixtures.json`.
 */

export type ContentEmbed = Schema<'ContentEmbedView'>;
export type ContentEmbedPolicy = Schema<'ContentEmbedPolicyView'>;
export type EmbedKind = 'image' | 'file';

export type TextBlock = { type: 'text'; text: string };
export type EmbedBlock = { type: 'embed'; kind: EmbedKind; id: string; line: string };
export type ContentBlock = TextBlock | EmbedBlock;

/** Место курсора: смещение в текстовом блоке или пустое место между вставками. */
export type EmbedCursor =
  | { block: number; offset: number }
  | { slot: number };

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const LINE = new RegExp(`^[ \\t]*\\[\\[(image|file):(${UUID})\\]\\][ \\t]*\\r?$`);

export function embedToken(kind: EmbedKind, id: string): string {
  return `[[${kind}:${id}]]`;
}

export function embedKindOf(view: Pick<ContentEmbed, 'kind'>): EmbedKind {
  return view.kind === 'FILE' ? 'file' : 'image';
}

function parseLine(line: string): EmbedBlock | null {
  if (!line.includes('[[')) return null;
  const match = LINE.exec(line);
  return match ? { type: 'embed', kind: match[1] as EmbedKind, id: match[2], line } : null;
}

export function embedBlocks(text: string | null | undefined): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let pending: string[] = [];
  for (const line of (text ?? '').split('\n')) {
    const embed = parseLine(line);
    if (!embed) {
      pending.push(line);
      continue;
    }
    if (pending.length) {
      blocks.push({ type: 'text', text: pending.join('\n') });
      pending = [];
    }
    blocks.push(embed);
  }
  if (pending.length) blocks.push({ type: 'text', text: pending.join('\n') });
  return blocks;
}

export function serializeEmbedBlocks(blocks: ContentBlock[]): string {
  return blocks.map((block) => (block.type === 'text' ? block.text : block.line)).join('\n');
}

/** id в порядке появления, без повторов. */
export function embedIds(text: string | null | undefined): string[] {
  const ids: string[] = [];
  for (const block of embedBlocks(text)) {
    if (block.type === 'embed' && !ids.includes(block.id)) ids.push(block.id);
  }
  return ids;
}

export function hasEmbeds(text: string | null | undefined): boolean {
  return Boolean(text) && embedBlocks(text).some((block) => block.type === 'embed');
}

/** Текст без строк-вставок — для превью, счётчиков слов и сниппетов. */
export function stripEmbeds(text: string | null | undefined): string {
  if (!text || !hasEmbeds(text)) return text ?? '';
  return text.split('\n').filter((line) => !parseLine(line)).join('\n');
}

// ---------------------------------------------------------------- операции редактора

function canonical(kind: EmbedKind, id: string): EmbedBlock {
  return { type: 'embed', kind, id, line: embedToken(kind, id) };
}

/**
 * Пустой текстовый блок рядом с изменённым местом в строку не идёт: иначе вставка и
 * удаление рисунка оставляли бы после себя лишние пустые строки.
 */
function compact(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.filter((block) => block.type !== 'text' || block.text !== '');
}

/**
 * Вставить маркер в место курсора. Курсор посреди строки разрезает её; курсор на границе строк
 * не плодит пустых строк вокруг вставки. Без курсора — в конец.
 */
export function insertEmbed(value: string, cursor: EmbedCursor | null, kind: EmbedKind, id: string): string {
  const blocks = embedBlocks(value);
  const embed = canonical(kind, id);
  if (value === '') return embed.line;

  if (!cursor) return serializeEmbedBlocks([...blocks, embed]);

  if ('slot' in cursor) {
    const at = Math.max(0, Math.min(cursor.slot, blocks.length));
    return serializeEmbedBlocks([...blocks.slice(0, at), embed, ...blocks.slice(at)]);
  }

  const target = blocks[cursor.block];
  if (!target || target.type !== 'text') return serializeEmbedBlocks([...blocks, embed]);
  const offset = Math.max(0, Math.min(cursor.offset, target.text.length));
  let before = target.text.slice(0, offset);
  let after = target.text.slice(offset);
  if (before.endsWith('\n')) before = before.slice(0, -1);
  if (after.startsWith('\n')) after = after.slice(1);
  const replaced: ContentBlock[] = [];
  if (before !== '') replaced.push({ type: 'text', text: before });
  replaced.push(embed);
  if (after !== '') replaced.push({ type: 'text', text: after });
  return serializeEmbedBlocks([...blocks.slice(0, cursor.block), ...replaced, ...blocks.slice(cursor.block + 1)]);
}

/** Заменить файл вставки, не трогая её место. */
export function replaceEmbed(value: string, blockIndex: number, kind: EmbedKind, id: string): string {
  const blocks = embedBlocks(value);
  if (blocks[blockIndex]?.type !== 'embed') return value;
  blocks[blockIndex] = canonical(kind, id);
  return serializeEmbedBlocks(blocks);
}

/** Убрать вставку. Текст до и после склеивается через перевод строки. */
export function removeEmbed(value: string, blockIndex: number): string {
  const blocks = embedBlocks(value);
  if (blocks[blockIndex]?.type !== 'embed') return value;
  const before = blocks[blockIndex - 1];
  const after = blocks[blockIndex + 1];
  if (before?.type === 'text' && after?.type === 'text') {
    const merged: TextBlock = { type: 'text', text: `${before.text}\n${after.text}` };
    return serializeEmbedBlocks([...blocks.slice(0, blockIndex - 1), merged, ...blocks.slice(blockIndex + 2)]);
  }
  return serializeEmbedBlocks([...blocks.slice(0, blockIndex), ...blocks.slice(blockIndex + 1)]);
}

/** Можно ли сдвинуть вставку: выше — если перед ней что-то есть, ниже — если после. */
export function canMoveEmbed(value: string, blockIndex: number, direction: -1 | 1): boolean {
  const blocks = embedBlocks(value);
  const neighbour = blocks[blockIndex + direction];
  if (!neighbour) return false;
  return neighbour.type === 'embed' || neighbour.text.split('\n').some((line) => line.trim() !== '');
}

/**
 * Сдвинуть вставку на один абзац. Абзац — непустая строка текста (вместе с пустыми строками за
 * ней); соседняя вставка просто меняется местами.
 */
export function moveEmbed(value: string, blockIndex: number, direction: -1 | 1): string {
  if (!canMoveEmbed(value, blockIndex, direction)) return value;
  const blocks = embedBlocks(value);
  const embed = blocks[blockIndex] as EmbedBlock;
  const neighbourIndex = blockIndex + direction;
  const neighbour = blocks[neighbourIndex];

  if (neighbour.type === 'embed') {
    blocks[blockIndex] = neighbour;
    blocks[neighbourIndex] = embed;
    return serializeEmbedBlocks(blocks);
  }

  const lines = neighbour.text.split('\n');
  if (direction === -1) {
    // Последняя непустая строка текста над вставкой (с пустыми строками за ней) уходит под неё.
    let last = lines.length - 1;
    while (last > 0 && lines[last].trim() === '') last -= 1;
    const moved = lines.slice(last).join('\n');
    const remaining = lines.slice(0, last).join('\n');
    const next = blocks[blockIndex + 1];
    const after: ContentBlock[] = next?.type === 'text'
      ? [{ type: 'text', text: `${moved}\n${next.text}` }]
      : [{ type: 'text', text: moved }, ...(next ? [next] : [])];
    return serializeEmbedBlocks(compact([
      ...blocks.slice(0, neighbourIndex),
      { type: 'text', text: remaining },
      embed,
      ...after,
      ...blocks.slice(blockIndex + 2),
    ]));
  }

  // Первая непустая строка текста под вставкой (с пустыми строками перед ней) уходит над неё.
  let first = 0;
  while (first < lines.length - 1 && lines[first].trim() === '') first += 1;
  const moved = lines.slice(0, first + 1).join('\n');
  const remaining = lines.slice(first + 1).join('\n');
  const previous = blocks[blockIndex - 1];
  const before: ContentBlock[] = previous?.type === 'text'
    ? [{ type: 'text', text: `${previous.text}\n${moved}` }]
    : [...(previous ? [previous] : []), { type: 'text', text: moved }];
  return serializeEmbedBlocks(compact([
    ...blocks.slice(0, Math.max(0, blockIndex - 1)),
    ...before,
    embed,
    { type: 'text', text: remaining },
    ...blocks.slice(neighbourIndex + 1),
  ]));
}

/** Новый текст текстового блока. Опустевший блок рядом со вставкой исчезает. */
export function updateTextBlock(value: string, blockIndex: number, text: string): string {
  const blocks = embedBlocks(value);
  if (blocks[blockIndex]?.type !== 'text') return value;
  if (text === '' && blocks.length > 1) {
    return serializeEmbedBlocks([...blocks.slice(0, blockIndex), ...blocks.slice(blockIndex + 1)]);
  }
  blocks[blockIndex] = { type: 'text', text };
  return serializeEmbedBlocks(blocks);
}

/** Текст, набранный в пустом месте между вставками, становится блоком на этом месте. */
export function fillSlot(value: string, slot: number, text: string): string {
  if (text === '') return value;
  const blocks = embedBlocks(value);
  const at = Math.max(0, Math.min(slot, blocks.length));
  return serializeEmbedBlocks([...blocks.slice(0, at), { type: 'text', text }, ...blocks.slice(at)]);
}

// ---------------------------------------------------------------- проверка файла до отправки

const EXTENSION = /\.([^.]+)$/;

/** Причина отказа до отправки — по политике сервера; `null` — можно грузить. */
export function embedFileProblem(
  file: Pick<File, 'name' | 'size'>,
  kind: EmbedKind,
  policy: ContentEmbedPolicy | undefined,
): string | null {
  const rules = kind === 'image' ? policy?.image : policy?.file;
  if (!rules) return null;
  const extension = EXTENSION.exec(file.name)?.[1]?.toLowerCase() ?? '';
  if (!(rules.extensions ?? []).includes(extension)) {
    return kind === 'image'
      ? 'Рисунок можно вставить в формате JPG, PNG или WebP.'
      : 'Поддерживаются PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, JPG, PNG и WebP.';
  }
  if (rules.maxBytes != null && file.size > rules.maxBytes) {
    return `Файл больше ${Math.round(rules.maxBytes / (1024 * 1024))} МБ — выберите файл поменьше.`;
  }
  if (file.size === 0) return 'Файл пустой — выберите файл и повторите.';
  return null;
}

/** `accept` для выбора файла по политике: `.jpg,.png,…`. */
export function acceptOf(kind: EmbedKind, policy: ContentEmbedPolicy | undefined): string {
  const extensions = (kind === 'image' ? policy?.image : policy?.file)?.extensions ?? [];
  return extensions.map((extension) => `.${extension}`).join(',');
}

/** Описания вставок из ответа сервера и только что загруженные — свежие поверх прежних. */
export function mergeEmbeds(...lists: Array<ContentEmbed[] | null | undefined>): ContentEmbed[] {
  const byId = new Map<string, ContentEmbed>();
  for (const list of lists) for (const embed of list ?? []) if (embed.id) byId.set(embed.id, embed);
  return [...byId.values()];
}

/**
 * Отказ сервера по вставке (400 `CONTENT_EMBED_*`, `details.field` + `details.id`): по нему
 * редактор подсвечивает карточку, а не только показывает текст ошибки.
 */
export function embedErrorOf(caught: unknown): { field: string; id: string | null } | null {
  if (typeof caught !== 'object' || caught === null) return null;
  const { code, details } = caught as { code?: unknown; details?: unknown };
  if (typeof code !== 'string' || !code.startsWith('CONTENT_EMBED_')) return null;
  const record = (details ?? {}) as { field?: unknown; id?: unknown };
  if (typeof record.field !== 'string') return null;
  return { field: record.field, id: typeof record.id === 'string' ? record.id : null };
}
