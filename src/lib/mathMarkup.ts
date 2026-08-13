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

const FORBIDDEN_PATTERN = new RegExp(`\\\\(${FORBIDDEN_COMMANDS.join('|')})(?![a-zA-Z])`);

/** Есть ли в формуле команда, которую нельзя отдавать рендереру. */
export function hasForbiddenCommand(formula: string): boolean {
  return FORBIDDEN_PATTERN.test(formula);
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
