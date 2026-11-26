import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyBlock } from '@/components/ui/StateBlock';
import { StatusNotice } from '@/components/ui/StatusNotice';
import type { AssessmentAnalysisReport, AssessmentAnalysisWork } from '@/hooks/specialReportQueries';
import { formatDate } from '@/lib/format';
import { percentText, workStateHint } from '@/lib/specialReportModel';
import { ReportTable, type ReportColumn } from '../ReportTable';
import { WorkAnalysisModal } from './WorkAnalysisModal';

const dash = <span className="text-slate-400">—</span>;

/**
 * «Анализ СОР и СОЧ»: строка — проведённая работа, сгруппировано по периодам. Уровни,
 * качество и успеваемость — с сервера (методика `methodologyVersion`); строка открывает окно
 * работы с перечнями учеников по уровням и педагогическим анализом.
 */
export function AssessmentAnalysisPanel({ report }: { report: AssessmentAnalysisReport }) {
  const [openWorkId, setOpenWorkId] = useState<number | null>(null);
  const periods = report.periods ?? [];
  const works = periods.flatMap((period) => period.works ?? []);
  const openWork = works.find((work) => work.workId === openWorkId);
  const thresholds = report.thresholds;

  const columns: ReportColumn<AssessmentAnalysisWork>[] = [
    { key: 'work', header: 'Работа', className: 'w-32',
      cell: (work) => (
        <span className="flex flex-col">
          <span>{work.title}</span>
          <span className="text-11 font-normal text-slate-500">{formatDate(work.lessonDate)}</span>
        </span>
      ) },
    { key: 'class', header: 'Класс',
      cell: (work) => (
        <span className="flex flex-col">
          <span>{work.schoolClass?.name}</span>
          {work.subgroup && <span className="text-11 text-slate-500">{work.subgroup.name}</span>}
          {work.demo && <span className="mt-1"><Badge tone="purple" size="xs" appearance="label">Демо</Badge></span>}
        </span>
      ) },
    { key: 'subject', header: 'Предмет', cell: (work) => work.subject?.name ?? dash },
    { key: 'teacher', header: 'Педагог', cell: (work) => work.teacher?.name ?? dash },
    { key: 'max', header: 'Макс.', align: 'right', cell: (work) => work.maxScore },
    { key: 'n', header: 'С результатом', align: 'right', cell: (work) => work.resultCount },
    { key: 'without', header: 'Без результата', align: 'right',
      cell: (work) => <span title={work.notTakenCount ? `Из них «не выполнял»: ${work.notTakenCount}` : undefined}>{work.withoutResultCount}</span> },
    { key: 'low', header: 'Низкий', align: 'right', cell: (work) => work.lowCount },
    { key: 'middle', header: 'Средний', align: 'right', cell: (work) => work.middleCount },
    { key: 'high', header: 'Высокий', align: 'right', cell: (work) => work.highCount },
    { key: 'quality', header: 'Качество', align: 'right', cell: (work) => <Percent work={work} value={work.qualityPercent} /> },
    { key: 'success', header: 'Успеваемость', align: 'right', cell: (work) => <Percent work={work} value={work.successPercent} /> },
  ];

  return (
    <div className="space-y-4">
      {report.demo && <StatusNotice tone="attention">Демо-данные — не для официальной отчётности. Выгрузка недоступна.</StatusNotice>}
      {works.length === 0 ? (
        <section className="rounded-2xl border border-line bg-surface shadow-soft">
          <EmptyBlock icon={<ClipboardList className="h-7 w-7" />} title="Проведённых работ нет"
            description="В анализ попадают СОР и СОЧ, отмеченные проведёнными. Измените период, предмет или класс." />
        </section>
      ) : periods.map((period) => (
        <section key={period.period?.id} className="space-y-2">
          {(periods.length > 1 || report.scope?.academicPeriod == null) && (
            <h2 className="text-lg font-semibold text-ink">Период: {period.period?.name}</h2>
          )}
          <ReportTable
            label={`Работы СОР и СОЧ: ${period.period?.name ?? ''}`}
            rows={period.works ?? []}
            rowKey={(work) => work.workId ?? 0}
            rowLabel={(work) => `Открыть анализ работы ${work.title} ${work.schoolClass?.name ?? ''}`}
            selectedKey={openWorkId}
            onOpen={(work) => setOpenWorkId(work.workId ?? null)}
            columns={columns}
          />
        </section>
      ))}
      {thresholds && (
        <p className="text-11 text-slate-500">
          Процент ученика — балл / максимум × 100, округлённый до целого. Уровни: низкий 0–{thresholds.lowMax} %,
          средний {(thresholds.lowMax ?? 0) + 1}–{thresholds.middleMax} %, высокий {(thresholds.middleMax ?? 0) + 1}–100 %.
          Качество — доля p ≥ {thresholds.qualityFrom} %, успеваемость — p ≥ {thresholds.successFrom} % от учеников с результатом.
          Методика {report.methodologyVersion}.
        </p>
      )}
      {openWork && <WorkAnalysisModal work={openWork} onClose={() => setOpenWorkId(null)} />}
    </div>
  );
}

function Percent({ work, value }: { work: AssessmentAnalysisWork; value: number | undefined }) {
  const hint = workStateHint(work);
  const text = percentText(value);
  return (
    <span title={hint ?? undefined} className={value == null ? 'text-slate-400' : undefined}>
      {text}{hint && value != null ? ' *' : ''}
    </span>
  );
}
