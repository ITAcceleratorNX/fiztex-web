import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea } from '@/components/ui/Field';
import { FilterChip } from '@/components/ui/FilterChip';
import { Modal } from '@/components/ui/Modal';
import { REASON_MAX, reasonProblem } from '@/lib/attestationModel';

/**
 * Окно основания итога (макеты У4 2224:5513 «Итог отличается от рекомендации» и У6 2224:6523
 * «Итог без рекомендации»): частые причины одним нажатием и поле причины. Сохранить нельзя, пока
 * причины нет; окончательно решает сервер — его отказ остаётся в окне, введённое не теряется.
 */
export function DeviationReasonModal({ title, subtitle, reasons, placeholder, busy, error, onCancel, onSave }: {
  title: string;
  subtitle: string;
  reasons: readonly string[];
  placeholder: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const problem = reasonProblem(reason);
  return (
    <Modal
      open
      title={title}
      subtitle={subtitle}
      onClose={() => { if (!busy) onCancel(); }}
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>Отмена</Button>
          <Button loading={busy} disabled={problem != null} onClick={() => onSave(reason.trim())}>Сохранить</Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-13 font-semibold text-ink">Частые причины</span>
          <div className="flex flex-wrap gap-2">
            {reasons.map((item) => (
              <FilterChip key={item} appearance="outline" label={item} selected={reason.trim() === item}
                onClick={() => setReason(item)} />
            ))}
          </div>
        </div>
        <Field label="Причина" hint="Причина сохранится в истории итога">
          <TextArea value={reason} maxLength={REASON_MAX} disabled={busy} placeholder={placeholder}
            onChange={(event) => setReason(event.target.value)} />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
      </div>
    </Modal>
  );
}
