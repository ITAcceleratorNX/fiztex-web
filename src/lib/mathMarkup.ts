/**
 * Разметка формул в тексте вопроса — клиентская половина контракта
 * `fiztex-back/docs/formula-contract.md`.
 *
 * Формула размечена долларами: `$…$` — в строке, `$$…$$` — блоком, `\$` — литеральный доллар.
 * Всё остальное — обычный текст, переводы строк значимы.
 *
 * Здесь только разбор строки и проверка на запрещённые команды. Замечания для учителя
 * считает бэк (`formulaIssues` в вопросе): правило публикации должно быть одно, иначе UI и
 * сервер разошлись бы.
 */

export type MathSegment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display: boolean };

/**
 * Команды, которые не рендерятся ни при каких условиях, — та же причина, что и на бэке:
 * `\def` и родня разворачиваются рекурсивно (дешёвый DoS прямо на экране ученика), а команды
 * ссылки и вставки картинки тянут внешний ресурс в страницу теста. KaTeX ограничивает и то,
 * и другое (`maxExpand`, `trust: false`), но текст пришёл из модели и из чужого файла —
 * проверка стоит на обеих сторонах.
 */
const FORBIDDEN_COMMANDS = [
  'def',
  'gdef',
  'edef',
  'xdef',
  'let',
  'futurelet',
  'newcommand',
  'renewcommand',
  'providecommand',
  'csname',
  'endcsname',
  'expandafter',
  'noexpand',
  'input',
  'include',
  'includegraphics',
  'href',
  'url',
  'htmlClass',
  'htmlId',
  'htmlStyle',
  'htmlData',
  'catcode',
  'write',
  'openout',
  'read',
  'special',
  'usepackage',
  'documentclass',
];

export const MAX_FORMULA_LENGTH = 4096;
export const MAX_FORMULAS_PER_FIELD = 128;
export const MAX_FORMULA_FIELD_LENGTH = 65536;

/** Есть ли в формуле команда, которую нельзя отдавать рендереру. */
export function hasForbiddenCommand(formula: string): boolean {
  for (let i = 0; i < formula.length; i += 1) {
    if (formula[i] !== '\\') continue;
    const from = ++i;
    while (i < formula.length && /[a-zA-Z]/.test(formula[i])) i += 1;
    if (i > from) {
      if (FORBIDDEN_COMMANDS.includes(formula.slice(from, i))) return true;
      i -= 1;
    }
  }
  return false;
}

