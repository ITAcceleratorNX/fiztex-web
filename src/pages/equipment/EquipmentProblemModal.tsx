import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { useSetEquipmentProblem } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/format';
import { EQUIPMENT_PROBLEMS, errorMessage, type EquipmentUnit } from './equipmentModel';

/**
 * Отметить проблему или сменить её тип (ТЗ §6, §7.5).
 *
 * <p>Подсказка у каждого типа говорит не что он значит, а что запрещает: выдачу и передачу
 * останавливает только «Потеряна», и по названию этого не понять. Проверку всё равно делает
 * сервер — здесь она объясняется, а не повторяется.
 */
export function EquipmentProblemModal({
  open,
  onClose,
  unit,
}: {
  open: boolean;
  onClose: () => void;
  unit: EquipmentUnit;
}) {
  const toast = useToast();
  const setProblem = useSetEquipmentProblem();
  const [type, setType] = useState<string>(unit.problem?.type ?? 'DAMAGED');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(unit.problem?.type ?? 'DAMAGED');
    setComment('');
    setError(null);
  }, [open, unit.problem?.type]);

  async function submit() {
    setError(null);
    try {
      await setProblem.mutateAsync({
        unitId: unit.id!,
        body: { type: type as 'DAMAGED', comment: comment.trim() || undefined },
      });
      toast.success(unit.problem ? 'Проблема изменена' : 'Проблема отмечена');
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Не удалось отметить проблему'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={setProblem.isPending ? () => undefined : onClose}
      title={unit.problem ? 'Изменить проблему' : 'Отметить проблему'}
      subtitle={`${unit.itemName ?? ''} · ${unit.inventoryNumber ?? ''}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={setProblem.isPending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={setProblem.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <NoticeBar tone="warning">{error}</NoticeBar>}

        <div className="space-y-2">
          {EQUIPMENT_PROBLEMS.map((problem) => (
            <button
              key={problem.value}
              type="button"
              onClick={() => setType(problem.value)}
              className={cx(
                'flex w-full flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition',
                type === problem.value
                  ? 'border-brand-400 bg-brand-50'
                  : 'border-slate-200 hover:bg-slate-50',
              )}
            >
              <span className="text-sm font-medium text-slate-800">{problem.label}</span>
              <span className="text-xs text-slate-500">{problem.hint}</span>
            </button>
          ))}
        </div>

        <Field label="Комментарий" hint="Что случилось — необязательно">
          <TextArea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
        </Field>
      </div>
    </Modal>
  );
}
