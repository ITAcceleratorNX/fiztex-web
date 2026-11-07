import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Paperclip, RefreshCw, Sigma, Trash2 } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import type { FormulaProfile } from '@/lib/formulaProfiles';
import { insertFormulaAt, removeFormulaAt, replaceFormulaAt, wrapFormula } from '@/lib/mathMarkup';
import {
  acceptOf,
  canMoveEmbed,
  embedBlocks,
  embedFileProblem,
  fillSlot,
  insertEmbed,
  moveEmbed,
  removeEmbed,
  replaceEmbed,
  stripEmbeds,
  updateTextBlock,
  type ContentBlock,
  type ContentEmbed,
  type EmbedCursor,
  type EmbedKind,
} from '@/lib/contentEmbeds';
import { useContentEmbedServices } from '@/context/ContentEmbedContext';
import { Button } from './Button';
import { EmbedFileCard, EmbedImage, EmbedUnavailable } from './RichText';
import { EditableFormulaPreview } from './FormulaField';
import { FormulaEditorModal } from './FormulaEditorModal';
import { useFieldControlProps } from './fieldContext';

/** id заглушки загрузки в предпросмотре: в строку материала он не попадает никогда. */
const PENDING_ID = '00000000-0000-0000-0000-000000000000';
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

type Row =
  | { type: 'text'; block: number; text: string }
  | { type: 'slot'; slot: number }
  | { type: 'embed'; block: number; kind: EmbedKind; id: string };

type Pending = { kind: EmbedKind; name: string } & ({ cursor: EmbedCursor | null } | { replace: number });

/**
 * Текст учебного материала с рисунками и файлами в нужных местах (CONTENT-EMBED-001).
 *
 * Поле управляемое над той же строкой, что и раньше (`value` / `onChange`), — в ней вставки
 * стоят строками-маркерами (`[[image:<id>]]`). Учитель маркеров не видит: текст до и после
 * вставки — отдельные поля ввода, сама вставка — карточка между ними с кнопками «Заменить»,
 * «Выше», «Ниже», «Удалить». Нового редактора и нового дизайна нет — существующие поле ввода,
 * кнопки и предпросмотр формул (`FormulaField`).
 *
 * Свойства, на которых держится ТЗ:
 * - маркер появляется в тексте только после успешной загрузки; пока она идёт, поле только для
 *   чтения, а экран блокирует сохранение (`onBusyChange`). Ошибка загрузки текст не трогает;
 * - открыть старый текст и ничего не делать — `onChange` не вызывается: строка остаётся ровно той,
 *   что пришла (пустые места между вставками виртуальные, в строку не попадают);
 * - строки разбивает одна модель — `lib/contentEmbeds.ts`, та же, что у бэкенда и мобилки.
 */
