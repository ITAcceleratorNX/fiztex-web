import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { LoadingBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useCorrectFinalGrade, useFinalGradeHistory } from '@/hooks/queries';
import type { FinalGrade } from '@/lib/gradebookApi';
import { FINAL_RESULT_LABELS, finalResultLabel } from '@/lib/finalGradeResult';
import { ApiError } from '@/lib/api';

export function FinalGradeCorrectionModal({ grade, studentName, allowedKinds, onClose }: {
  grade: FinalGrade; studentName: string; allowedKinds: NonNullable<FinalGrade['resultKind']>[]; onClose: () => void;
}) {
  const correction = useCorrectFinalGrade();
  const [kind, setKind] = useState(grade.resultKind ?? 'NUMERIC');
  const [value, setValue] = useState(String(grade.value ?? 4));
  const [reason, setReason] = useState('');
  const [document, setDocument] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setError(null);
    if (grade.id == null || grade.version == null) { setError('Обновите журнал перед исправлением итога'); return; }
    try {
      await correction.mutateAsync({ id: grade.id!, body: { value: kind === 'NUMERIC' ? Number(value) : undefined,
        resultKind: kind, reason: reason.trim(), documentReference: document.trim(), expectedVersion: grade.version } });
      onClose();
    } catch (failure) { setError(failure instanceof ApiError ? failure.message : 'Не удалось сохранить исправление'); }
  }
  return <Modal open onClose={() => { if (!correction.isPending) onClose(); }} title="Исправление технической ошибки" subtitle={studentName}
    footer={<div className="flex justify-end gap-3"><Button variant="secondary" disabled={correction.isPending} onClick={onClose}>Отмена</Button>
      <Button loading={correction.isPending} disabled={reason.trim().length < 5 || document.trim().length < 5} onClick={() => void save()}>Подтвердить исправление</Button></div>}>
    <div className="flex flex-col gap-4"><p className="text-13 text-muted">Сейчас опубликовано: {finalResultLabel(grade)}. Исправление допустимо по подтверждающим документам и протоколу. Прежнее значение, причина и автор сохранятся в истории.</p>
      <Field label="Исправленный результат"><Select value={kind} onChange={event => setKind(event.target.value as NonNullable<FinalGrade['resultKind']>)} disabled={correction.isPending}>
        {allowedKinds.map(item => <option key={item} value={item}>{FINAL_RESULT_LABELS[item]}</option>)}
      </Select></Field>
      {kind === 'NUMERIC' && <Field label="Оценка"><Select value={value} disabled={correction.isPending} onChange={event => setValue(event.target.value)}>{[2, 3, 4, 5].map(item => <option key={item} value={item}>{item}</option>)}</Select></Field>}
      <Field label="Описание технической ошибки"><TextArea value={reason} onChange={event => setReason(event.target.value)} disabled={correction.isPending} maxLength={1000} /></Field>
      <Field label="Подтверждающий документ и протокол"><TextInput value={document} onChange={event => setDocument(event.target.value)} disabled={correction.isPending} maxLength={1000} placeholder="Номер и дата протокола, подтверждающие документы" /></Field>
      {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
    </div>
  </Modal>;
}

export function FinalGradeHistoryModal({ id, studentName, onClose }: { id: number; studentName: string; onClose: () => void }) {
  const history = useFinalGradeHistory(id);
  return <Modal open title="История итоговой оценки" subtitle={studentName} onClose={onClose}>
    {history.isPending ? <LoadingBlock /> : history.isError ? <ErrorBlock message="Не удалось загрузить историю итога" onRetry={() => void history.refetch()} /> : <ol className="space-y-4">
      {history.data?.map(event => {
        const before = event.before as { value?: number; resultKind?: NonNullable<FinalGrade['resultKind']> } | undefined;
        const after = event.after as { value?: number; resultKind?: NonNullable<FinalGrade['resultKind']>; resultReason?: string; correctionReference?: string } | undefined;
        const label = (result: typeof before) => result ? finalResultLabel(result) : '—';
        return <li key={event.id} className="border-b border-line pb-3 text-13"><p className="font-semibold">{event.action === 'CREATE' ? 'Создание' : event.action === 'PUBLISH' ? 'Публикация' : 'Изменение'}: {label(before)} → {label(after)}</p>
          {after?.resultReason && <p>{after.resultReason}</p>}{after?.correctionReference && <p>Документы: {after.correctionReference}</p>}
          <p className="text-muted">{event.actorName ?? 'Сотрудник школы'} · {event.createdAt ? new Date(event.createdAt).toLocaleString('ru-RU') : ''}</p>
        </li>;
      })}
    </ol>}
  </Modal>;
}
