import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { useAddEquipmentUnits, useCreateEquipmentItem } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import type { Schema } from '@/lib/apiSchemas';
import { conflictItem, errorMessage, takenInventoryNumbers } from './equipmentModel';

type UnitDraft = { inventoryNumber: string; serialNumber: string };

const MAX_UNITS = 50;

const emptyUnit: UnitDraft = { inventoryNumber: '', serialNumber: '' };

/**
 * Заведение позиции и добавление экземпляров — одна форма (ТЗ §7.1).
 *
 * <p>Два режима, а не два окна: список экземпляров у них общий, и различаются они ровно
 * шапкой — новое название или уже существующая позиция. Отсюда же переход между режимами
 * на месте: сервер отвечает на занятое название 409 с самой позицией, и правильный
 * следующий шаг — «добавить экземпляры в неё», а не «придумайте другое название той же
 * вещи».
 */
export function EquipmentItemFormModal({
  open,
  onClose,
  existingItem,
  items,
}: {
  open: boolean;
  onClose: () => void;
  /** Задана — форма сразу в режиме «добавить экземпляры». */
  existingItem?: { id: number; name: string } | null;
  items: Schema<'EquipmentItemOptionView'>[];
}) {
  const toast = useToast();
  const createItem = useCreateEquipmentItem();
  const addUnits = useAddEquipmentUnits();

  const [target, setTarget] = useState<{ id: number; name: string } | null>(existingItem ?? null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [units, setUnits] = useState<UnitDraft[]>([{ ...emptyUnit }]);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setTarget(existingItem ?? null);
    setName('');
    setNote('');
    setUnits([{ ...emptyUnit }]);
    setTouched(false);
    setError(null);
    setTaken([]);
  }, [open, existingItem]);

  const pending = createItem.isPending || addUnits.isPending;
  const filled = units.filter((unit) => unit.inventoryNumber.trim().length > 0);
  const nameValid = target != null || name.trim().length > 0;
  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const repeated = new Set<string>();
    for (const unit of filled) {
      const key = unit.inventoryNumber.trim().toLowerCase();
      if (seen.has(key)) repeated.add(key);
      seen.add(key);
    }
    return repeated;
  }, [filled]);

  function patchUnit(index: number, patch: Partial<UnitDraft>) {
    setUnits((current) => current.map((unit, i) => (i === index ? { ...unit, ...patch } : unit)));
    setTaken([]);
  }

  async function submit() {
    setTouched(true);
    setError(null);
    if (!nameValid || filled.length === 0 || duplicates.size > 0) return;

    const payload = filled.map((unit) => ({
      inventoryNumber: unit.inventoryNumber.trim(),
      serialNumber: unit.serialNumber.trim() || undefined,
    }));

    try {
      if (target) {
        await addUnits.mutateAsync({ itemId: target.id, body: { units: payload } });
        toast.success(
          payload.length === 1 ? 'Экземпляр добавлен' : `Добавлено экземпляров: ${payload.length}`,
        );
      } else {
        await createItem.mutateAsync({
          name: name.trim(),
          note: note.trim() || undefined,
          units: payload,
        });
        toast.success('Позиция добавлена');
      }
      onClose();
    } catch (err) {
      const existing = conflictItem(err);
      if (existing) {
        // Не ошибка ввода, а развилка: та же вещь уже заведена, и экземпляры добавляют в неё.
        setTarget({ id: existing.itemId, name: existing.name });
        setError(`Позиция «${existing.name}» уже есть — экземпляры добавятся в неё`);
        return;
      }
      setTaken(takenInventoryNumbers(err));
      setError(errorMessage(err, 'Не удалось сохранить'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={pending ? () => undefined : onClose}
      title={target ? 'Добавить экземпляры' : 'Новая позиция'}
      subtitle={
        target
          ? target.name
          : 'Название техники и её физические экземпляры — по одному на инвентарный номер'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={pending}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <NoticeBar tone="warning">{error}</NoticeBar>}

        {target ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-600">
              Позиция: <strong className="text-slate-800">{target.name}</strong>
            </span>
            {!existingItem && (
              <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>
                Завести новую
              </Button>
            )}
          </div>
        ) : (
          <>
            <Field
              label="Название позиции"
              required
              hint="Например: Ноутбук Lenovo ThinkPad"
              error={touched && !nameValid ? 'Укажите название' : undefined}
            >
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                placeholder="Ноутбук Lenovo ThinkPad"
                error={touched && !nameValid}
                list="equipment-item-names"
              />
              {/* Подсказка существующими названиями: вторую позицию с тем же именем
                  сервер не заведёт, и узнать об этом лучше до отправки. */}
              <datalist id="equipment-item-names">
                {items.map((item) => (
                  <option key={item.id} value={item.name ?? ''} />
                ))}
              </datalist>
            </Field>
            <Field label="Примечание" hint="Кабинет, комплектация, всё, что важно помнить">
              <TextArea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            </Field>
          </>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="label-base mb-0">Экземпляры</span>
            <span className="text-xs text-slate-400">
              {filled.length} из {MAX_UNITS}
            </span>
          </div>

          {units.map((unit, index) => {
            const number = unit.inventoryNumber.trim();
            const isTaken = taken.some((value) => value.toLowerCase() === number.toLowerCase());
            const isDuplicate = duplicates.has(number.toLowerCase());
            return (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-1">
                  <TextInput
                    value={unit.inventoryNumber}
                    onChange={(e) => patchUnit(index, { inventoryNumber: e.target.value })}
                    placeholder="Инвентарный номер"
                    maxLength={100}
                    error={isTaken || isDuplicate}
                    aria-label={`Инвентарный номер экземпляра ${index + 1}`}
                  />
                  {(isTaken || isDuplicate) && (
                    <p className="mt-1 text-xs text-red-500">
                      {isTaken ? 'Номер уже занят другой техникой' : 'Номер повторяется в списке'}
                    </p>
                  )}
                </div>
                <TextInput
                  value={unit.serialNumber}
                  onChange={(e) => patchUnit(index, { serialNumber: e.target.value })}
                  placeholder="Серийный номер (необязательно)"
                  maxLength={100}
                  className="flex-1"
                  aria-label={`Серийный номер экземпляра ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => setUnits((current) => current.filter((_, i) => i !== index))}
                  disabled={units.length === 1}
                  className="mt-2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                  aria-label={`Убрать экземпляр ${index + 1}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          {touched && filled.length === 0 && (
            <p className="text-xs text-red-500">Добавьте хотя бы один инвентарный номер</p>
          )}

          {units.length < MAX_UNITS && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setUnits((current) => [...current, { ...emptyUnit }])}
            >
              Ещё экземпляр
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
