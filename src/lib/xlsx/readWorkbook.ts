/**
 * Минимальный читатель `.xlsx` — zip плюс разбор XML листов.
 *
 * Своё вместо библиотеки, потому что нужна ровно одна операция: получить листы
 * книги как таблицы строк. Распаковку делает браузерный `DecompressionStream`,
 * так что зависимостей у чтения нет вовсе.
 *
 * Из книги берётся только текст ячеек: стили, формулы, картинки и объединения
 * расписанию не нужны — сетка уроков читается по координатам.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
/** Максимальный комментарий zip: дальше конца каталога искать негде. */
const MAX_EOCD_SCAN = 0xffff + 22;

export interface XlsxSheet {
  name: string;
  /** Плотная таблица: `rows[r][c]` — ячейка, индексы с нуля, пустая — `''`. */
  rows: string[][];
}

export interface XlsxWorkbook {
  sheets: XlsxSheet[];
}

export class XlsxReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XlsxReadError';
  }
}

interface ZipEntry {
  name: string;
  method: number;
  offset: number;
  compressedSize: number;
}

function findEndOfCentralDirectory(view: DataView): number {
  const start = Math.max(0, view.byteLength - MAX_EOCD_SCAN);
  for (let i = view.byteLength - 22; i >= start; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) return i;
  }
  throw new XlsxReadError('Файл не похож на .xlsx: не найден конец zip-архива');
}

function readCentralDirectory(buffer: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (directoryOffset === 0xffffffff) {
    throw new XlsxReadError('Zip64 не поддерживается — сохраните файл заново в Excel');
  }

  const entries = new Map<string, ZipEntry>();
  let cursor = directoryOffset;
  const decoder = new TextDecoder('utf-8');
  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) {
      throw new XlsxReadError('Повреждён каталог zip-архива');
    }
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, cursor + 46, nameLength));
    entries.set(name, { name, method, offset, compressedSize });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const source: ReadableStream<Uint8Array> = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  // Тип `DecompressionStream` в lib.dom описан как `BufferSource` на входе, и с
  // `ReadableStream<Uint8Array>` он не сходится по вариантности — приведение здесь
  // про типы, а не про поведение: на вход и выход идут те же байты.
  const decompressor = new DecompressionStream('deflate-raw') as unknown as ReadableWritablePair<
    Uint8Array,
    Uint8Array
  >;
  const reader = source.pipeThrough(decompressor).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

async function readEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const view = new DataView(buffer);
  if (view.getUint32(entry.offset, true) !== LOCAL_SIGNATURE) {
    throw new XlsxReadError(`Повреждена запись архива: ${entry.name}`);
  }
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const dataStart = entry.offset + 30 + nameLength + extraLength;
  const raw = new Uint8Array(buffer, dataStart, entry.compressedSize);
  if (entry.method === 0) return new TextDecoder('utf-8').decode(raw);
  if (entry.method !== 8) {
    throw new XlsxReadError(`Неизвестный метод сжатия ${entry.method} в ${entry.name}`);
  }
  return new TextDecoder('utf-8').decode(await inflateRaw(raw));
}

const XML_ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&',
};

function decodeXml(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    }
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
    return XML_ENTITIES[code] ?? whole;
  });
}

/** Текст всех `<t>` внутри фрагмента — форматированная строка приходит по кускам. */
function joinTextNodes(fragment: string): string {
  let out = '';
  for (const match of fragment.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) out += decodeXml(match[1]);
  return out;
}

function readSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const result: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    result.push(joinTextNodes(match[1]));
  }
  return result;
}

/** `AB` → 28. Колонку берём из ссылки ячейки: подряд идущими они не бывают. */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? '';
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

/**
 * Числовая ячейка приходит как `108.0` — Excel хранит числа с плавающей точкой,
 * и без нормализации кабинет «108» не совпал бы со справочником.
 */
function formatNumeric(raw: string): string {
  const value = Number(raw);
  return Number.isFinite(value) ? String(value) : raw;
}

function readSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNumber = Number(/\br="(\d+)"/.exec(rowMatch[1])?.[1] ?? 0);
    const body = rowMatch[2];
    if (!rowNumber || !body) continue;
    const cells: string[] = [];
    for (const cellMatch of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1];
      const cellBody = cellMatch[2] ?? '';
      const ref = /\br="([^"]+)"/.exec(attributes)?.[1];
      if (!ref) continue;
      const type = /\bt="([^"]+)"/.exec(attributes)?.[1] ?? 'n';
      let value = '';
      if (type === 'inlineStr') {
        value = joinTextNodes(cellBody);
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(cellBody)?.[1];
        if (raw != null) {
          const decoded = decodeXml(raw);
          if (type === 's') value = sharedStrings[Number(decoded)] ?? '';
          else if (type === 'n') value = formatNumeric(decoded);
          else value = decoded;
        }
      }
      value = value.trim();
      if (!value) continue;
      const column = columnIndex(ref);
      while (cells.length < column) cells.push('');
      cells[column] = value;
    }
    while (rows.length < rowNumber - 1) rows.push([]);
    rows[rowNumber - 1] = cells;
  }
  return rows;
}

/** Имена листов в порядке книги: `rId` из `workbook.xml` ведёт к файлу листа. */
function readSheetOrder(workbookXml: string, relsXml: string): Array<{ name: string; path: string }> {
  const targets = new Map<string, string>();
  for (const match of relsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const id = /\bId="([^"]+)"/.exec(match[1])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(match[1])?.[1];
    if (id && target) targets.set(id, target);
  }
  const sheets: Array<{ name: string; path: string }> = [];
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const name = /\bname="([^"]*)"/.exec(match[1])?.[1];
    const relationId = /\br:id="([^"]+)"/.exec(match[1])?.[1];
    if (!name || !relationId) continue;
    const target = targets.get(relationId);
    if (!target) continue;
    const path = target.startsWith('/')
      ? target.slice(1)
      : `xl/${target.replace(/^\.\//, '')}`;
    sheets.push({ name: decodeXml(name), path });
  }
  return sheets;
}

export async function readXlsxWorkbook(buffer: ArrayBuffer): Promise<XlsxWorkbook> {
  if (typeof DecompressionStream === 'undefined') {
    throw new XlsxReadError('Браузер не умеет распаковывать .xlsx — обновите его');
  }
  const entries = readCentralDirectory(buffer);
  const workbookEntry = entries.get('xl/workbook.xml');
  const relsEntry = entries.get('xl/_rels/workbook.xml.rels');
  if (!workbookEntry || !relsEntry) {
    throw new XlsxReadError('В файле нет книги Excel — возможно, это .xls или .csv');
  }

  const sharedEntry = entries.get('xl/sharedStrings.xml');
  const sharedStrings = readSharedStrings(sharedEntry ? await readEntry(buffer, sharedEntry) : null);
  const order = readSheetOrder(
    await readEntry(buffer, workbookEntry),
    await readEntry(buffer, relsEntry),
  );

  const sheets: XlsxSheet[] = [];
  for (const sheet of order) {
    const entry = entries.get(sheet.path);
    if (!entry) continue;
    sheets.push({ name: sheet.name, rows: readSheetRows(await readEntry(buffer, entry), sharedStrings) });
  }
  if (sheets.length === 0) throw new XlsxReadError('В книге нет ни одного листа');
  return { sheets };
}