/** Position after a balanced mhchem argument, or -1. Never consumes the outer $. */
export function chemicalEndAt(text: string, start: number): number {
  if (!(text.startsWith('\\ce', start) || text.startsWith('\\pu', start))) return -1;
  let open = start + 3;
  if (/[a-zA-Z]/.test(text[open] ?? '')) return -1;
  while (open < text.length && /\s/.test(text[open])) open += 1;
  if (text[open] !== '{') return -1;
  let depth = 1;
  for (let i = open + 1; i < text.length; i += 1) {
    if (text[i] === '\\') { i += 1; continue; }
    if (text[i] === '{') depth += 1;
    if (text[i] === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

export function hasNestedChemicalMath(latex: string): boolean {
  for (let i = 0; i < latex.length; i += 1) {
    if (latex[i] !== '\\') continue;
    const end = chemicalEndAt(latex, i);
    if (end < 0) { i += 1; continue; }
    for (let j = i; j < end; j += 1) {
      if (latex[j] === '\\') { j += 1; continue; }
      if (latex[j] === '$') return true;
    }
    i = end - 1;
  }
  return false;
}

/** Mathematical hints must not rewrite or diagnose mhchem's distinct script syntax. */
export function outsideChemistry(latex: string): string {
  let result = '', cursor = 0;
  for (let i = 0; i < latex.length; i += 1) {
    if (latex[i] !== '\\') continue;
    const end = chemicalEndAt(latex, i);
    if (end < 0) { i += 1; continue; }
    result += latex.slice(cursor, i) + ' ';
    cursor = end; i = end - 1;
  }
  return result + latex.slice(cursor);
}

export function hasMath(text: string | null | undefined): boolean {
  if (!text || !text.includes('$')) return false;
  return splitMath(text).some((segment) => segment.kind === 'math');
}

/**
 * Делит текст на обычные и математические куски.
 *
 * Незакрытая формула не «додумывается»: остаток остаётся текстом и виден учителю целиком —
 * молча превращать половину вопроса в математику (или терять её) нельзя. Тот же разбор, что
 * и в `MathMarkup.scan` на бэке, поэтому счёт формул совпадает с его замечаниями.
 */
export function splitMath(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let plain = '';
  let i = 0;

  const flush = () => {
    if (plain) {
      segments.push({ kind: 'text', value: plain });
      plain = '';
    }
  };

  while (i < text.length) {
    const char = text[i];
    if (char === '\\' && i + 1 < text.length) {
      plain += char + text[i + 1];
      i += 2;
      continue;
    }
    if (char !== '$') {
      plain += char;
      i += 1;
      continue;
    }

    const display = text[i + 1] === '$';
    const openLength = display ? 2 : 1;
    const closing = findClosing(text, i + openLength);
    if (closing < 0) {
      plain += text.slice(i);
      flush();
      return segments;
    }

    flush();
    segments.push({ kind: 'math', value: text.slice(i + openLength, closing), display });
    // Открытый как `$$` и закрытый одиночным `$` — законный разнобой, не потеря символа.
    i = closing + (display && text[closing + 1] === '$' ? 2 : 1);
  }

  flush();
  return segments;
}

function findClosing(text: string, from: number): number {
  for (let j = from; j < text.length; j += 1) {
    if (text[j] === '\\') {
      const end = chemicalEndAt(text, j);
      if (end > j) { j = end - 1; continue; }
      j += 1;
      continue;
    }
    if (text[j] === '$') return j;
  }
  return -1;
}

/** Литеральный доллар в тексте: показывается как `$`, а разделителем не является. */
export function unescapeText(value: string): string {
  return value.replace(/\\\$/g, '$');
}

/**
 * Снимает `\placeholder{…}` — метки незаполненных мест из визуального редактора.
 *
 * MathLive показывает пустые места рамкой и сериализует их как `\placeholder{}`. KaTeX такой
 * команды не знает, поэтому у ученика формула превратилась бы в красную плашку с сырой
 * разметкой. Метки снимаются на выходе из окна формулы: в тексте вопроса их быть не должно.
 */
export function stripPlaceholders(latex: string): string {
  let result = latex;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = result.replace(/\\placeholder(?:\[[^\]]*])?\{([^{}]*)}/g, '$1');
    if (next === result) break;
    result = next;
  }
  return result;
}

/** Обернуть формулу в разделители — для вставки из редактора формул. */
export function wrapFormula(latex: string, display = false): string {
  const delimiter = display ? '$$' : '$';
  return `${delimiter}${latex.trim()}${delimiter}`;
}

/**
 * Вставить формулу на позицию курсора.
 *
 * Пробелы вокруг добавляются по необходимости: «Найдите$x$при» отрисуется в одну строку без
 * пробелов, и учителю пришлось бы чинить это руками после каждой вставки.
 */
export function insertFormulaAt(
  text: string,
  cursor: number,
  latex: string,
  display = false,
): { text: string; cursor: number } {
  const at = Math.max(0, Math.min(cursor, text.length));
  const before = text.slice(0, at);
  const after = text.slice(at);
  const formula = wrapFormula(latex, display);

  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
  const needsSpaceAfter = after.length > 0 && !/^[\s.,;:!?)»]/.test(after);
  const inserted = (needsSpaceBefore ? ' ' : '') + formula + (needsSpaceAfter ? ' ' : '');

  return { text: before + inserted + after, cursor: at + inserted.length };
}

/**
 * Заменить формулу по её номеру в тексте (нумерация — только по формулам, не по сегментам).
 * Так правка из предпросмотра попадает именно в ту формулу, по которой щёлкнули, даже когда
 * в вопросе их пять и две совпадают посимвольно.
 */
export function replaceFormulaAt(
  text: string,
  mathIndex: number,
  latex: string,
  display: boolean,
): string {
  let seen = -1;
  return splitMath(text)
    .map((segment) => {
      if (segment.kind === 'text') return segment.value;
      seen += 1;
      return seen === mathIndex
        ? wrapFormula(latex, display)
        : wrapFormula(segment.value, segment.display);
    })
    .join('');
}

/** Убрать формулу целиком вместе с разделителями. */
export function removeFormulaAt(text: string, mathIndex: number): string {
  let seen = -1;
  return splitMath(text)
    .map((segment) => {
      if (segment.kind === 'text') return segment.value;
      seen += 1;
      return seen === mathIndex ? '' : wrapFormula(segment.value, segment.display);
    })
    .join('')
    .replace(/[ \t]{2,}/g, ' ');
}
