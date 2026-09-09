import { describe, expect, it } from 'vitest';
import { readXlsxWorkbook, XlsxReadError } from './readWorkbook';

const encoder = new TextEncoder();

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const source: ReadableStream<Uint8Array> = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const stream = source.pipeThrough(
    new CompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
  );
  const reader = stream.getReader();
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

/**
 * Минимальный zip-писатель для тестов: настоящий .xlsx в фикстуру не положишь —
 * он весит мегабайты и его не прочитать глазами при разборе упавшего теста.
 */
async function buildZip(files: Array<{ name: string; content: string; store?: boolean }>) {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const raw = encoder.encode(file.content);
    const stored = file.store ?? false;
    const data = stored ? raw : await deflateRaw(raw);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(8, stored ? 0 : 8, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, raw.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    parts.push(local);

    const entry = new Uint8Array(46 + nameBytes.length);
    const entryView = new DataView(entry.buffer);
    entryView.setUint32(0, 0x02014b50, true);
    entryView.setUint16(10, stored ? 0 : 8, true);
    entryView.setUint32(20, data.length, true);
    entryView.setUint32(24, raw.length, true);
    entryView.setUint16(28, nameBytes.length, true);
    entryView.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    central.push(entry);

    offset += local.length;
  }

  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of [...parts, ...central, eocd]) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out.buffer;
}

const WORKBOOK_XML =
  '<?xml version="1.0"?><workbook><sheets>' +
  '<sheet name="5 кл" sheetId="1" r:id="rId1"/>' +
  '<sheet name="6 кл" sheetId="2" r:id="rId2"/>' +
  '</sheets></workbook>';

const RELS_XML =
  '<?xml version="1.0"?><Relationships>' +
  '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Target="worksheets/sheet2.xml"/>' +
  '</Relationships>';

const SHARED_XML =
  '<?xml version="1.0"?><sst>' +
  '<si><t>понедельник</t></si>' +
  '<si><t>5а-1</t></si>' +
  '<si><r><t>физ</t></r><r><t>-ра КШ</t></r></si>' +
  '<si><t>Урок &amp; отдых</t></si>' +
  '</sst>';

const SHEET1_XML =
  '<?xml version="1.0"?><worksheet><sheetData>' +
  '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="3"/><c r="C1" t="s"><v>1</v></c></row>' +
  '<row r="2"><c r="A2" t="inlineStr"><is><t>07.45 - 08.25</t></is></c>' +
  '<c r="B2"><v>1.0</v></c><c r="C2" t="s"><v>2</v></c><c r="D2"><v>108.0</v></c></row>' +
  '<row r="4"><c r="A4" t="s"><v>3</v></c></row>' +
  '</sheetData></worksheet>';

const SHEET2_XML = '<?xml version="1.0"?><worksheet><sheetData/></worksheet>';

async function sampleWorkbook() {
  return buildZip([
    { name: 'xl/workbook.xml', content: WORKBOOK_XML },
    { name: 'xl/_rels/workbook.xml.rels', content: RELS_XML },
    { name: 'xl/sharedStrings.xml', content: SHARED_XML, store: true },
    { name: 'xl/worksheets/sheet1.xml', content: SHEET1_XML },
    { name: 'xl/worksheets/sheet2.xml', content: SHEET2_XML },
  ]);
}

describe('readXlsxWorkbook', () => {
  it('читает листы в порядке книги и с их именами', async () => {
    const workbook = await readXlsxWorkbook(await sampleWorkbook());
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(['5 кл', '6 кл']);
  });

  it('раскладывает ячейки по колонкам, пропуская пустые', async () => {
    const workbook = await readXlsxWorkbook(await sampleWorkbook());
    expect(workbook.sheets[0].rows[0]).toEqual(['понедельник', '', '5а-1']);
  });

  it('склеивает форматированную строку из нескольких кусков', async () => {
    const workbook = await readXlsxWorkbook(await sampleWorkbook());
    expect(workbook.sheets[0].rows[1][2]).toBe('физ-ра КШ');
  });

  it('нормализует числа: «108.0» — это кабинет 108, а не дробь', async () => {
    const workbook = await readXlsxWorkbook(await sampleWorkbook());
    expect(workbook.sheets[0].rows[1][1]).toBe('1');
    expect(workbook.sheets[0].rows[1][3]).toBe('108');
  });

  it('сохраняет номера строк: пропущенная строка остаётся пустой', async () => {
    const workbook = await readXlsxWorkbook(await sampleWorkbook());
    expect(workbook.sheets[0].rows[2]).toEqual([]);
    expect(workbook.sheets[0].rows[3][0]).toBe('Урок & отдых');
  });

  it('отказывается читать не-книгу понятным сообщением', async () => {
    const zip = await buildZip([{ name: 'readme.txt', content: 'hello' }]);
    await expect(readXlsxWorkbook(zip)).rejects.toBeInstanceOf(XlsxReadError);
  });

  it('отказывается читать файл без zip-каталога', async () => {
    await expect(readXlsxWorkbook(encoder.encode('not a zip').buffer)).rejects.toBeInstanceOf(
      XlsxReadError,
    );
  });
});
