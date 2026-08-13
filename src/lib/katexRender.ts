import katex from 'katex';
import { hasForbiddenCommand } from './mathMarkup';

export type RenderResult = { ok: true; html: string } | { ok: false; error: string };

/**
 * Единственное место, где вызывается KaTeX.
 *
 * <p>Отсюда его берут и рендерер ({@link import('@/components/ui/MathText').MathText}), и живая
 * проверка формул в редакторе: «отображается ли формула» и «как она выглядит» обязаны быть
 * одним и тем же вопросом, иначе редактор обещал бы учителю не то, что увидит ученик.
 *
 * <p>{@code throwOnError: true} — намеренно: ошибку показываем своей плашкой с сырым LaTeX,
 * а не красным текстом внутри формулы. {@code trust: false} запрещает команды, которые тянут
 * внешний ресурс, а чёрный список отсекает макросы ещё до разбора.
 */
export function renderFormula(latex: string, display = false): RenderResult {
  if (!latex.trim()) {
    return { ok: false, error: 'пустая формула' };
  }
  if (hasForbiddenCommand(latex)) {
    return { ok: false, error: 'недопустимая команда' };
  }
  try {
    return {
      ok: true,
      html: katex.renderToString(latex, {
        displayMode: display,
        throwOnError: true,
        strict: 'ignore',
        trust: false,
      }),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'ошибка разбора' };
  }
}
