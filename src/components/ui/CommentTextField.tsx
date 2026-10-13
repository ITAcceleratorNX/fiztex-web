import { useId } from 'react';
import { Loader2 } from 'lucide-react';
import { AiGeneratedBadge } from './AiGeneratedBadge';
import { cx } from '@/lib/format';

/** Shared long-form comment field; the feature owns generation and publication. */
export function CommentTextField({ label, value, onChange, disabled, generating, aiGenerated, readOnly = false }: {
  label: string; value: string; onChange: (value: string) => void;
  disabled?: boolean; generating?: boolean; aiGenerated?: boolean; readOnly?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-13 font-semibold text-slate-600">{label}</label>
      <div className={cx('flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 focus-within:ring-2 focus-within:ring-navy-700', !readOnly && 'min-h-comment-field')}>
        {generating ? (
          <div role="status" className="flex min-h-36 flex-1 items-center justify-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />AI генерирует…
          </div>
        ) : readOnly ? (
          <p id={id} className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{value}</p>
        ) : (
          <textarea id={id} value={value} onChange={e => onChange(e.target.value)} maxLength={1000}
            disabled={disabled} rows={6} placeholder="Успеваемость, поведение на уроке, другие наблюдения"
            className="min-h-36 w-full flex-1 resize-y bg-transparent text-sm leading-relaxed text-ink outline-none placeholder:text-muted disabled:opacity-60" />
        )}
        {!readOnly && <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted">
          <span>{aiGenerated ? <AiGeneratedBadge /> : null}</span>
          <span>{value.length}/1000</span>
        </div>}
      </div>
    </div>
  );
}
