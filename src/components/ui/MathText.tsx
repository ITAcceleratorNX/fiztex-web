import { useMemo } from 'react';
import 'katex/dist/katex.min.css';
import { cx } from '@/lib/format';
import { renderFormula } from '@/lib/katexRender';
import { splitMath, unescapeText, type MathSegment } from '@/lib/mathMarkup';

/**
 * Текст вопроса, варианта ответа, эталонного ответа или решения — с формулами.
 *
 * <p>Один компонент на все экраны: редактор, предпросмотр учителя, разбор ответов и экран
 * ученика. Так выполняется требование ТЗ «предпросмотр совпадает с отображением ученику» —
 * не договорённостью, а тем, что рендерит это одна и та же функция.
 *
 * <p>Сломанная формула показывается сырым LaTeX в красной рамке, а не пустотой: ТЗ §6 прямо
 * запрещает незаметную подмену — учитель должен увидеть, что именно не отрисовалось.
 */
export function MathText({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const segments = useMemo(() => (text ? splitMath(text) : []), [text]);

  if (!text) return null;
  // Вопрос без формул выводится ровно как раньше — ни одного лишнего узла в разметке.
  if (!segments.some((segment) => segment.kind === 'math')) {
    return <span className={cx('whitespace-pre-wrap', className)}>{unescapeText(text)}</span>;
  }

  return (
    <span className={cx('whitespace-pre-wrap', className)}>
      {segments.map((segment, index) =>
        segment.kind === 'text' ? (
          <span key={index}>{unescapeText(segment.value)}</span>
        ) : (
          <Formula key={index} latex={segment.value} display={segment.display} />
        ),
      )}
    </span>
  );
}

/** Одна формула. `display` — та, что записана как `$$…$$`: система, матрица, длинная выкладка. */
export function Formula({ latex, display = false }: { latex: string; display?: boolean }) {
  const rendered = useMemo(() => renderFormula(latex, display), [latex, display]);

  if (!rendered.ok) {
    return (
      <code
        className="mx-0.5 inline-block max-w-full overflow-x-auto whitespace-pre rounded bg-red-50 px-1 py-0.5 align-middle font-mono text-[0.9em] text-red-600 ring-1 ring-red-200"
        title={`Формула не отображается: ${rendered.error}`}
      >
        {display ? `$$${latex}$$` : `$${latex}$`}
      </code>
    );
  }

  // overflow-x на самой формуле, а не на странице: длинная выкладка прокручивается внутри
  // своего блока и не растягивает экран ученика на телефоне (ТЗ §5).
  return (
    <span
      className={cx(
        'max-w-full overflow-x-auto overflow-y-hidden',
        display ? 'my-2 block' : 'inline-block align-middle',
      )}
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  );
}

/** Есть ли в тексте формула — например, чтобы не показывать предпросмотр там, где её нет. */
export function textHasFormula(text: string | null | undefined): boolean {
  if (!text) return false;
  return splitMath(text).some((segment: MathSegment) => segment.kind === 'math');
}
