import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, ImageOff, ZoomIn } from 'lucide-react';
import { cx, formatFileSize } from '@/lib/format';
import { embedBlocks, type ContentEmbed, type EmbedKind } from '@/lib/contentEmbeds';
import { FileTypeBadge } from './FileTypeBadge';
import { ImageLightbox } from './ImageLightbox';
import { MathText } from './MathText';

/**
 * Текст учебного материала с рисунками и файлами внутри (CONTENT-EMBED-001).
 *
 * Порядок блоков — ровно тот, что в тексте: «текст — рисунок — файл — текст». Описание вставок
 * (`embeds`) приходит вместе с текстом от сервера, который уже проверил права: компонент ничего
 * не фильтрует и своих запросов не делает. Сырой маркер `[[image:…]]` на экран не попадает ни в
 * одном состоянии — неизвестная вставка рисуется «Файл недоступен».
 *
 * Текст без вставок выводится ровно как раньше — одним `MathText`, без лишних узлов.
 */
export function RichText({
  text,
  embeds,
  className,
  textClassName,
  onExpired,
}: {
  text: string | null | undefined;
  embeds?: ContentEmbed[] | null;
  /** Классы обёртки, когда вставки есть. */
  className?: string;
  /** Классы текста — те же, что раньше стояли на `MathText`. */
  textClassName?: string;
  /** Подписанная ссылка истекла (страница открыта дольше её срока): экран перечитывает свой запрос. */
  onExpired?: () => void;
}) {
  const blocks = useMemo(() => embedBlocks(text), [text]);
  const byId = useMemo(() => new Map((embeds ?? []).map((embed) => [embed.id, embed])), [embeds]);

  if (!text) return null;
  if (!blocks.some((block) => block.type === 'embed')) {
    return <MathText text={text} className={textClassName} />;
  }

  return (
    <div className={cx('min-w-0 space-y-3', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          const visible = visibleText(block.text);
          return visible ? <MathText key={index} text={visible} className={cx('block', textClassName)} /> : null;
        }
        const embed = byId.get(block.id);
        if (!embed || embed.available === false) return <EmbedUnavailable key={index} kind={block.kind} />;
        return block.kind === 'image'
          ? <EmbedImage key={index} embed={embed} onExpired={onExpired} />
          : <EmbedFileCard key={index} embed={embed} />;
      })}
    </div>
  );
}

/** Пустые строки на краях текстового блока — это отступы вокруг вставки, а не текст. */
function visibleText(text: string): string {
  const trimmed = text.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/(?:\r?\n[ \t]*)+$/, '');
  return trimmed.trim() === '' ? '' : trimmed;
}

export function EmbedImage({ embed, onExpired, compact = false }: {
  embed: ContentEmbed;
  onExpired?: () => void;
  /** В редакторе картинка ниже: рядом с ней кнопки. */
  compact?: boolean;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [failed, setFailed] = useState(false);
  const askedFresh = useRef(false);

  // Пришла новая ссылка — пробуем заново.
  useEffect(() => {
    setFailed(false);
  }, [embed.url]);

  function handleError() {
    const expired = embed.expiresAt != null && Date.parse(embed.expiresAt) <= Date.now();
    if (onExpired && (expired || !askedFresh.current)) {
      askedFresh.current = true;
      onExpired();
      return;
    }
    setFailed(true);
  }

  if (failed) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-neutral-bg px-3 py-4 text-sm text-muted">
        <ImageOff className="size-4 shrink-0" />
        Не удалось показать рисунок «{embed.fileName}».
        <button type="button" className="font-semibold text-brand-600 underline-offset-2 hover:underline"
          onClick={() => { setFailed(false); onExpired?.(); }}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        title="Увеличить рисунок"
        aria-label={`Увеличить рисунок «${embed.fileName}»`}
        className="group relative block max-w-full overflow-hidden rounded-xl border border-line bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <img
          src={embed.url}
          alt={embed.fileName ?? 'Рисунок'}
          width={embed.width}
          height={embed.height}
          loading="lazy"
          onError={handleError}
          className={cx('block h-auto w-auto max-w-full object-contain', compact ? 'max-h-60' : 'max-h-96')}
        />
        <span className="absolute right-2 top-2 hidden rounded-lg bg-white/90 p-1.5 text-slate-600 shadow-sm group-hover:block">
          <ZoomIn className="size-4" />
        </span>
      </button>
      {zoomed && (
        <ImageLightbox src={embed.originalUrl ?? embed.url ?? ''} alt={embed.fileName ?? 'Рисунок'}
          onClose={() => setZoomed(false)} />
      )}
    </>
  );
}

/** Документ на своём месте в тексте: тип, имя, размер и «Открыть» (ТЗ §3.3). */
export function EmbedFileCard({ embed, children }: { embed: ContentEmbed; children?: React.ReactNode }) {
  const downloads = embed.url === embed.downloadUrl;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3">
      <FileTypeBadge format={embed.extension} variant="soft" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink" title={embed.fileName}>{embed.fileName}</p>
        {embed.sizeBytes != null && <p className="text-xs text-muted">{formatFileSize(embed.sizeBytes)}</p>}
      </div>
      <a
        href={embed.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-13 font-semibold text-brand-600 ring-1 ring-slate-200 transition hover:bg-brand-50"
      >
        {downloads ? <Download className="size-4" /> : <ExternalLink className="size-4" />}
        {downloads ? 'Скачать' : 'Открыть'}
      </a>
      {children}
    </div>
  );
}

export function EmbedUnavailable({ kind }: { kind: EmbedKind }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-line bg-neutral-bg px-3 py-3 text-sm text-muted">
      <ImageOff className="size-4 shrink-0" />
      {kind === 'image' ? 'Рисунок недоступен' : 'Файл недоступен'}
    </div>
  );
}
