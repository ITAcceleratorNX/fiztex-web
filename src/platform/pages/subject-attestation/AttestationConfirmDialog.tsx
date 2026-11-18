import { Button } from '@/components/ui/Button';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { Modal } from '@/components/ui/Modal';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { periodGenitive, type ChangeRow } from '@/lib/subjectAttestationModel';

/**
 * «Сохранить настройку аттестации?» (макет А4 2224:2189): что применяется, к кому и с какого
 * периода, у изменённых параметров — «было: …». Ничего не решает: сервер ещё раз проверит
 * всё при сохранении, и его отказ вернёт администратора в форму с введённым.
 */
export function AttestationConfirmDialog({ open, subtitle, rows, effectiveFromName, busy, onBack, onConfirm }: {
  open: boolean;
  subtitle: string;
  rows: ChangeRow[];
  effectiveFromName: string | null;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      title="Сохранить настройку аттестации?"
      subtitle={subtitle}
      onClose={() => { if (!busy) onBack(); }}
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={onBack}>Назад</Button>
          <Button loading={busy} onClick={onConfirm}>Сохранить</Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-700">Проверьте параметры. После начала периода изменить их будет нельзя.</p>
        <KeyValueList
          rows={rows.map((row) => ({
            key: row.key,
            label: row.label,
            value: (
              <span className="flex flex-col">
                <span className="font-semibold text-ink">{row.value}</span>
                {row.was && <span className="text-13 text-muted">было: {row.was}</span>}
              </span>
            ),
          }))}
        />
        <StatusNotice tone="info">
          Уже выставленные и опубликованные результаты не изменятся.
          {effectiveFromName ? ` Учителя увидят новый формат в журнале с начала ${periodGenitive(effectiveFromName)}.` : ''}
        </StatusNotice>
      </div>
    </Modal>
  );
}
