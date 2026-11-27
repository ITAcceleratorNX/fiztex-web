import { CheckCircle2, Info, Pencil, RefreshCw, Send, Sparkles, Undo2, type LucideIcon } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { TextArea } from '@/components/ui/Field';
import { cx } from '@/lib/format';
import type { Schema } from '@/lib/apiSchemas';
import {
  blockToField,
  eventLabel,
  fieldToItems,
  formatDateTime,
  type AiReportEvent,
  type StatusLabel,
  type TextBlock,
  type Tone,
} from '@/lib/aiReportModel';

const BADGE_TONES: Record<Tone, BadgeTone> = {
  neutral: 'gray', success: 'green', info: 'blue', warning: 'amber', danger: 'red',
};

export function StatusBadge({ status }: { status: StatusLabel | null }) {
  if (!status) return null;
  return <Badge tone={BADGE_TONES[status.tone]} dot>{status.label}</Badge>;
}

/** «Данные за период — из журнала» (Т7): показатели снимка, подписанные сервером. */
export function FactsRow({ facts }: { facts: Schema<'AiReportFactView'>[] | undefined }) {
  if (!facts || facts.length === 0) return null;
  return (
    <section aria-labelledby="ai-facts" className="space-y-2">
      <h3 id="ai-facts" className="text-sm font-semibold text-ink">Данные за период — из журнала</h3>
      <ul className="flex flex-wrap gap-2">
        {facts.map((fact, index) => (
          <li key={`${fact.code}-${index}`} title={fact.note ?? undefined}
            className="rounded-lg bg-info-bg px-2.5 py-1.5 text-13 text-slate-600">
            {fact.label}{' '}
            <span className={cx('font-semibold', fact.value === 'нет данных' ? 'text-slate-500' : 'text-navy-700')}>{fact.value}</span>
            {fact.note && <span className="ml-1 text-xs text-slate-500">· {fact.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Текст отчёта блоками. Рекомендации AI — в выделенной плашке (ТЗ §4: отделять факт от
 * рекомендации), её подпись меняется после утверждения; ограничения данных — приглушённо.
 */
export function ReportBlocks({ blocks, approved, bullets = true }: {
  blocks: TextBlock[];
  approved: boolean;
  bullets?: boolean;
}) {
  if (blocks.length === 0) {
    return <p className="text-sm text-slate-500">Текста пока нет.</p>;
  }
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        const list = bullets ? (
          <ul className="space-y-1.5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                <span aria-hidden="true" className={cx('mt-2 size-1.5 shrink-0 rounded-full',
                  block.role === 'recommendations' ? 'bg-violet-400' : 'bg-slate-300')} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            {block.items.map((item, itemIndex) => <p key={itemIndex} className="text-sm leading-relaxed text-slate-700">{item}</p>)}
          </div>
        );
        return (
          <section key={`${block.title}-${index}`} className="space-y-2">
            {block.title && <h3 className={cx('font-semibold', block.role === 'limitations' ? 'text-13 text-slate-500' : 'text-base text-ink')}>{block.title}</h3>}
            {block.role === 'recommendations' ? (
              <div className="rounded-xl border border-ai-panel-line bg-ai-panel p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-navy-700">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {approved ? 'Рекомендации AI · проверены учителем' : 'Предложение AI — проверьте перед утверждением'}
                </p>
                {list}
              </div>
            ) : block.role === 'limitations' ? (
              <div className="rounded-xl bg-planning-canvas px-4 py-3 [&_li]:text-13 [&_li]:text-slate-500">{list}</div>
            ) : list}
          </section>
        );
      })}
    </div>
  );
}

/** Правка по блокам (И4): поле на блок, строка — пункт. Заголовки блоков не правятся. */
export function BlockEditor({ blocks, onChange, disabled }: {
  blocks: TextBlock[];
  onChange: (next: TextBlock[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => (
        <label key={`${block.title}-${index}`} className="block space-y-2">
          <span className="flex items-center gap-1.5 text-base font-semibold text-ink">
            {block.role === 'recommendations' && <Sparkles className="size-4 text-navy-700" aria-hidden="true" />}
            {block.title ?? 'Текст'}
          </span>
          <TextArea rows={Math.max(3, block.items.reduce((rows, item) => rows + Math.ceil((item.length || 1) / 90), 0) + 1)} disabled={disabled} value={blockToField(block)}
            onChange={(event) => onChange(blocks.map((item, i) => i === index
              ? { ...item, items: event.target.value.split('\n') }
              : item))} />
        </label>
      ))}
    </div>
  );
}

/** Нормализует поля редактора перед сохранением: пустые строки и маркеры уходят. */
export const normalizeBlocks = (blocks: TextBlock[]) => blocks.map((block) => ({ ...block, items: fieldToItems(block.items.join('\n')) }));

const EVENT_ICONS: Record<string, LucideIcon> = {
  GENERATED: Sparkles,
  GENERATION_REQUESTED: RefreshCw,
  EDITED: Pencil,
  APPROVED: CheckCircle2,
  PARENT_SUMMARY_SAVED: Pencil,
  PARENT_SUMMARY_CONFIRMED: CheckCircle2,
  PUBLISHED: Send,
  UNPUBLISHED: Undo2,
};

/** «История действий» (В2): новое сверху, с автором и временем. */
export function EventList({ events, versions, kinds, title = 'История действий' }: {
  events: AiReportEvent[] | undefined;
  versions: Schema<'AiReportVersionListItem'>[] | undefined;
  kinds?: string[];
  title?: string;
}) {
  const numbers = new Map((versions ?? []).map((item) => [item.id!, item.number!]));
  const rows = [...(events ?? [])]
    .filter((event) => !kinds || kinds.includes(event.kind ?? ''))
    .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '') || (b.id ?? 0) - (a.id ?? 0));
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="space-y-2">
        {rows.map((event) => {
          const Icon = EVENT_ICONS[event.kind ?? ''] ?? Info;
          return (
            <li key={event.id} className="flex items-start justify-between gap-3 text-13 text-slate-600">
              <span className="flex items-start gap-2">
                <Icon className={cx('mt-0.5 size-3.5 shrink-0', event.kind === 'GENERATION_FAILED' ? 'text-red-500' : 'text-slate-400')} aria-hidden="true" />
                <span>
                  {eventLabel(event, numbers)}
                  {event.actor?.name ? ` · ${event.actor.name}` : ''}
                  {event.kind === 'UNPUBLISHED' && ' — родитель больше не видит сводку'}
                </span>
              </span>
              <time className="shrink-0 text-slate-400" dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
