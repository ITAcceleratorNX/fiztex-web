import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusNotice } from '@/components/ui/StatusNotice';
import type { AssessmentAnalysisWork } from '@/hooks/specialReportQueries';
import { formatDate } from '@/lib/format';
import { LEVEL_LABELS, LEVEL_RANGES, percentText, workStateHint, workTitle } from '@/lib/specialReportModel';

const LEVELS = ['LOW', 'MIDDLE', 'HIGH'] as const;
const STATE_LABELS = { SCORED: 'Результат', NOT_TAKEN: 'Не выполнял работу', MISSING: 'Нет результата' } as const;

/**
 * Окно работы СОР/СОЧ: показатели и перечни учеников по уровням (как в форме приказа №130).
 * Только чтение — всё посчитано сервером. Текстового педагогического анализа нет: заполнять его
 * по каждой работе отнимало у учителей время, и блок убран (ТЗ §6 называет его необязательным).
 */
export function WorkAnalysisModal({ work, onClose }: { work: AssessmentAnalysisWork; onClose: () => void }) {
  const hint = workStateHint(work);
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={workTitle(work)}
      subtitle={[work.subject?.name, formatDate(work.lessonDate), work.teacher?.name, `максимум ${work.maxScore}`]
        .filter(Boolean).join(' · ')}
      footer={<div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Закрыть</Button></div>}
    >
      <div className="space-y-5">
        {hint && <StatusNotice tone="warning">{hint}</StatusNotice>}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="С результатом" value={String(work.resultCount ?? 0)} />
          <Stat label="Без результата" value={`${work.withoutResultCount ?? 0}${work.notTakenCount ? ` (н/в: ${work.notTakenCount})` : ''}`} />
          <Stat label="Качество" value={percentText(work.qualityPercent)} />
          <Stat label="Успеваемость" value={percentText(work.successPercent)} />
        </dl>

        <section className="space-y-2">
          <h3 className="text-15 font-semibold text-ink">Ученики по уровням</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {LEVELS.map((level) => {
              const names = (work.students ?? []).filter((student) => student.level === level);
              return (
                <div key={level} className="rounded-xl border border-line p-3">
                  <p className="text-13 font-semibold text-ink">
                    {LEVEL_LABELS[level]} <span className="font-normal text-slate-500">({LEVEL_RANGES[level]}) · {names.length}</span>
                  </p>
                  <ul className="mt-2 space-y-1 text-13 text-slate-700">
                    {names.length === 0 ? <li className="text-slate-400">—</li> : names.map((student) => (
                      <li key={student.studentProfileId}>{student.name} <span className="text-slate-500">— {student.score} ({student.percent} %)</span></li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <OtherStudents work={work} />
        </section>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <dt className="text-11 text-slate-500">{label}</dt>
      <dd className="text-15 font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** Ученики без учтённого балла: нет результата, «не выполнял», исключённый балл, выбывшие. */
function OtherStudents({ work }: { work: AssessmentAnalysisWork }) {
  const others = (work.students ?? []).filter((student) => student.level == null);
  if (others.length === 0) return null;
  // Список бывает длинным (незаполненная работа — весь класс): свёрнут, пока его не откроют.
  return (
    <details className="text-13 text-slate-600">
      <summary className="cursor-pointer font-semibold text-ink">Без уровня · {others.length}</summary>
      <p className="mt-1">
        {others.map((student) => `${student.name} — ${student.excluded ? 'балл исключён' : STATE_LABELS[student.state ?? 'MISSING']}`
          + (student.inAudience === false ? ' (выбыл)' : '')).join('; ')}
      </p>
    </details>
  );
}
