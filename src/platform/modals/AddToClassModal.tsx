import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { addClassMembership, isDuplicateStudentError } from '../services';
import type { ClassMembership, SchoolClass, StudentProfile } from '../types';
import { formatPersonName } from '../types';

export function AddToClassModal({
  open,
  onClose,
  student,
  classes,
  currentMembership,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  classes: SchoolClass[];
  /** Активное членство ученика; определяет, зачисление это или перевод. */
  currentMembership?: ClassMembership | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [classId, setClassId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [needForce, setNeedForce] = useState(false);

  // Текущий класс исключаем: перевод в него же бэкенд отклоняет (MEMBERSHIP_ALREADY_IN_CLASS).
  const options = useMemo(
    () =>
      classes.filter(
        (c) => c.status === 'ACTIVE' && Number(c.id) !== currentMembership?.classId,
      ),
    [classes, currentMembership],
  );

  /**
   * `transfer` нужен только когда активное членство уже есть в том же учебном году —
   * именно в этих границах действует уникальность на бэкенде. Класс другого года
   * зачисляется без перевода, старое членство остаётся активным в своём году.
   */
  const selected = options.find((c) => c.id === classId);
  const isTransfer =
    !!currentMembership &&
    !!selected &&
    String(currentMembership.academicYearId) === selected.academicYearId;

  useEffect(() => {
    if (!open) return;
    setClassId('');
    setError(null);
    setNeedForce(false);
  }, [open, student]);

  async function submit(force: boolean) {
    if (!student) return;
    if (!classId) {
      setError('Выберите класс');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await addClassMembership(student.id, Number(classId), { transfer: isTransfer, force });
      toast.success(isTransfer ? 'Ученик переведён в другой класс' : 'Ученик добавлен в класс');
      onSaved();
      onClose();
    } catch (err) {
      if (isDuplicateStudentError(err) && !force) {
        setNeedForce(true);
        setError('В классе уже есть ученик с похожим ФИО. Подтвердите ещё раз.');
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось сохранить');
      }
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submit(needForce);
  }

  const confirmLabel = needForce ? 'Всё равно' : isTransfer ? 'Перевести' : 'Добавить';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currentMembership ? 'Изменить класс' : 'Добавить в класс'}
      subtitle={
        student
          ? formatPersonName(student.lastName, student.firstName, student.middleName)
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending} disabled={options.length === 0}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {currentMembership && (
          <p className="text-sm text-slate-600">
            Сейчас: <b>{currentMembership.className}</b> ({currentMembership.academicYearName})
          </p>
        )}
        <Field label="Класс" required>
          <Select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setNeedForce(false);
            }}
            required
            disabled={options.length === 0}
          >
            <option value="">
              {options.length === 0 ? 'Нет доступных классов' : 'Выберите класс'}
            </option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.academicYearName})
              </option>
            ))}
          </Select>
        </Field>
        {isTransfer && (
          <p className="text-sm text-slate-600">
            Ученик будет переведён из класса <b>{currentMembership?.className}</b>; прежнее
            членство уйдёт в историю.
          </p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
