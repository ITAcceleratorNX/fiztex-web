import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { useUpdateEquipmentUnit } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { errorMessage, takenInventoryNumbers, type EquipmentUnit } from './equipmentModel';

/**
 * Правка экземпляра (ТЗ §7.1): инвентарный и серийный номер, примечание.
 *
 * <p>Правка не теряет историю: прошлые события хранят снимок номеров, а сама правка
 * попадает в ленту отдельной записью «было → стало».
 */
export function EquipmentUnitFormModal({
  open,
  onClose,
  unit,
}: {
  open: boolean;
  onClose: () => void;
  unit: EquipmentUnit;
}) {
  const toast = useToast();
  const updateUnit = useUpdateEquipmentUnit();

  const [inventoryNumber, setInventoryNumber] = useState(unit.inventoryNumber ?? '');
  const [serialNumber, setSerialNumber] = useState(unit.serialNumber ?? '');
  const [note, setNote] = useState(unit.note ?? '');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInventoryNumber(unit.inventoryNumber ?? '');
    setSerialNumber(unit.serialNumber ?? '');
    setNote(unit.note ?? '');
    setTouched(false);
    setError(null);
    setTaken(false);
  }, [open, unit]);

  const valid = inventoryNumber.trim().length > 0;

  async function submit() {
    setTouched(true);
    setError(null);
    setTaken(false);
    if (!valid) return;
    try {
      await updateUnit.mutateAsync({
        unitId: unit.id!,
        body: {
          inventoryNumber: inventoryNumber.trim(),
          // Пустое поле стирает номер: тело задаёт итоговое состояние всех полей, а не
          // только присланных (контракт §3).
          serialNumber: serialNumber.trim() || undefined,
          note: note.trim() || undefined,
        },
      });
      toast.success('Экземпляр обновлён');
      onClose();
    } catch (err) {
      setTaken(takenInventoryNumbers(err).length > 0);
      setError(errorMessage(err, 'Не удалось сохранить'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={updateUnit.isPending ? () => undefined : onClose}
      title="Изменить экземпляр"
      subtitle={unit.itemName ?? undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={updateUnit.isPending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={updateUnit.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <NoticeBar tone="warning">{error}</NoticeBar>}

        <Field
          label="Инвентарный номер"
          required
          error={
            touched && !valid
              ? 'Укажите инвентарный номер'
              : taken
                ? 'Номер уже занят другой техникой'
                : undefined
          }
        >
          <TextInput
            value={inventoryNumber}
            onChange={(e) => setInventoryNumber(e.target.value)}
            maxLength={100}
            error={(touched && !valid) || taken}
          />
        </Field>

        <Field label="Серийный номер" hint="Необязательно">
          <TextInput
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            maxLength={100}
          />
        </Field>

        <Field label="Примечание">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
        </Field>
      </div>
    </Modal>
  );
}
