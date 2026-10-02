export function FilterChip({ label, selected, onClick }: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-2 ${selected ? 'bg-navy-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
  >{label}</button>;
}
