import { PhysTechMark } from '@/components/layout/Logo';

export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card relative flex flex-col justify-between overflow-hidden px-6 py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-3 text-4xl font-extrabold text-slate-900">{value}</p>
      <PhysTechMark className="pointer-events-none absolute -right-2 top-1/2 h-20 w-20 -translate-y-1/2 text-navy-700/10" />
    </div>
  );
}
