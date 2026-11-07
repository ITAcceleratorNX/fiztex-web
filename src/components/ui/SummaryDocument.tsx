import type { ContentEmbed } from '@/lib/contentEmbeds';
import { RichText } from './RichText';

/** The same readable document is used for teacher preview and student publication. */
export function SummaryDocument({ content, embeds, onExpired }: {
  content: { title?: string; summaryText: string; companionText: string; companionKind: 'RETELLING' | 'PLAN' };
  /** Рисунки и файлы из текстов конспекта (CONTENT-EMBED-001) — из того же ответа сервера. */
  embeds?: ContentEmbed[] | null;
  onExpired?: () => void;
}) {
  return (
    <article className="min-w-0 space-y-8">
      <h1 className="text-2xl font-bold text-ink">{content.title}</h1>
      <div className="grid min-w-0 gap-8 xl:grid-cols-2">
        <DocumentSection title="Краткий конспект" text={content.summaryText} embeds={embeds} onExpired={onExpired} />
        <DocumentSection title={content.companionKind === 'PLAN' ? 'План урока' : 'Краткий пересказ'}
          text={content.companionText} embeds={embeds} onExpired={onExpired} />
      </div>
    </article>
  );
}

function DocumentSection({ title, text, embeds, onExpired }: {
  title: string;
  text: string;
  embeds?: ContentEmbed[] | null;
  onExpired?: () => void;
}) {
  return (
    <section className="min-w-0 space-y-4">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="min-w-0 break-words text-base leading-relaxed text-ink">
        <RichText text={text || 'Раздел пока не заполнен'} embeds={embeds} onExpired={onExpired} />
      </div>
    </section>
  );
}
