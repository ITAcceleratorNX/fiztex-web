import { useState } from 'react';
import { Select } from '@/components/ui/Select';
import { Field, TextArea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useClassYearFinals, usePublishClassYearFinals, useSetFinalGrade } from '@/hooks/queries';
import type { ClassFinalGradeRow, FinalGrade, YearFinalsQuery } from '@/lib/gradebookApi';
import { ApiError } from '@/lib/api';
import { QuarterFinalsTable } from './QuarterFinalsTable';
import { FinalGradeCorrectionModal, FinalGradeHistoryModal } from './FinalGradeCorrectionModal';

const SCOPES = { YEAR: 'Годовая оценка', EXAM: 'Экзаменационная оценка', FINAL: 'Окончательная оценка' } as const;

export function YearFinalsTab({ query }: { query: Omit<YearFinalsQuery, 'scope'> | null }) {
  const [scope, setScope] = useState<YearFinalsQuery['scope']>('YEAR');
  const fullQuery = query ? { ...query, scope } : null;
  const finals = useClassYearFinals(fullQuery);
  const setFinal = useSetFinalGrade();
  const publish = usePublishClassYearFinals();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reasonRow, setReasonRow] = useState<ClassFinalGradeRow | null>(null);
  const [reason, setReason] = useState('');
  const [correcting, setCorrecting] = useState<ClassFinalGradeRow | null>(null);
  const [history, setHistory] = useState<ClassFinalGradeRow | null>(null);

  async function pick(row: ClassFinalGradeRow, value: number | null, resultKind: FinalGrade['resultKind'] = 'NUMERIC', resultReason?: string) {
    if (!query) return;
    setBusyId(row.studentProfileId!); setError(null);
    try {
      await setFinal.mutateAsync({ finalGradeId: row.finalGrade?.id ?? null, studentProfileId: row.studentProfileId!,
        subjectId: query.subjectId, academicYearId: query.academicYearId, scope, value, resultKind, resultReason });
      setReasonRow(null);
    } catch (failure) { setError(failure instanceof ApiError ? failure.message : 'Не удалось сохранить итог'); }
    finally { setBusyId(null); }
  }
  async function publishAll() {
    if (!fullQuery) return;
    setConfirm(false); setError(null);
    try { await publish.mutateAsync(fullQuery); }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : 'Не удалось опубликовать итоги'); }
  }
  const data = finals.data;
  const rows = data?.rows ?? [];
  const complete = rows.length > 0 && rows.every(row => row.finalGrade != null);
  const published = rows.length > 0 && rows.every(row => row.finalGrade?.status === 'PUBLISHED');

  return <div className="flex flex-col gap-4">
    <Field label="Вид итога"><Select value={scope} onChange={event => { setScope(event.target.value as YearFinalsQuery['scope']); setError(null); }}>
      {Object.entries(SCOPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </Select></Field>
    <p className="text-13 text-muted">Годовая рассчитывается по опубликованным итогам изученных периодов. Экзамен заполняйте, если он предусмотрен учебным планом или аттестацией. Для окончательного результата с экзаменом нужен утверждённый вес экзамена в политике.</p>
    {!query || finals.isPending ? <LoadingBlock /> : finals.isError ? <ErrorBlock message={finals.error instanceof ApiError ? finals.error.message : 'Не удалось загрузить годовые итоги'} onRetry={() => void finals.refetch()} />
      : data?.assessmentMode === 'NO_ASSESSMENT' ? <EmptyBlock title="В 1 классе учебные достижения не оцениваются" description="Годовые и экзаменационные оценки не выставляются." />
      : data?.assessmentMode === 'NO_EXAM' ? <EmptyBlock title="В 2–4 классах экзаменационная оценка не выставляется" description="Итог года определяется по четвертным оценкам. Выберите годовую оценку." />
      : rows.length === 0 ? <EmptyBlock title="В классе нет учеников" /> : <>
        <div className="card overflow-hidden p-0"><QuarterFinalsTable finals={data!} scope={scope} highlighted={new Set()} busyStudentId={busyId}
          onPick={(row, value) => void pick(row, value)} onPickResult={(row, kind) => {
            if (kind === 'NOT_STUDIED') { setReasonRow(row); setReason(''); } else void pick(row, null, kind);
          }} onCorrect={setCorrecting} onOpenHistory={setHistory} /></div>
        {data?.canManage && <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-13 text-muted">{published ? 'Результаты опубликованы. История доступна в каждой строке.'
            : !data.publicationOpen ? `Публикация доступна после окончания года: с ${data.publishableFrom?.split('-').reverse().join('.')}. Черновики можно подготовить заранее.`
            : complete ? 'Все результаты заполнены. Проверьте рекомендации и опубликуйте набор.' : 'Заполните результат каждого ученика.'}</p>
          <Button disabled={!complete || published || !data.publicationOpen} loading={publish.isPending} onClick={() => setConfirm(true)}>Опубликовать итоги</Button>
        </div>}
      </>}
    {error && <p role="alert" className="rounded-lg bg-danger-bg p-4 text-13 text-danger-fg">{error}</p>}
    <ConfirmDialog open={confirm} title={`Опубликовать: ${SCOPES[scope].toLowerCase()}?`} message="Публикуется весь заполненный набор класса по предмету. Ученики и родители увидят результаты. Опубликованные итоги закрываются для обычного редактирования." confirmLabel="Опубликовать" loading={publish.isPending} onConfirm={() => void publishAll()} onClose={() => setConfirm(false)} />
    {correcting?.finalGrade && <FinalGradeCorrectionModal key={correcting.finalGrade.id} grade={correcting.finalGrade} studentName={correcting.studentName ?? ''} allowedKinds={data?.allowedResultKinds ?? ['NUMERIC']} onClose={() => setCorrecting(null)} />}
    {history?.finalGrade?.id != null && <FinalGradeHistoryModal id={history.finalGrade.id} studentName={history.studentName ?? ''} onClose={() => setHistory(null)} />}
    <Modal open={reasonRow != null} title="Предмет не изучался" onClose={() => setReasonRow(null)} footer={<Button disabled={reason.trim().length < 5} loading={busyId != null} onClick={() => { if (reasonRow) void pick(reasonRow, null, 'NOT_STUDIED', reason.trim()); }}>Сохранить результат</Button>}>
      <Field label="Основание"><TextArea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} /></Field>
      {error && <p role="alert" className="mt-3 text-13 text-danger-fg">{error}</p>}
    </Modal>
  </div>;
}
