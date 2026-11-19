import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { FilterChip } from '@/components/ui/FilterChip';
import { Modal } from '@/components/ui/Modal';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { useSetFinalGrade } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import {
  currentResult,
  FREQUENT_REASONS,
  fullResultLabel,
  REASON_MAX,
  REASON_PLACEHOLDER,
  reasonProblem,
  type AttestationKind,
  type ResultKind,
  type ResultValue,
} from '@/lib/attestationModel';
import { FINAL_RESULT_LABELS } from '@/lib/finalGradeResult';
import type { ClassFinalGradeRow } from '@/lib/gradebookApi';

/**
 * Где стоит итог. `confirm` — у предмета с «Итоговой аттестацией по предметам» выбор и есть
 * подтверждение к публикации: причина статуса или изменения служит и основанием отличия от
 * рекомендации (сервер проверит, нужно ли оно).
 */
type Placement = { subjectId: number; academicPeriodId: number; confirm?: boolean };

/**
 * Окно статуса (макет Т2 2209:672, Т3 2209:1153): «Временно не аттестован» или «Не аттестован»,
 * частые причины и обязательная причина. Сохранить нельзя, пока причины нет, — кнопка
 * неактивна, как в макете; окончательно решает сервер, его отказ показывается как есть.
 */
export function AttestationStatusModal({
  row,
  kind,
  placement,
  onClose,
}: {
  row: ClassFinalGradeRow;
  kind: AttestationKind;
  placement: Placement;
  onClose: () => void;
}) {
  const save = useSaveResult(row, placement);
  const [reason, setReason] = useState('');
  const problem = reasonProblem(reason);

  return (
    <Modal
      open
      title={FINAL_RESULT_LABELS[kind]}
      subtitle={row.studentName ?? undefined}
      onClose={() => { if (!save.pending) onClose(); }}
      footer={<ModalActions busy={save.pending} disabled={problem != null} onCancel={onClose}
        onSave={() => void save.run({ kind, value: null }, reason).then((ok) => ok && onClose())} />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-13 font-semibold text-ink">Частые причины</span>
          <div className="flex flex-wrap gap-2">
            {FREQUENT_REASONS[kind].map((item) => (
              <FilterChip
                key={item}
                appearance="outline"
                label={item}
                selected={reason.trim() === item}
                onClick={() => setReason(item)}
              />
            ))}
          </div>
        </div>
        <ReasonField label="Причина" value={reason} disabled={save.pending} onChange={setReason}
          placeholder={REASON_PLACEHOLDER} hint="Причина сохранится в истории итога" />
        {save.error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{save.error}</p>}
      </div>
    </Modal>
  );
}

/**
 * «Изменить итог» (макет Т4 2209:1631, Т6 2209:3013): что стоит сейчас — со статусом и пометкой
 * «ОПУБЛ.», новый итог из присланных вариантов и причина. Варианты считает сервер: у
 * опубликованного ВНА — только положительные оценки (`positiveValues`), у черновика — вся шкала и
 * особые результаты («Не изучался»).
 */
export function ChangeFinalResultModal({
  row,
  values,
  otherKinds = [],
  initial,
  placement,
  onClose,
}: {
  row: ClassFinalGradeRow;
  values: readonly number[];
  /** Особые результаты без числа («Не изучался», зачёт) — только у черновика. */
  otherKinds?: readonly ResultKind[];
  /** Что выбрано заранее — оценка, по которой нажали в ряду. */
  initial?: ResultValue | null;
  placement: Placement;
  onClose: () => void;
}) {
  const save = useSaveResult(row, placement);
  const current = currentResult(row.finalGrade);
  const [target, setTarget] = useState<ResultValue | null>(initial ?? null);
  const [reason, setReason] = useState('');
  const problem = target == null ? 'Выберите новый итог' : reasonProblem(reason);
  const options = [
    ...values.map((value) => ({ value: `N${value}`, label: String(value), result: { kind: 'NUMERIC' as ResultKind, value } })),
    ...otherKinds.map((kind) => ({ value: kind, label: FINAL_RESULT_LABELS[kind], result: { kind, value: null } })),
  ];
  const selected = options.find((option) =>
    option.result.kind === target?.kind && option.result.value === target?.value)?.value ?? null;

  return (
    <Modal
      open
      title="Изменить итог"
      subtitle={row.studentName ?? undefined}
      onClose={() => { if (!save.pending) onClose(); }}
      footer={<ModalActions busy={save.pending} disabled={problem != null} onCancel={onClose}
        onSave={() => { if (target) void save.run(target, reason).then((ok) => ok && onClose()); }} />}
    >
      <div className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-2 text-13">
          <span className="text-muted">Сейчас:</span>
          <ResultChip result={current} />
          {row.finalGrade?.status === 'PUBLISHED' && <Badge appearance="label" tone="green">ОПУБЛ.</Badge>}
        </p>
        <div className="flex flex-col gap-2">
          <span className="text-13 font-semibold text-ink">Новый итог</span>
          <SegmentedChoice
            appearance="separate"
            ariaLabel="Новый итог"
            options={options.map(({ value, label }) => ({ value, label }))}
            selected={selected}
            onChoose={(value) => setTarget(options.find((option) => option.value === value)?.result ?? null)}
            disabled={save.pending}
          />
        </div>
        <ReasonField label="Причина изменения" value={reason} disabled={save.pending} onChange={setReason}
          hint="Прежний итог, новый итог и причина сохранятся в истории" />
        {save.error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{save.error}</p>}
      </div>
    </Modal>
  );
}

/** «Временно не аттестован» оранжевой плашкой, «Не аттестован» — красной, число — серой. */
function ResultChip({ result }: { result: ResultValue | null }) {
  if (!result) return <Badge appearance="label" tone="gray">итога нет</Badge>;
  const tone = result.kind === 'TEMP_UNATTESTED' ? 'amber' : result.kind === 'NOT_ATTESTED' ? 'red' : 'gray';
  return <Badge appearance="label" tone={tone}>{fullResultLabel(result)}</Badge>;
}

function ReasonField({ label, value, onChange, disabled, placeholder, hint }: {
  label: string; value: string; onChange: (value: string) => void; disabled: boolean; placeholder?: string; hint: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <TextInput value={value} maxLength={REASON_MAX} disabled={disabled} placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function ModalActions({ busy, disabled, onCancel, onSave }: {
  busy: boolean; disabled: boolean; onCancel: () => void; onSave: () => void;
}) {
  return (
    <div className="flex justify-end gap-3">
      <Button variant="ghost" disabled={busy} onClick={onCancel}>Отмена</Button>
      <Button loading={busy} disabled={disabled} onClick={onSave}>Сохранить</Button>
    </div>
  );
}

/**
 * Сохранение из окна: итога нет — создаётся, есть — меняется с версией, которую видел учитель.
 * Отказ остаётся в окне: окно не делает вид, что сохранило.
 */
function useSaveResult(row: ClassFinalGradeRow, placement: Placement) {
  const setFinal = useSetFinalGrade();
  const [error, setError] = useState<string | null>(null);
  const grade = row.finalGrade ?? null;

  async function run(target: ResultValue, reason: string): Promise<boolean> {
    setError(null);
    if (grade?.id != null && grade.version == null) {
      setError('Обновите журнал перед изменением итога');
      return false;
    }
    try {
      await setFinal.mutateAsync({
        finalGradeId: grade?.id ?? null,
        studentProfileId: row.studentProfileId as number,
        subjectId: placement.subjectId,
        academicPeriodId: placement.academicPeriodId,
        value: target.kind === 'NUMERIC' ? target.value : null,
        resultKind: target.kind,
        resultReason: reason.trim(),
        expectedVersion: grade?.version,
        confirm: placement.confirm,
        confirmationReason: placement.confirm ? reason.trim() : undefined,
      });
      return true;
    } catch (failure) {
      setError(saveErrorText(failure));
      return false;
    }
  }

  return { run, pending: setFinal.isPending, error };
}

/**
 * Отказ сервера словами: конфликт версий — отдельно, потому что действие пользователя другое
 * («обновите и проверьте»), а не «попробуйте ещё раз». Журнал перечитывается сам.
 */
export function saveErrorText(failure: unknown): string {
  if (failure instanceof ApiError) {
    if (failure.code === 'FINAL_GRADE_VERSION_CHANGED') {
      return 'Итог изменили, пока окно было открыто. Журнал обновлён — закройте окно и проверьте значение.';
    }
    return failure.message;
  }
  if (failure instanceof Error && failure.message) return failure.message;
  return 'Не удалось сохранить. Проверьте подключение к интернету и попробуйте ещё раз.';
}

