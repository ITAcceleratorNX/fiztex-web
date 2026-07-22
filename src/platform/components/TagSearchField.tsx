import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cx } from '@/lib/format';

export type TagOption = { id: string; label: string };

/** Search + multi-select chips field (linked students / subjects). */
export function TagSearchField({
  value,
  onChange,
  options,
  placeholder,
  loading,
  query,
  onQueryChange,
}: {
  value: TagOption[];
  onChange: (next: TagOption[]) => void;
  options: TagOption[];
  placeholder?: string;
  loading?: boolean;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selectedIds = new Set(value.map((v) => v.id));
  const filtered = options.filter((o) => !selectedIds.has(o.id));

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  function add(option: TagOption) {
    onChange([...value, option]);
    onQueryChange('');
    setOpen(false);
  }

  function remove(id: string) {
    onChange(value.filter((v) => v.id !== id));
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        className={cx(
          'input-base flex min-h-[44px] flex-wrap items-center gap-2 py-2',
          'focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30',
        )}
      >
        <Search className="ml-0.5 h-4 w-4 shrink-0 text-slate-400" />
        {value.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700"
          >
            {tag.label}
            <button
              type="button"
              aria-label={`Убрать ${tag.label}`}
              onClick={() => remove(tag.id)}
              className="rounded p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 ? placeholder : placeholder}
          className="min-w-[10rem] flex-1 border-0 bg-transparent p-0 text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl bg-white py-1 shadow-pop ring-1 ring-slate-200/80 animate-scale-in"
        >
          {loading ? (
            <li className="px-3.5 py-2.5 text-sm text-slate-400">Поиск…</li>
          ) : filtered.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-slate-400">Ничего не найдено</li>
          ) : (
            filtered.map((option) => (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  className="block w-full px-3.5 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  onClick={() => add(option)}
                >
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
