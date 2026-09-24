import { MathText } from './MathText';

/** The same readable document is used for teacher preview and student publication. */
export function SummaryDocument({ content }: {
  content: { title?: string; summaryText: string; companionText: string; companionKind: 'RETELLING' | 'PLAN' };
}) {
  return (
    <article className="min-w-0 space-y-8">
      <h1 className="text-2xl font-bold text-ink">{content.title}</h1>
      <div className="grid min-w-0 gap-8 xl:grid-cols-2">
        <DocumentSection title="Краткий конспект" text={content.summaryText} />
        <DocumentSection title={content.companionKind === 'PLAN' ? 'План урока' : 'Краткий пересказ'} text={content.companionText} />
      </div>
    </article>
  );
}

function DocumentSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="min-w-0 space-y-4">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="min-w-0 break-words text-base leading-relaxed text-ink">
        <MathText text={text || 'Раздел пока не заполнен'} />
      </div>
    </section>
  );
}