export function RichTextField({
  value,
  onChange,
  embeds,
  maxLength,
  formulas = false,
  formulaProfile = 'GENERAL',
  onBusyChange,
  onUploaded,
  invalidEmbedId,
  rows = 4,
  placeholder,
  ariaLabel,
  disabled = false,
  invalid = false,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Описание вставок из ответа материала; свои загрузки поле добавляет к ним само. */
  embeds?: ContentEmbed[] | null;
  maxLength?: number;
  /** Кнопка «Формула» и предпросмотр формул — там, где раньше стоял `FormulaField`. */
  formulas?: boolean;
  formulaProfile?: FormulaProfile;
  onBusyChange?: (busy: boolean) => void;
  /** Файл загружен и вставлен: экрану — чтобы показать его в предпросмотре до сохранения. */
  onUploaded?: (embed: ContentEmbed) => void;
  /** Вставка, которую сервер отклонил при сохранении (`details.id` ответа 400). */
  invalidEmbedId?: string | null;
  rows?: number;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const fieldProps = useFieldControlProps({ ariaLabel, ariaInvalid: invalid || undefined });
  const { policy, upload } = useContentEmbedServices();
  const [uploaded, setUploaded] = useState<Record<string, ContentEmbed>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState('');
  const [formula, setFormula] = useState<{ index: number; latex: string; display: boolean } | null>(null);
  /**
   * Последнее поле ввода, где был курсор. Позиция читается из него в момент вставки, а не
   * запоминается по событиям: выделение мышью и стрелками приходит событием `selectionchange`
   * не сразу, и запомненная позиция отставала бы. Номер блока — из `data-block` того же поля:
   * он всегда от текущего рендера, даже если между фокусом и вставкой блоки сдвинулись.
   */
  const lastArea = useRef<HTMLTextAreaElement | null>(null);
  const currentCursor = (): EmbedCursor | null => {
    const element = lastArea.current;
    if (!element || !element.isConnected) return null;
    if (element.dataset.slot != null) return { slot: Number(element.dataset.slot) };
    if (element.dataset.block != null) {
      return { block: Number(element.dataset.block), offset: element.selectionStart ?? element.value.length };
    }
    return null;
  };
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<{ block: number; kind: EmbedKind } | null>(null);
  const latest = useRef({ value, onChange, onBusyChange, onUploaded });
  latest.current = { value, onChange, onBusyChange, onUploaded };
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const canInsert = !disabled && policy?.enabled === true && upload != null;
  const busy = pending != null;

  // Пока идёт загрузка, на месте будущей вставки — заглушка. Строка материала её не видит.
  const shown = pending && 'cursor' in pending
    ? insertEmbed(value, pending.cursor, pending.kind, PENDING_ID)
    : value;
  const blocks = useMemo(() => embedBlocks(shown), [shown]);
  const layout = useMemo(() => rowsOf(blocks), [blocks]);
  const known = useMemo(() => {
    const map = new Map<string, ContentEmbed>();
    for (const embed of embeds ?? []) if (embed.id) map.set(embed.id, embed);
    for (const [id, embed] of Object.entries(uploaded)) map.set(id, embed);
    return map;
  }, [embeds, uploaded]);

  async function startUpload(file: File, kind: EmbedKind, target: { cursor: EmbedCursor | null } | { replace: number }) {
    if (busy || !canInsert || !upload) return;
    const problem = embedFileProblem(file, kind, policy);
    if (problem) {
      setError(`Не удалось вставить «${file.name}»: ${problem}`);
      return;
    }
    setError('');
    setPending({ kind, name: file.name, ...target });
    latest.current.onBusyChange?.(true);
    try {
      const embed = await upload(file, kind);
      if (!embed.id) throw new Error('Сервер не вернул файл');
      const id = embed.id;
      setUploaded((previous) => ({ ...previous, [id]: embed }));
      latest.current.onUploaded?.(embed);
      const current = latest.current.value;
      latest.current.onChange('replace' in target
        ? replaceEmbed(current, target.replace, kind, id)
        : insertEmbed(current, target.cursor, kind, id));
    } catch (caught) {
      if (mounted.current) {
        setError(`Не удалось загрузить «${file.name}»: ${caught instanceof ApiError
          ? caught.message : 'проверьте связь и попробуйте ещё раз.'}`);
      }
    } finally {
      latest.current.onBusyChange?.(false);
      if (mounted.current) setPending(null);
    }
  }

  function pick(kind: EmbedKind, files: FileList | null) {
    // Снимок списка до сброса поля: сброс обнуляет FileList (см. CreateServiceRequestModal).
    const file = files?.[0];
    if (imageInput.current) imageInput.current.value = '';
    if (fileInput.current) fileInput.current.value = '';
    const target = replaceTarget.current;
    replaceTarget.current = null;
    if (!file) return;
    void startUpload(file, kind, target && target.kind === kind ? { replace: target.block } : { cursor: currentCursor() });
  }

  function choose(kind: EmbedKind, replaceBlock?: number) {
    replaceTarget.current = replaceBlock == null ? null : { block: replaceBlock, kind };
    (kind === 'image' ? imageInput : fileInput).current?.click();
  }

  function insertPasted(event: ClipboardEvent<HTMLTextAreaElement>, at: EmbedCursor) {
    const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith('image/'));
    if (!file || !canInsert) return;
    event.preventDefault();
    void startUpload(file, 'image', { cursor: at });
  }

  /** Файл, перетащенный на поле, встаёт туда, где последний раз стоял курсор. */
  function insertDropped(event: DragEvent<HTMLElement>) {
    const file = event.dataTransfer?.files?.[0];
    if (!file || !canInsert) return;
    event.preventDefault();
    const at = currentCursor();
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    void startUpload(file, IMAGE_EXTENSIONS.includes(extension) ? 'image' : 'file', { cursor: at });
  }

  function saveFormula(latex: string, display: boolean) {
    if (!formula) return;
    if (formula.index >= 0) {
      onChange(replaceFormulaAt(value, formula.index, latex, display));
    } else {
      onChange(insertFormulaIntoBlocks(value, currentCursor(), latex, display));
    }
    setFormula(null);
  }

  const formulaPreview = formulas ? stripEmbeds(value) : '';
  const tooLong = maxLength != null && value.length > maxLength;
  let firstText = true;

  return (
    <div
      className="w-full min-w-0"
      onDragOver={(event) => { if (canInsert && event.dataTransfer?.types.includes('Files')) event.preventDefault(); }}
      onDrop={insertDropped}
    >
      <div className={cx('min-w-0 space-y-2 rounded-xl', invalid && 'ring-1 ring-red-300')}>
        {layout.map((row, index) => {
          if (row.type === 'embed') {
            return (
              <EmbedCard
                key={index}
                kind={row.kind}
                embed={row.id === PENDING_ID ? undefined : known.get(row.id)}
                pendingName={row.id === PENDING_ID ? pending?.name : undefined}
                replacing={pending != null && 'replace' in pending && pending.replace === row.block ? pending.name : undefined}
                invalid={invalidEmbedId === row.id}
                disabled={disabled || busy}
                canInsert={canInsert}
                canMoveUp={canMoveEmbed(value, row.block, -1)}
                canMoveDown={canMoveEmbed(value, row.block, 1)}
                onReplace={() => choose(row.kind, row.block)}
                onMove={(direction) => onChange(moveEmbed(value, row.block, direction))}
                onRemove={() => onChange(removeEmbed(value, row.block))}
              />
            );
          }
          const isFirst = firstText;
          firstText = false;
          const at: EmbedCursor = row.type === 'text' ? { block: row.block, offset: 0 } : { slot: row.slot };
          return (
            <AutoTextArea
              key={index}
              {...(isFirst
                ? { ...fieldProps, 'aria-label': ariaLabel }
                : { 'aria-label': ariaLabel ? `${ariaLabel}: продолжение` : 'Продолжение текста' })}
              value={row.type === 'text' ? row.text : ''}
              rows={isFirst && layout.length === 1 ? rows : row.type === 'slot' ? 1 : 2}
              placeholder={isFirst && layout.length === 1 ? placeholder : row.type === 'slot' ? 'Продолжите текст…' : undefined}
              disabled={disabled}
              readOnly={busy}
              invalid={invalid}
              data-block={row.type === 'text' ? row.block : undefined}
              data-slot={row.type === 'slot' ? row.slot : undefined}
              onCursor={(element) => { lastArea.current = element; }}
              onChange={(next) => onChange(row.type === 'text' ? updateTextBlock(value, row.block, next) : fillSlot(value, row.slot, next))}
              onPaste={(event) => insertPasted(event, row.type === 'text'
                ? { block: row.block, offset: event.currentTarget.selectionStart ?? row.text.length }
                : at)}
            />
          );
        })}
      </div>

      {!disabled && (canInsert || formulas || maxLength != null) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {canInsert && (
            <>
              <ToolbarButton icon={<ImagePlus className="size-3.5" />} disabled={busy} onClick={() => choose('image')}>
                Изображение
              </ToolbarButton>
              <ToolbarButton icon={<Paperclip className="size-3.5" />} disabled={busy} onClick={() => choose('file')}>
                Документ
              </ToolbarButton>
            </>
          )}
          {formulas && (
            <ToolbarButton icon={<Sigma className="size-3.5" />} disabled={busy}
              onClick={() => setFormula({ index: -1, latex: '', display: false })}>
              Формула
            </ToolbarButton>
          )}
          {canInsert && (
            <span className="text-11 text-muted">Рисунок или файл встанет туда, где стоит курсор.</span>
          )}
          {maxLength != null && (
            <span className={cx('ml-auto text-11', tooLong ? 'font-semibold text-danger-fg' : 'text-muted')}>
              {value.length} / {maxLength}
            </span>
          )}
        </div>
      )}
      {tooLong && (
        <p role="alert" className="mt-1 text-sm text-danger-fg">
          Текст длиннее {maxLength} знаков — сократите его. Каждый рисунок и файл занимает около 45 знаков.
        </p>
      )}
      {error && <p role="alert" className="mt-1 text-sm text-danger-fg">{error}</p>}

      {canInsert && (
        <>
          <input ref={imageInput} type="file" className="hidden" accept={acceptOf('image', policy)}
            aria-label="Файл рисунка" onChange={(event) => pick('image', event.target.files)} />
          <input ref={fileInput} type="file" className="hidden" accept={acceptOf('file', policy)}
            aria-label="Файл документа" onChange={(event) => pick('file', event.target.files)} />
        </>
      )}

      {formulas && /\$/.test(formulaPreview) && (
        <div className="mt-2 min-w-0 rounded-xl bg-neutral-bg px-3 py-2">
          <p className="text-11 font-semibold uppercase tracking-wide text-muted">Предпросмотр формул</p>
          <div className="mt-1 min-w-0 text-15 leading-relaxed text-ink">
            <EditableFormulaPreview
              value={formulaPreview}
              onEdit={(index, latex, display) => setFormula({ index, latex, display })}
              onRemove={(index) => onChange(removeFormulaAt(value, index))}
            />
          </div>
        </div>
      )}

      {formula && !disabled && (
        <FormulaEditorModal
          open
          profile={formulaProfile}
          initialLatex={formula.latex}
          initialDisplay={formula.display}
          onClose={() => setFormula(null)}
          onSave={saveFormula}
        />
      )}
    </div>
  );
}

