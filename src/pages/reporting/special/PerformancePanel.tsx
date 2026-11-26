import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyBlock } from '@/components/ui/StateBlock';
import { StatusNotice } from '@/components/ui/StatusNotice';
import type { PerformanceFormReport, PerformanceRow } from '@/hooks/specialReportQueries';
import {
  averageText,
  NO_DATA,
  percentText,
  performanceState,
  showsCategories,
} from '@/lib/specialReportModel';
import { ReportTable, type ReportColumn } from '../ReportTable';

const dash = <span className="text-slate-400">—</span>;

/**
 * Таблица форм «Успеваемость класса» и «Учителю по предмету». Строка — класс (подгруппа) ×
 * предмет; все числа и состояние строки — ответ сервера по опубликованным итогам. Прочерк
 * и «Недостаточно данных» несут пояснение из состояния, а не ноль.
 */
export function PerformancePanel({ report }: { report: PerformanceFormReport }) {
  const rows = report.rows ?? [];
  const methodology = report.methodology;
  const anyPassFail = rows.some((row) => (row.passed ?? 0) + (row.failed ?? 0) > 0);
  const anyNotStudied = rows.some((row) => (row.notStudied ?? 0) > 0);

  const columns: ReportColumn<PerformanceRow>[] = [
    { key: 'class', header: 'Класс', className: 'w-36',
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.schoolClass?.name}</span>
          {row.subgroup && <span className="text-11 font-normal text-slate-500">{row.subgroup.name}</span>}
          {row.demo && <span className="mt-1"><Badge tone="purple" size="xs" appearance="label">Демо</Badge></span>}
        </span>
      ) },
    { key: 'subject', header: 'Предмет', cell: (row) => row.subject?.name ?? dash },
    { key: 'teachers', header: 'Педагог',
      cell: (row) => (row.teachers ?? []).map((item) => item.name).filter(Boolean).join(', ') || dash },
    { key: 'students', header: 'Учащихся', align: 'right', cell: (row) => row.studentCount ?? dash },
    { key: 'n', header: 'N', align: 'right', cell: (row) => (showsCategories(row) ? row.n : dash) },
    { key: 'a', header: 'A 9–10', align: 'right', cell: (row) => (showsCategories(row) ? row.a : dash) },
    { key: 'b', header: 'B 7–8', align: 'right', cell: (row) => (showsCategories(row) ? row.b : dash) },
    { key: 'c', header: 'C 4–6', align: 'right', cell: (row) => (showsCategories(row) ? row.c : dash) },
    { key: 'd', header: 'D 1–3', align: 'right', cell: (row) => (showsCategories(row) ? row.d : dash) },
    { key: 'u', header: 'ВНА / НА', align: 'right',
      cell: (row) => <span title={`ВНА: ${row.temporarilyUnattested ?? 0}, НА: ${row.notAttested ?? 0}`}>{row.u ?? 0}</span> },
    { key: 'missing', header: 'Нет итога', align: 'right', cell: (row) => row.missing ?? 0 },
    ...(anyNotStudied ? [{ key: 'notStudied', header: 'Не изучал', align: 'right' as const, cell: (row: PerformanceRow) => row.notStudied ?? 0 }] : []),
    ...(anyPassFail ? [{ key: 'passFail', header: 'Зачёт / незачёт', align: 'right' as const,
      cell: (row: PerformanceRow) => `${row.passed ?? 0} / ${row.failed ?? 0}` }] : []),
    { key: 'average', header: 'Ср. балл', align: 'right', cell: (row) => <Value text={averageText(row.average)} /> },
    { key: 'success', header: 'Успеваемость', align: 'right',
      cell: (row) => <Value text={percentText(row.successPercent, row.state === 'INCOMPLETE')} /> },
    { key: 'quality', header: 'Качество', align: 'right',
      cell: (row) => <Value text={percentText(row.qualityPercent, row.state === 'INCOMPLETE')} /> },
    { key: 'sou', header: 'СОУ', align: 'right',
      cell: (row) => <Value text={percentText(row.sou, row.state === 'INCOMPLETE')} /> },
    { key: 'state', header: 'Состояние',
      cell: (row) => {
        const state = performanceState(row);
        return (
          <span title={state.hint ?? undefined} className="inline-flex">
            <Badge tone={state.tone} size="xs" appearance="label">{state.label}</Badge>
          </span>
        );
      } },
  ];

  return (
    <div className="space-y-3">
      {methodology && !methodology.approved && (
        <StatusNotice tone="warning">
          Проект методики ({methodology.version}): расчёт не является официальным до утверждения школой.
          Категории — по 10-балльным опубликованным итогам; СОУ = ({methodology.weightA}A + {methodology.weightB}B
          + {methodology.weightC}C + {methodology.weightD}D + {methodology.weightU}U) / N.
        </StatusNotice>
      )}
      {report.demo && <StatusNotice tone="attention">Демо-данные — не для официальной отчётности. Выгрузка недоступна.</StatusNotice>}
      {rows.length === 0 ? (
        <section className="rounded-2xl border border-line bg-surface shadow-soft">
          <EmptyBlock icon={<Info className="h-7 w-7" />} title="Строк нет"
            description="По выбранным фильтрам нет ни назначений, ни опубликованных итогов." />
        </section>
      ) : (
        <ReportTable
          label={report.form === 'TEACHER' ? 'Учителю по предмету' : 'Успеваемость класса по предмету'}
          rows={rows}
          rowKey={(row) => rowKey(row)}
          rowLabel={(row) => `${row.schoolClass?.name ?? ''} ${row.subject?.name ?? ''}`}
          columns={columns}
        />
      )}
      <p className="text-11 text-slate-500">
        N — учащиеся, подлежащие числовой аттестации: A+B+C+D+ВНА/НА+без итога. «Не изучал», зачёт и незачёт в N не входят.
        Источник — подтверждённые опубликованные итоги периода; без периода — годовые.
      </p>
    </div>
  );
}

function Value({ text }: { text: string }) {
  return text === NO_DATA || text.startsWith('Недостаточно')
    ? <span className="text-slate-400">{text}</span> : <span>{text}</span>;
}

/** Ключ строки: класс, подгруппа и предмет — у классного руководителя строк по классу несколько. */
function rowKey(row: PerformanceRow): number {
  return (row.schoolClass?.id ?? 0) * 1_000_003 + (row.subject?.id ?? 0) * 101 + (row.subgroup?.id ?? 0);
}
