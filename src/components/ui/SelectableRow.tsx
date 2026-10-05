import type { ReactNode } from 'react';

export function SelectableRow({ title, meta, checked, onChange, icon, disabled = false }: {
  title: string;
  meta?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return <label className={`flex min-h-[60px] cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:border-navy-400 ${checked ? 'border-navy-700 bg-slate-50' : 'border-slate-200 bg-white'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      disabled={disabled}
      className="size-5 shrink-0 accent-navy-700"
    />
    {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
      {meta && <span className="mt-0.5 block truncate text-xs text-slate-500">{meta}</span>}
    </span>
  </label>;
}
