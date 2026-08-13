import { renderFormula } from './katexRender';
import { splitMath } from './mathMarkup';

export type FormulaProblem = {
  severity: 'error' | 'warning';
  message: string;
  /** Где именно: «Текст вопроса», «Вариант 2», «Эталонный ответ», «Критерии оценки». */
  where: string;
};

/** Маркер, которым модель отмечает фрагмент, который не смогла прочитать. */
export const UNCERTAIN_MARKER = '[?]';

/**
 * Живая проверка формул в редакторе — по тому тексту, который сейчас в поле.
 *
 * <p>Отдельно от `formulaIssues` бэка, и намеренно: серверный список считается при чтении
 * вопроса и после первой же правки становится устаревшим, а учителю нужно видеть результат
 * своего исправления сразу. Блокирующее правило при этом остаётся одно и на сервере —
 * активация теста проверяет текст заново.
 *
 * <p>Проверяется то, что учитель может исправить руками: нераспознанный фрагмент,
 * непарный разделитель и формула, которую не берёт рендерер.
 */
export function checkFormulas(fields: { where: string; text: string }[]): FormulaProblem[] {
  const problems: FormulaProblem[] = [];

  for (const field of fields) {
    const text = field.text ?? '';
    if (!text.trim()) continue;

    if (text.includes(UNCERTAIN_MARKER)) {
      problems.push({
        severity: 'error',
        where: field.where,
        message: 'нераспознанный фрагмент [?] — проверьте по исходному файлу и исправьте',
      });
    }

    const segments = splitMath(text);
    const tail = segments[segments.length - 1];
    if (tail?.kind === 'text' && hasUnpairedDollar(tail.value)) {
      problems.push({
        severity: 'error',
        where: field.where,
        message: 'непарный символ $ — формула не отрисуется; для знака доллара напишите \\$',
      });
    }

    for (const segment of segments) {
      if (segment.kind !== 'math') continue;

      // Две записи KaTeX рисует молча не так, как они прочитаны: неэкранированный процент
      // съедает остаток формулы как комментарий, а показатель из нескольких цифр без скобок
      // поднимает наверх один символ. Сохранение исправит и то, и другое (бэк нормализует
      // разметку), но в предпросмотре до сохранения учитель видит «пропавший» текст — и должен
      // понимать, почему.
      if (/(?<!\\)%/.test(segment.value)) {
        problems.push({
          severity: 'warning',
          where: field.where,
          message: 'процент внутри формулы пишется как \\% — сейчас всё после % не отображается,'
            + ' сохранение исправит это само',
        });
      }
      if (/[_^]\s*[+-]?\d\d/.test(segment.value)) {
        problems.push({
          severity: 'warning',
          where: field.where,
          message: 'показатель или индекс из нескольких цифр нужен в скобках — 10^{-19};'
            + ' сохранение исправит это само',
        });
      }

      const rendered = renderFormula(segment.value, segment.display);
      if (!rendered.ok) {
        problems.push({
          severity: 'warning',
          where: field.where,
          message: `формула «${short(segment.value)}» не отображается (${rendered.error})`,
        });
      }
    }
  }

  return problems;
}

export function hasBlockingProblem(problems: FormulaProblem[]): boolean {
  return problems.some((problem) => problem.severity === 'error');
}

/** Незакрытая формула: доллар, до которого не нашлось пары, остаётся в текстовом хвосте. */
function hasUnpairedDollar(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\') {
      i += 1;
      continue;
    }
    if (text[i] === '$') return true;
  }
  return false;
}

function short(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length <= 40 ? flat : `${flat.slice(0, 39)}…`;
}
