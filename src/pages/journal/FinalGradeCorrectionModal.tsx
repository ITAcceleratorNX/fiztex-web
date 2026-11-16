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
  historyEventAuthor,
  historyEventTitle,
  historySnapshot,
  isTechnicalCorrection,
  type FinalGradeHistoryEvent,
  type ResultKind,
} from '@/lib/attestationModel';
import { ApiError } from '@/lib/api';
import { saveErrorText } from './AttestationStatusModal';

/**
 * Исправление технической ошибки администрацией (макет А1 2209:5322): опубликованный итог —
 * число, «Временно не аттестован», «Не аттестован» — меняется сразу, по документу и протоколу.
 * «Исправленный результат» — один список: оценки шкалы и особые результаты, как в макете.
 */
export function FinalGradeCorrectionModal({ grade, studentName, allowedKinds, allowedValues, onClose }: {
  grade: FinalGrade; studentName: string; allowedKinds: ResultKind[];
  /** Допустимые итоги из ответа экрана (`allowedValues`): пороги политики либо 2…5. */
  allowedValues: number[];
  onClose: () => void;
}) {
  const correction = useCorrectFinalGrade();
  const options = [
    ...(allowedKinds.includes('NUMERIC') ? allowedValues.map((value) => ({ key: `N${value}`, label: String(value), kind: 'NUMERIC' as ResultKind, value })) : []),
    ...allowedKinds.filter((kind) => kind !== 'NUMERIC')
      .map((kind) => ({ key: kind, label: FINAL_RESULT_LABELS[kind], kind, value: null as number | null })),
  ];
  const currentKey = grade.resultKind && grade.resultKind !== 'NUMERIC' ? grade.resultKind : `N${grade.value ?? ''}`;
  const [choice, setChoice] = useState(options.some((option) => option.key === currentKey) ? currentKey : options[0]?.key ?? '');
  const [reason, setReason] = useState('');
  const [document, setDocument] = useState('');
  const [error, setError] = useState<string | null>(null);
  const picked = options.find((option) => option.key === choice);

  async function save() {
    setError(null);
    if (grade.id == null || grade.version == null || !picked) { setError('Обновите журнал перед исправлением итога'); return; }
    try {
      await correction.mutateAsync({ id: grade.id, body: { value: picked.value ?? undefined, resultKind: picked.kind,
        reason: reason.trim(), documentReference: document.trim(), expectedVersion: grade.version } });
      onClose();
    } catch (failure) { setError(saveErrorText(failure)); }
  }

  return (
    <Modal open onClose={() => { if (!correction.isPending) onClose(); }} title="Исправление технической ошибки" subtitle={studentName}
      footer={<div className="flex justify-end gap-3">
        <Button variant="ghost" disabled={correction.isPending} onClick={onClose}>Отмена</Button>
        <Button loading={correction.isPending} disabled={reason.trim().length < 5 || document.trim().length < 5 || !picked}
          onClick={() => void save()}>Подтвердить исправление</Button>
      </div>}>
      <div className="flex flex-col gap-4">
        <p className="text-13 text-muted">
          Сейчас опубликовано: {finalResultLabel(grade)}. Исправление допустимо по подтверждающим документам и протоколу.
          Прежнее значение, причина и автор сохранятся в истории.
        </p>
        <Field label="Исправленный результат">
          <Select value={choice} disabled={correction.isPending} onChange={(event) => setChoice(event.target.value)}>
            {options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </Select>
        </Field>
        <Field label="Описание технической ошибки">
          <TextArea value={reason} rows={3} maxLength={1000} disabled={correction.isPending} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <Field label="Подтверждающий документ и протокол">
          <TextInput value={document} maxLength={1000} disabled={correction.isPending}
            placeholder="Номер и дата протокола, подтверждающие документы" onChange={(event) => setDocument(event.target.value)} />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
      </div>
    </Modal>
  );
}

/**
 * История итоговой оценки (макет Т7 2209:3481, А2 2209:5780): новое сверху, «было → стало»,
 * причина, кто и когда. У техисправления — документ и протокол.
 */
export function FinalGradeHistoryModal({ id, studentName, onClose }: { id: number; studentName: string; onClose: () => void }) {
  const history = useFinalGradeHistory(id);
  const events = [...(history.data ?? [])].reverse();
  return (
    <Modal open title="История итоговой оценки" subtitle={studentName} onClose={onClose}>
      {history.isPending ? <LoadingBlock /> : history.isError
        ? <ErrorBlock message="Не удалось загрузить историю итога" onRetry={() => void history.refetch()} />
        : events.length === 0
          ? <p className="text-13 text-muted">Событий пока нет</p>
          : <ol className="flex flex-col">{events.map((event) => <HistoryEvent key={event.id} event={event} />)}</ol>}
    </Modal>
  );
}

function HistoryEvent({ event }: { event: FinalGradeHistoryEvent }) {
  const after = historySnapshot(event.after);
  // Записи до ATTESTATION-001 причины действия не знают: у создания и правки показать хотя бы
  // основание результата. У публикаций оно лишь повторяло бы основание предыдущего события.
  const basis = !event.reason && (event.action === 'CREATE' || event.action === 'UPDATE') ? after?.resultReason : null;
  return (
    <li className="flex flex-col gap-0.5 border-b border-slate-200 py-4 text-13 first:pt-0 last:border-b-0">
      <p className="font-semibold text-ink">{historyEventTitle(event)}</p>
      {(event.reason || basis) && <p className="text-slate-700">Причина: {event.reason ?? basis}</p>}
      {isTechnicalCorrection(event) && <p className="text-slate-700">Документ: {after?.correctionReference}</p>}
      <p className="text-muted">{historyEventAuthor(event)}</p>
    </li>
  );
}

/**
 * «Подтвердить и опубликовать повторно» (ТЗ №9): опубликованное число, а расчёт после правки
 * баллов изменился — учитель выбирает значение, по умолчанию рекомендованное. До подтверждения
 * ученик и родитель видят прежнее значение.
 */
export function RepublishFinalModal({ grade, recommended, studentName, options, onClose }: {
  grade: FinalGrade; recommended: number | null; studentName: string; options: number[]; onClose: () => void;
}) {
  const republish = useRepublishFinalGrade();
  const [value, setValue] = useState(recommended ?? options.at(-1) ?? 0);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setError(null);
    if (grade.id == null || grade.version == null) { setError('Обновите журнал перед подтверждением'); return; }
    try {
      await republish.mutateAsync({ id: grade.id, value, expectedVersion: grade.version });
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiError ? saveErrorText(failure) : 'Не удалось опубликовать итог повторно');
    }
  }
  return (
    <Modal open onClose={() => { if (!republish.isPending) onClose(); }} title="Подтвердить и опубликовать повторно" subtitle={studentName}
      footer={<div className="flex justify-end gap-3">
        <Button variant="ghost" disabled={republish.isPending} onClick={onClose}>Отмена</Button>
        <Button loading={republish.isPending} onClick={() => void confirm()}>Подтвердить и опубликовать</Button>
      </div>}>
      <div className="flex flex-col gap-4">
        <p className="text-13 text-muted">После правки баллов расчёт изменился. Сейчас ученик и родитель видят {finalResultLabel(grade)}. Новое значение они увидят сразу после подтверждения; прежнее и новое значение, автор и время сохранятся в истории.</p>
        {recommended != null && <p className="text-13">Рекомендация по расчёту: <span className="font-bold">{recommended}</span></p>}
        <Field label="Итоговая оценка">
          <Select value={String(value)} disabled={republish.isPending} onChange={(event) => setValue(Number(event.target.value))}>
            {options.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </Field>
        {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
      </div>
    </Modal>
  );
}