/**
 * Строки редактора. Пустое место «Продолжите текст…» стоит перед вставкой в начале, между двумя
 * вставками и после последней: туда можно поставить курсор и писать дальше.
 *
 * Ключ строки — её номер: когда в пустом месте начали писать, оно становится текстовым блоком
 * на той же позиции, и поле ввода не пересоздаётся — фокус и курсор остаются на месте.
 */
function rowsOf(blocks: ContentBlock[]): Row[] {
  const rows: Row[] = [];
  blocks.forEach((block, index) => {
    if (block.type === 'embed' && (index === 0 || blocks[index - 1].type === 'embed')) {
      rows.push({ type: 'slot', slot: index });
    }
    rows.push(block.type === 'text'
      ? { type: 'text', block: index, text: block.text }
      : { type: 'embed', block: index, kind: block.kind, id: block.id });
  });
  if (blocks.at(-1)?.type === 'embed') rows.push({ type: 'slot', slot: blocks.length });
  return rows;
}

/** Формула — в блок под курсором, а не в конец строки: в конце строки может стоять маркер вставки. */
function insertFormulaIntoBlocks(value: string, cursor: EmbedCursor | null, latex: string, display: boolean): string {
  const blocks = embedBlocks(value);
  if (cursor && 'block' in cursor && blocks[cursor.block]?.type === 'text') {
    const text = (blocks[cursor.block] as { text: string }).text;
    return updateTextBlock(value, cursor.block, insertFormulaAt(text, cursor.offset, latex, display).text);
  }
  if (cursor && 'slot' in cursor) return fillSlot(value, cursor.slot, wrapFormula(latex, display));
  const last = blocks.length - 1;
  if (blocks[last]?.type === 'text') {
    const text = (blocks[last] as { text: string }).text;
    return updateTextBlock(value, last, insertFormulaAt(text, text.length, latex, display).text);
  }
  return fillSlot(value, blocks.length, wrapFormula(latex, display));
}

