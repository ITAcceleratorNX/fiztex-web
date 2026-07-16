import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import {
  useAcademicPeriods,
  useCreateGroupSet,
  useSchoolSubjects,
} from '@/platform/hooks/useSubgroups';

export function CreateGroupSetModal({
  open,
  onClose,
  yearId,
  classId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  yearId: number;
  classId: number;
  onCreated: (setId: number) => void;
}) {
  const toast = useToast();
  const create = useCreateGroupSet(classId);
  const subjectsQuery = useSchoolSubjects();
  const periodsQuery = useAcademicPeriods(yearId);

  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [periodId, setPeriodId] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setSubjectId('');
    setPeriodId('');
  }, [open]);

  const subjects = subjectsQuery.data?.content ?? [];
  const periods = (periodsQuery.data ?? []).filter((p) => p.status === 'ACTIVE');

  async function onSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Укажите название набора');
      return;
    }
    try {
      const created = await create.mutateAsync({
        name: trimmed,
        subjectId: subjectId ? Number(subjectId) : null,
        academicPeriodId: periodId ? Number(periodId) : null,
      });
      toast.success(`Набор «${created.name}» создан`);
      onCreated(created.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать набор');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый набор групп"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Отмена
          </Button>
          <Button onClick={() => void onSubmit()} loading={create.isPending}>
            Создать
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Название" required>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Английский"
            autoFocus
            disabled={create.isPending}
          />
        </Field>
        <Field label="Предмет" hint="Необязательно — набор может быть общим для класса">
          <Select
            value={subjectId}
            disabled={create.isPending || subjectsQuery.isLoading}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">Без предмета</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Период" hint="Необязательно — ограничить набор четвертью/семестром">
          <Select
            value={periodId}
            disabled={create.isPending || periodsQuery.isLoading}
            onChange={(e) => setPeriodId(e.target.value)}
          >
            <option value="">Весь год</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
