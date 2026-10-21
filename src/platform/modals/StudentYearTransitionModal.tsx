import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useStudentYearTransition, useApplyStudentYearTransition } from '@/hooks/queries';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import type { Schema } from '@/lib/apiSchemas';
import { YEAR_DECISION_LABELS } from '@/lib/studentYearDecisionModel';
import { StudentYearDecisionHistory } from '../components/StudentYearDecisionHistory';
import { StudentYearDecisionCancellationModal } from './StudentYearDecisionCancellationModal';

type Choice = { decision: string; targetClassId?: number };

export function StudentYearTransitionModal({ classId, onClose, onSaved }: {
  classId: string; onClose: () => void; onSaved: () => void;
}) {
  const query = useStudentYearTransition(classId);
  const command = useApplyStudentYearTransition();
  const toast = useToast();
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [order, setOrder] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [basis, setBasis] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Schema<'StudentYearDecision'> | null>(null);
  const grade = Number(query.data?.sourceGrade);
  const selected = Object.entries(choices).filter(([, value]) => value.decision)
    .map(([id, value]) => ({ studentProfileId: Number(id), ...value }));
  const valid = selected.length > 0 && order.trim() && orderDate && effectiveDate && basis.trim().length >= 5
    && selected.every(student => !['PROMOTE', 'REPEAT'].includes(student.decision) || student.targetClassId);

  function choose(id: number, value: Choice) {
    setError(null);
    setChoices(previous => ({ ...previous, [id]: value }));
  }
  async function submit() {
    try {
      setError(null);
      await command.mutateAsync({ classId, body: {
        orderNumber: order.trim(), orderDate, effectiveDate, basis: basis.trim(), students: selected,
      } });
      setChoices({});
      setConfirm(false);
      toast.success('Решения оформлены. История учеников сохранена');
      onSaved();
    } catch (failure) {
      setConfirm(false);
      setError(failure instanceof Error ? failure.message : 'Не удалось оформить решения');
    }
  }
  function close() { if (!command.isPending) onClose(); }

  return <>
    <Modal open onClose={close} title="Перевод и выпуск" subtitle={query.data?.className} size="xl" scrollable
      footer={<div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={close} disabled={command.isPending}>Закрыть</Button>
        <Button disabled={!valid || !query.data?.yearEnded || query.isFetching}
          onClick={() => setConfirm(true)}>Проверить решения ({selected.length})</Button>
      </div>}>
      {query.isPending ? <LoadingBlock /> : query.isError
        ? <ErrorBlock message="Не удалось загрузить состав и решения" onRetry={() => void query.refetch()} />
        : <div className="space-y-5">
          <p className="text-13 text-muted">Выберите решение отдельно для каждого ученика. Выпуск после 9 класса и переход в 10 класс оформляются раздельно. Номер приказа и основание сохранятся в истории; архивирование года не заменяет эти решения.</p>
          {!query.data?.yearEnded && <p role="status" className="rounded-lg bg-warning-bg p-3 text-13 text-warning-fg">
            Учебный год ещё идёт. Оформление решений доступно с {formatDate(query.data?.earliestDecisionDate)}.
          </p>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Номер приказа" required><TextInput maxLength={160} value={order} onChange={event => setOrder(event.target.value)} /></Field>
            <Field label="Дата приказа" required><TextInput type="date" min={query.data?.earliestDecisionDate}
              value={orderDate} onChange={event => setOrderDate(event.target.value)} /></Field>
            <Field label="Дата решения" required><TextInput type="date" min={orderDate || query.data?.earliestDecisionDate}
              value={effectiveDate} onChange={event => setEffectiveDate(event.target.value)} /></Field>
          </div>
          <Field label="Основание и протокол" required hint={grade === 1
            ? 'Для повторного обучения в 1 классе нужны заключение ПМПК, заявление родителей и решение педагогического совета.'
            : 'Решение педагогического совета; для выпуска — протокол итоговой аттестации; для повторного обучения и выбытия — соответствующее основание.'}>
            <TextArea value={basis} maxLength={2000} onChange={event => setBasis(event.target.value)} />
          </Field>
          <div className="space-y-3">{query.data?.students?.map(student => {
            const id = student.studentProfileId!;
            const choice = choices[id];
            const expectedGrade = choice?.decision === 'PROMOTE' ? grade + 1 : grade;
            const targets = query.data?.targets?.filter(target => target.grade === String(expectedGrade)) ?? [];
            return <div key={id} className="rounded-lg border border-line p-4">
              <p className="mb-2 text-13 font-semibold text-ink">{student.name}</p>
              {student.decision ? <StudentYearDecisionHistory decisions={[student.decision]} onCancel={setCancelling} /> : <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={`Решение: ${student.name}`}>
                    <Select value={choice?.decision ?? ''} disabled={!query.data?.yearEnded}
                      onChange={event => choose(id, { decision: event.target.value })}>
                      <option value="">Не выбрано</option>
                      {Object.entries(YEAR_DECISION_LABELS)
                        .filter(([value]) => value !== 'GRADUATE' || [9, 11, 12].includes(grade))
                        .filter(([value]) => value !== 'PROMOTE' || grade < 11)
                        .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                  </Field>
                  {['PROMOTE', 'REPEAT'].includes(choice?.decision ?? '') && <Field label={`Следующий класс: ${student.name}`}
                    hint={targets.length === 0 ? `Сначала создайте класс параллели ${expectedGrade} следующего учебного года.` : undefined}>
                    <Select value={choice?.targetClassId ?? ''} onChange={event => choose(id, {
                      ...choices[id], targetClassId: event.target.value ? Number(event.target.value) : undefined,
                    })}>
                      <option value="">Выберите класс</option>
                      {targets.map(target => <option key={target.classId} value={target.classId}>
                        {`${target.className} · ${target.academicYearName}`}
                      </option>)}
                    </Select>
                  </Field>}
                </div>
                {(student.blockers?.length ?? 0) > 0 && <p className="mt-2 text-13 text-warning-fg">
                  {student.blockers?.join('; ')}. Для перевода или выпуска сначала завершите итоги.
                </p>}
              </>}
            </div>;
          })}</div>
        </div>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
    </Modal>
    <Modal open={confirm} onClose={() => { if (!command.isPending) setConfirm(false); }}
      title="Оформить решения учеников?" size="lg" scrollable footer={<>
        <Button variant="secondary" disabled={command.isPending} onClick={() => setConfirm(false)}>Отмена</Button>
        <Button loading={command.isPending} onClick={() => void submit()}>Оформить решения</Button>
      </>}>
      <div className="space-y-4 text-13">
        <p>Приказ № {order} от {formatDate(orderDate)}. Дата решения: {formatDate(effectiveDate)}.</p>
        <ul className="space-y-3">{selected.map(student => {
          const name = query.data?.students?.find(item => item.studentProfileId === student.studentProfileId)?.name;
          const target = query.data?.targets?.find(item => item.classId === student.targetClassId);
          return <li key={student.studentProfileId}><strong>{name}</strong> — {YEAR_DECISION_LABELS[student.decision]}
            {target ? ` · ${target.className} · ${target.academicYearName}` : ''}</li>;
        })}</ul>
        <p className="text-muted">{basis}</p>
        <p className="text-muted">Прежние классы и оценки сохранятся в истории. Проверьте решения и классы до подтверждения.</p>
      </div>
    </Modal>
    {cancelling && <StudentYearDecisionCancellationModal decision={cancelling} onClose={() => setCancelling(null)}
      onSaved={() => { void query.refetch(); onSaved(); }} />}
  </>;
}
