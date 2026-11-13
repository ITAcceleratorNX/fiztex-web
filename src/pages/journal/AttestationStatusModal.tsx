import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea } from '@/components/ui/Field';
import { FilterChip } from '@/components/ui/FilterChip';
import { Modal } from '@/components/ui/Modal';
import { useSaveAttestationStatus } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import {
  ATTESTATION_HINT,
  ATTESTATION_SHORT,
  decidedResult,
  familySees,
  FREQUENT_REASONS,
  fullResultLabel,
  isAttestationStatus,
  REASON_MAX,
  reasonProblem,
  type ResultValue,
} from '@/lib/attestationModel';
import { FINAL_RESULT_LABELS } from '@/lib/finalGradeResult';
import type { ClassFinalGradeRow } from '@/lib/gradebookApi';

export type AttestationAuthor = 'TEACHER' | 'ADMINISTRATION';

/**
 * Окно статуса ВНА/НА (ATTESTATION-001, ТЗ-2 §3): ученик, что было и что будет, расшифровка
 * статуса, частые причины и обязательная «Причина».
 *
 * Одно окно на три действия, которые сервер считает одним — «изменение со статусом»:
 * поставить или сменить статус, снять его числом, отменить изменение, ждущее подтверждения.
 * Права и допустимость решает сервер; окно показывает его отказ как есть и не делает вид,
 * что сохранило.
 *
 * Макета у окна нет (вопрос В1 разбора): собрано из DS по образцу окна исправления СОЧ.
 */
export function AttestationStatusModal({
  row,
  target,
  author,
  subjectId,
  academicPeriodId,
  onClose,
}: {
  row: ClassFinalGradeRow;
  /** Что выбрано в ячейке: статус либо число, снимающее статус. */
  target: ResultValue;
  author: AttestationAuthor;
  subjectId: number;
  academicPeriodId: number;
  onClose: () => void;
}) {
  const save = useSaveAttestationStatus();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grade = row.finalGrade ?? null;
  const decided = decidedResult(grade);
  const family = familySees(grade);
  const discarding = Boolean(grade?.pendingChange)
    && target.kind === (grade?.resultKind ?? 'NUMERIC')
    && target.value === (grade?.value ?? null);
  const settingStatus = isAttestationStatus(target.kind) && !discarding;
  const problem = reasonProblem(reason);

  const title = discarding
    ? 'Отменить изменение'
    : settingStatus
      ? `${FINAL_RESULT_LABELS[target.kind]} (${ATTESTATION_SHORT[target.kind as keyof typeof ATTESTATION_SHORT]})`
      : 'Снять статус';
  const saveLabel = discarding ? 'Отменить изменение' : settingStatus ? 'Сохранить статус' : 'Снять статус';

  async function submit() {
    setTouched(true);
    if (problem) return;
    setError(null);
    try {
      await save.mutateAsync({
        author,
        finalGrade: grade,
        studentProfileId: row.studentProfileId as number,
        subjectId,
        academicPeriodId,
        resultKind: target.kind,
        value: target.value,
        reason: reason.trim(),
      });
      onClose();
    } catch (failure) {
      setError(saveErrorText(failure));
    }
  }

  return (
    <Modal
      open
      title={title}
      subtitle={row.studentName ?? undefined}
      onClose={() => { if (!save.isPending) onClose(); }}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={save.isPending} onClick={onClose}>Отмена</Button>
          <Button loading={save.isPending} disabled={touched && problem != null} onClick={() => void submit()}>
            {saveLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-2 text-13">
          <span className="text-muted">Сейчас:</span>
          <span className="font-semibold text-ink">{decided ? fullResultLabel(decided) : 'итога нет'}</span>
          <ArrowRight className="size-4 text-slate-400" aria-hidden />
          <span className="text-muted">будет:</span>
          <span className="font-semibold text-ink">{fullResultLabel(target)}</span>
        </p>

        {settingStatus && (
          <p className="rounded-lg bg-info-bg p-3 text-13 text-info-fg">
            {ATTESTATION_HINT[target.kind as keyof typeof ATTESTATION_HINT]}
          </p>
        )}

        {family && (
          <p className="text-13 text-muted">
            {discarding
              ? `Итог вернётся к опубликованному: «${fullResultLabel(family)}». Повторная публикация не понадобится.`
              : `Итог опубликован. Ученик и родитель продолжат видеть «${fullResultLabel(family)}», пока ${
                  author === 'TEACHER' ? 'вы не подтвердите изменение' : 'учитель не подтвердит изменение'
                }.`}
          </p>
        )}

        {settingStatus && (
          <div className="flex flex-col gap-2">
            <span className="text-13 font-semibold text-ink">Частые причины</span>
            <div className="flex flex-wrap gap-2">
              {FREQUENT_REASONS.map((item) => (
                <FilterChip
                  key={item}
                  appearance="outline"
                  label={item}
                  selected={reason.trim() === item}
                  onClick={() => { setReason(item); setTouched(true); }}
                />
              ))}
            </div>
          </div>
        )}

        <Field label="Причина" required error={touched ? problem ?? undefined : undefined}>
          <TextArea
            value={reason}
            maxLength={REASON_MAX}
            rows={3}
            disabled={save.isPending}
            placeholder="Почему меняется итог — увидят учитель и администрация в истории"
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
          />
        </Field>

        {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
      </div>
    </Modal>
  );
}

/**
 * Отказ сервера словами: конфликт версий — отдельно, потому что действие пользователя другое
 * («обновите и проверьте»), а не «попробуйте ещё раз». Журнал перечитывается сам.
 */
function saveErrorText(failure: unknown): string {
  if (failure instanceof ApiError) {
    if (failure.code === 'FINAL_GRADE_VERSION_CHANGED') {
      return 'Итог изменили, пока окно было открыто. Журнал обновлён — закройте окно и проверьте значение.';
    }
    return failure.message;
  }
  if (failure instanceof Error && failure.message) return failure.message;
  return 'Не удалось сохранить. Проверьте подключение к интернету и попробуйте ещё раз.';
}
