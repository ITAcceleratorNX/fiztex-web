import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { LoadingBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useCorrectFinalGrade, useFinalGradeHistory, useRepublishFinalGrade } from '@/hooks/queries';
import type { FinalGrade } from '@/lib/gradebookApi';
import { FINAL_RESULT_LABELS, finalResultLabel } from '@/lib/finalGradeResult';
import {
  authorLabel,
  decidedResult,
  fullResultLabel,
  historyEventNote,
  historyEventTitle,
  type FinalGradeHistoryEvent,
} from '@/lib/attestationModel';
import { ApiError } from '@/lib/api';

export function FinalGradeCorrectionModal({ grade, studentName, allowedKinds, allowedValues, onClose }: {
  grade: FinalGrade; studentName: string; allowedKinds: NonNullable<FinalGrade['resultKind']>[];
  /** Допустимые итоги из ответа экрана (`allowedValues`): пороги политики либо 2…5. */
  allowedValues: number[];
  onClose: () => void;
}) {
  const correction = useCorrectFinalGrade();
  const [kind, setKind] = useState(grade.resultKind ?? 'NUMERIC');
  const [value, setValue] = useState(String(grade.value ?? allowedValues.at(-1) ?? ''));
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
      {kind === 'NUMERIC' && <Field label="Оценка"><Select value={value} disabled={correction.isPending} onChange={event => setValue(event.target.value)}>{allowedValues.map(item => <option key={item} value={item}>{item}</option>)}</Select></Field>}
      <Field label="Описание технической ошибки"><TextArea value={reason} onChange={event => setReason(event.target.value)} disabled={correction.isPending} maxLength={1000} /></Field>
      <Field label="Подтверждающий документ и протокол"><TextInput value={document} onChange={event => setDocument(event.target.value)} disabled={correction.isPending} maxLength={1000} placeholder="Номер и дата протокола, подтверждающие документы" /></Field>
      {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
    </div>
  </Modal>;
}

/**
 * История итога (ТЗ-2 §4): цепочка «было → стало», причина, автор с ролью, дата и время,
 * публикации и изменения, ждущие подтверждения. Слова событий — `attestationModel`; у
 * записей до ATTESTATION-001 причины действия нет — вместо неё основание из снимка.
 */
export function FinalGradeHistoryModal({ id, studentName, onClose }: { id: number; studentName: string; onClose: () => void }) {
  const history = useFinalGradeHistory(id);
  return <Modal open title="История итоговой оценки" subtitle={studentName} onClose={onClose}>
    {history.isPending ? <LoadingBlock /> : history.isError
      ? <ErrorBlock message="Не удалось загрузить историю итога" onRetry={() => void history.refetch()} />
      : !history.data?.length
        ? <p className="text-13 text-muted">Событий пока нет</p>
        : <ol className="flex flex-col gap-4">{history.data.map((event) => <HistoryEvent key={event.id} event={event} />)}</ol>}
  </Modal>;
}

function HistoryEvent({ event }: { event: FinalGradeHistoryEvent }) {
  const after = (event.after ?? null) as { resultReason?: string | null; correctionReference?: string | null } | null;
  // Записи до V144 причины действия не знают: у создания и правки показать хотя бы основание
  // результата. У публикаций оно лишь повторяло бы основание предыдущего события.
  const basis = !event.reason && (event.action === 'CREATE' || event.action === 'UPDATE') && after?.resultReason
    ? after.resultReason
    : null;
  const note = historyEventNote(event);
  const dot = event.action === 'PUBLISH' || event.action === 'REPUBLISH'
    ? 'bg-green-500'
    : event.action === 'PENDING_CHANGE' ? 'bg-amber-500' : 'bg-slate-300';
  return <li className="flex gap-3 text-13">
    <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${dot}`} />
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="font-semibold text-ink">{historyEventTitle(event)}</p>
      {event.reason && <p className="text-slate-700"><span className="text-muted">Причина: </span>{event.reason}</p>}
      {basis && <p className="text-slate-700"><span className="text-muted">Основание: </span>{basis}</p>}
      {after?.correctionReference && <p className="text-slate-700"><span className="text-muted">Документы: </span>{after.correctionReference}</p>}
      {note && <p className="text-11 text-amber-700">{note}</p>}
      <p className="text-11 text-muted">
        {authorLabel(event.actorName, event.actorRole)}
        {event.createdAt ? ` · ${new Date(event.createdAt).toLocaleString('ru-RU')}` : ''}
      </p>
    </div>
  </li>;
}

/**
 * «Подтвердить и опубликовать повторно». Два повода (контракт §3, §12.3):
 * - изменение ВНА/НА после публикации ждёт подтверждения — публикуется сохранённое, числа
 *   выбирать не нужно (ATTESTATION-001);
 * - опубликованное число, а расчёт после правки баллов изменился (ТЗ №9) — учитель выбирает
 *   значение, по умолчанию рекомендованное.
 * До подтверждения ученик и родитель видят прежнее значение.
 */
export function RepublishFinalModal({ grade, recommended, studentName, options, onClose }: {
  grade: FinalGrade; recommended: number | null; studentName: string; options: number[]; onClose: () => void;
}) {
  const republish = useRepublishFinalGrade();
  const pending = grade.pendingChange ?? null;
  const [value, setValue] = useState(recommended ?? options.at(-1) ?? 0);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setError(null);
    if (grade.id == null || grade.version == null) { setError('Обновите журнал перед подтверждением'); return; }
    try {
      await republish.mutateAsync(pending
        ? { id: grade.id, expectedVersion: grade.version }
        : { id: grade.id, value, expectedVersion: grade.version });
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiError
        ? failure.code === 'FINAL_GRADE_VERSION_CHANGED'
          ? 'Итог изменили, пока окно было открыто. Журнал обновлён — закройте окно и проверьте значение.'
          : failure.message
        : 'Не удалось опубликовать итог повторно');
    }
  }
  return <Modal open onClose={() => { if (!republish.isPending) onClose(); }} title="Подтвердить и опубликовать повторно" subtitle={studentName}
    footer={<div className="flex justify-end gap-3"><Button variant="secondary" disabled={republish.isPending} onClick={onClose}>Отмена</Button>
      <Button loading={republish.isPending} onClick={() => void confirm()}>Подтвердить и опубликовать</Button></div>}>
    {pending ? (
      <div className="flex flex-col gap-4">
        <p className="text-13 text-muted">Сейчас ученик и родитель видят «{finalResultLabel(grade)}». После подтверждения увидят «{fullResultLabel(decidedResult(grade))}». Прежнее и новое значение, автор и время сохранятся в истории.</p>
        <div className="rounded-lg bg-slate-50 p-3 text-13">
          <p><span className="text-muted">Причина изменения: </span>{pending.reason}</p>
          <p className="mt-1 text-muted">{authorLabel(pending.changedByName, pending.changedByRole)}{pending.changedAt ? ` · ${new Date(pending.changedAt).toLocaleString('ru-RU')}` : ''}</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
      </div>
    ) : (
      <div className="flex flex-col gap-4">
        <p className="text-13 text-muted">После правки баллов расчёт изменился. Сейчас ученик и родитель видят {finalResultLabel(grade)}. Новое значение они увидят сразу после подтверждения; прежнее и новое значение, автор и время сохранятся в истории.</p>
        {recommended != null && <p className="text-13">Рекомендация по расчёту: <span className="font-bold">{recommended}</span></p>}
        <Field label="Итоговая оценка"><Select value={String(value)} disabled={republish.isPending} onChange={event => setValue(Number(event.target.value))}>
          {options.map(item => <option key={item} value={item}>{item}</option>)}
        </Select></Field>
        {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
      </div>
    )}
  </Modal>;
}
