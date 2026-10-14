import { useId } from 'react';
import type { PointKind } from '@/lib/dynamicsModel';
import { dayMonth } from '@/lib/dynamicsModel';

export interface ChartLine {
  key: string;
  label: string;
  points: ReadonlyArray<{ date: string; value: number }>;
  /** Пунктир — ориентир (средний по классу), сплошная — сам ученик. */
  dashed?: boolean;
}

export interface ChartMarker {
  key: string;
  date: string;
  value: number;
  kind: PointKind;
  /** Подсказка: «22.09 · СОР 14 из 20 → средний 7,0». */
  title: string;
}

const W = 640;
const H = 220;
const PAD = { left: 32, right: 40, top: 16, bottom: 28 };

function dayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * График динамики (Figma «Динамика среднего балла», «Оценки и средний балл»).
 *
 * <p>Рисует только то, что пришло с сервера: точки рядов и оценок уже посчитаны, здесь —
 * масштаб осей и разметка. Ось Y — от целого снизу до целого сверху по всем значениям,
 * чтобы ориентир и последняя точка не упирались в край.
 */
export function DynamicsChart({
  from,
  to,
  lines,
  markers = [],
  reference,
  label,
  formatValue,
}: {
  from: string;
  to: string;
  lines: ChartLine[];
  markers?: ChartMarker[];
  /** Пунктир «Прошлый период: 7,5». */
  reference?: { value: number; label: string };
  label: string;
  formatValue: (value: number) => string;
}) {
  const clipId = useId();
  const values = [
    ...lines.flatMap((line) => line.points.map((point) => point.value)),
    ...markers.map((marker) => marker.value),
    ...(reference ? [reference.value] : []),
  ];
  if (values.length === 0) return null;
  let min = Math.floor(Math.min(...values));
  let max = Math.ceil(Math.max(...values));
  // Запас у краёв: точка, равная целому делению, не ложится на ось.
  if (Math.min(...values) - min < 0.25) min -= 1;
  if (max - Math.max(...values) < 0.25) max += 1;
  const step = Math.max(1, Math.ceil((max - min) / 4));
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);

  const x0 = dayIndex(from);
  const span = Math.max(1, dayIndex(to) - x0);
  const x = (iso: string) => PAD.left + ((dayIndex(iso) - x0) / span) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((share) => {
    const d = new Date((x0 + Math.round(span * share)) * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
  const main = lines.find((line) => !line.dashed);
  const last = main?.points[main.points.length - 1];

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full overflow-visible">
        <defs>
          <clipPath id={clipId}><rect x={0} y={0} width={W} height={H} /></clipPath>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-slate-200" />
            <text x={PAD.left - 10} y={y(tick) + 4} textAnchor="end" className="fill-slate-400 text-11">{tick}</text>
          </g>
        ))}
        {xTicks.map((tick, index) => (
          <text key={`${tick}-${index}`} x={x(tick)} y={H - 6} textAnchor={index === 0 ? 'start' : index === 4 ? 'end' : 'middle'}
            className="fill-slate-400 text-11">{dayMonth(tick)}</text>
        ))}
        {reference && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(reference.value)} y2={y(reference.value)}
              strokeDasharray="4 4" className="stroke-slate-400" />
            <text x={PAD.left + 4} y={y(reference.value) - 6} className="fill-slate-500 text-11">{reference.label}</text>
          </g>
        )}
        <g clipPath={`url(#${clipId})`}>
          {lines.map((line) => (
            <polyline
              key={line.key}
              fill="none"
              strokeWidth={line.dashed ? 1.5 : 2.5}
              strokeDasharray={line.dashed ? '5 5' : undefined}
              strokeLinejoin="round"
              className={line.dashed ? 'stroke-slate-400' : 'stroke-navy-700'}
              points={line.points.map((point) => `${x(point.date)},${y(point.value)}`).join(' ')}
            />
          ))}
          {main && markers.length === 0 && main.points.map((point) => (
            <circle key={point.date} cx={x(point.date)} cy={y(point.value)} r={3.5} className="fill-navy-700" />
          ))}
          {markers.map((marker) => <Marker key={marker.key} cx={x(marker.date)} cy={y(marker.value)} marker={marker} />)}
        </g>
        {last && (
          <text x={x(last.date) + 6} y={y(last.value) - 8} className="fill-ink text-13 font-bold">{formatValue(last.value)}</text>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-11 text-slate-500">
        {lines.map((line) => (
          <span key={line.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={line.dashed ? 'w-4 border-t border-dashed border-slate-400' : 'w-4 border-t-2 border-navy-700'} />
            {line.label}
          </span>
        ))}
        {reference && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="w-4 border-t border-dashed border-slate-400" />Средний за прошлый период
          </span>
        )}
        {markers.length > 0 && (
          <>
            <Legend kind="REGULAR" label="Оценка" />
            <Legend kind="SOR" label="СОР" />
            <Legend kind="SOCH" label="СОЧ" />
          </>
        )}
      </figcaption>
    </figure>
  );
}

function Marker({ cx, cy, marker }: { cx: number; cy: number; marker: ChartMarker }) {
  const title = <title>{marker.title}</title>;
  if (marker.kind === 'SOR') {
    return <rect x={cx - 5} y={cy - 5} width={10} height={10} className="fill-green-600" tabIndex={0}>{title}</rect>;
  }
  if (marker.kind === 'SOCH') {
    return <rect x={cx - 5} y={cy - 5} width={10} height={10} transform={`rotate(45 ${cx} ${cy})`} className="fill-navy-700" tabIndex={0}>{title}</rect>;
  }
  return <circle cx={cx} cy={cy} r={5} strokeWidth={2} className="fill-white stroke-navy-700" tabIndex={0}>{title}</circle>;
}

function Legend({ kind, label }: { kind: PointKind; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        {kind === 'SOR' ? <rect x={1} y={1} width={10} height={10} className="fill-green-600" />
          : kind === 'SOCH' ? <rect x={2.5} y={2.5} width={7} height={7} transform="rotate(45 6 6)" className="fill-navy-700" />
            : <circle cx={6} cy={6} r={4} strokeWidth={2} className="fill-white stroke-navy-700" />}
      </svg>
      {label}
    </span>
  );
}
