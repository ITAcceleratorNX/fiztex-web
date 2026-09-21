import { Fragment } from 'react';
import { cx } from '@/lib/format';
import { parseMarkdown } from '@/lib/markdown';
import type { MarkdownBlock, MarkdownListItem, MarkdownSpan } from '@/lib/markdown';

/**
 * Отчёт модели как читаемый документ, а не как исходник разметки.
 *
 * Рисует разобранные блоки (`lib/markdown.ts`) React-элементами — не строкой в
 * `dangerouslySetInnerHTML`. Это не осторожность ради осторожности: текст сюда
 * приходит от языковой модели, которой на вход шли ответы людей, и единственная
 * надёжная защита от «разметки», пришедшей из ответа ученика, — не иметь пути,
 * по которому строка становится html.
 *
 * Ширина колонки ограничена: отчёт читают, а строка в тысячу пикселей теряется на
 * переходе к следующей. По той же причине заголовки держат расстояние сверху
 * больше, чем снизу, — раздел притягивается к своему тексту, а не к чужому.
 */
export function Markdown({
  source,
  className,
  skipLeadingHeading = false,
}: {
  source: string | null | undefined;
  className?: string;
  /**
   * Пропустить первый заголовок первого уровня. Отчёт начинается названием опроса,
   * а карточка, в которой он выводится, уже стоит под этим названием: второй раз
   * читать его незачем.
   */
  skipLeadingHeading?: boolean;
}) {
  let blocks = parseMarkdown(source);
  if (skipLeadingHeading && blocks[0]?.type === 'heading' && blocks[0].level === 1) {
    blocks = blocks.slice(1);
  }
  if (!blocks.length) return null;

  return (
    <div className={cx('max-w-[70ch] space-y-3 text-13 leading-relaxed text-slate-700', className)}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} first={index === 0} />
      ))}
    </div>
  );
}

function Block({ block, first }: { block: MarkdownBlock; first: boolean }) {
  if (block.type === 'heading') {
    // Уровни ниже второго встречаются редко и разделами не являются — они ведут
    // себя как подпись к следующему абзацу, поэтому и весят меньше.
    const isSection = block.level <= 2;
    return (
      <p
        className={cx(
          isSection
            ? 'text-15 font-bold text-ink'
            : 'text-13 font-semibold uppercase tracking-wide text-muted',
          !first && (isSection ? 'pt-3' : 'pt-1.5'),
        )}
      >
        <Spans spans={block.spans} />
      </p>
    );
  }

  if (block.type === 'paragraph') {
    return (
      <p>
        <Spans spans={block.spans} />
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {block.items.map((item, index) => (
        <Item key={index} item={item} ordinal={block.ordered ? index + 1 : null} />
      ))}
    </ul>
  );
}

/**
 * Пункт списка. Номер — кружок, маркер — точка: нумерованным списком модель
 * отвечает там, где порядок есть (рекомендации по приоритету), и его видно.
 */
function Item({ item, ordinal }: { item: MarkdownListItem; ordinal: number | null }) {
  return (
    <li className="flex gap-2.5">
      {ordinal != null ? (
        <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-navy-50 text-11 font-bold text-navy-700">
          {ordinal}
        </span>
      ) : (
        <span aria-hidden className="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-brand-400" />
      )}
      <div className="min-w-0 space-y-1.5">
        <p>
          <Spans spans={item.spans} />
        </p>
        {item.children.length > 0 && (
          <ul className="space-y-1.5">
            {item.children.map((child, index) => (
              <li key={index} className="flex gap-2.5">
                <span aria-hidden className="mt-[0.7em] h-px w-2 shrink-0 bg-slate-300" />
                <p className="min-w-0 text-slate-600">
                  <Spans spans={child.spans} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function Spans({ spans }: { spans: MarkdownSpan[] }) {
  return (
    <>
      {spans.map((span, index) => (
        <Fragment key={index}>
          {span.bold ? <strong className="font-semibold text-ink">{span.text}</strong> : span.text}
        </Fragment>
      ))}
    </>
  );
}