function AutoTextArea({
  value,
  onChange,
  onCursor,
  rows,
  invalid,
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  value: string;
  onChange: (next: string) => void;
  /** Поле получило фокус или курсор: родитель запоминает само поле, позицию прочтёт при вставке. */
  onCursor: (element: HTMLTextAreaElement) => void;
  invalid?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Поле растёт по тексту: блоки идут столбиком, и полоса прокрутки внутри каждого мешала бы
  // читать текст вокруг рисунка.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [value]);

  const remember = () => {
    const element = ref.current;
    if (element) onCursor(element);
  };

  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      onSelect={remember}
      onKeyUp={remember}
      onClick={remember}
      onFocus={remember}
      className={cx(
        'input-base block min-h-[44px] resize-none overflow-hidden',
        invalid && 'border-red-300 focus:border-red-400 focus:ring-red-300/30',
      )}
    />
  );
}

function ToolbarButton({ icon, children, disabled, onClick }: {
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-13 font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}

function EmbedCard({
  kind,
  embed,
  pendingName,
  replacing,
  invalid,
  disabled,
  canInsert,
  canMoveUp,
  canMoveDown,
  onReplace,
  onMove,
  onRemove,
}: {
  kind: EmbedKind;
  embed: ContentEmbed | undefined;
  pendingName?: string;
  replacing?: string;
  invalid: boolean;
  disabled: boolean;
  canInsert: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onReplace: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const noun = kind === 'image' ? 'рисунок' : 'файл';
  if (pendingName != null || replacing != null) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50 px-3 py-3 text-sm text-brand-700"
        aria-live="polite">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        Загрузка «{pendingName ?? replacing}»…
      </div>
    );
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-1.5">
      {canInsert && (
        <Button type="button" size="sm" variant="secondary" icon={<RefreshCw className="size-4" />} disabled={disabled}
          onClick={onReplace}>
          Заменить
        </Button>
      )}
      <Button type="button" size="icon-sm" variant="secondary" icon={<ArrowUp className="size-4" />}
        disabled={disabled || !canMoveUp} onClick={() => onMove(-1)}
        aria-label={`Переместить ${noun} выше`} title="Выше" />
      <Button type="button" size="icon-sm" variant="secondary" icon={<ArrowDown className="size-4" />}
        disabled={disabled || !canMoveDown} onClick={() => onMove(1)}
        aria-label={`Переместить ${noun} ниже`} title="Ниже" />
      <Button type="button" size="sm" variant="danger-ghost" icon={<Trash2 className="size-4" />} disabled={disabled}
        onClick={onRemove}>
        Удалить
      </Button>
    </div>
  );

  return (
    <div
      role="group"
      aria-label={embed?.fileName ? `${kind === 'image' ? 'Рисунок' : 'Файл'} «${embed.fileName}»` : undefined}
      className={cx('min-w-0 space-y-2 rounded-xl border bg-white p-2',
        invalid ? 'border-red-300 ring-2 ring-red-200' : 'border-slate-200')}
    >
      {!embed || embed.available === false
        ? <EmbedUnavailable kind={kind} />
        : kind === 'image' ? <EmbedImage embed={embed} compact /> : <EmbedFileCard embed={embed} />}
      {invalid && (
        <p className="text-sm text-danger-fg">Файл не найден — замените его или удалите.</p>
      )}
      {actions}
    </div>
  );
}
