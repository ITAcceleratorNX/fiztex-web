import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { pluralRu } from '@/lib/format';
import { autoSplitSizes, defaultAutoSplitNames } from './subgroupHelpers';

export function AutoSplitDialog({
  open,
  studentCount,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  studentCount: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (names: { firstName: string; secondName: string }) => void;
}) {
  const [firstName, setFirstName] = useState('Группа 1');
  const [secondName, setSecondName] = useState('Группа 2');
  const sizes = autoSplitSizes(studentCount, 2);

  useEffect(() => {
    if (!open) return;
    const [a, b] = defaultAutoSplitNames();
    setFirstName(a!);
    setSecondName(b!);
  }, [open]);

  function submit() {
    const a = firstName.trim() || 'Группа 1';
    const b = secondName.trim() || 'Группа 2';
    onConfirm({ firstName: a, secondName: b });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Разделить по алфавиту"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={submit} loading={loading} disabled={studentCount === 0}>
            Разделить
          </Button>
        </>
      }
    >
      {studentCount === 0 ? (
        <p className="text-sm text-slate-600">
          В классе нет активных учеников — делить некого. Добавьте учеников в состав класса и
          повторите.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {studentCount}{' '}
            {pluralRu(studentCount, ['ученик', 'ученика', 'учеников'])} будут разделены по
            алфавиту (фамилия → имя) на две группы: {sizes[0]} / {sizes[1]}.
          </p>
          <Field label="Название первой группы">
            <TextInput
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={loading}
            />
          </Field>
          <Field label="Название второй группы">
            <TextInput
              value={secondName}
              onChange={(e) => setSecondName(e.target.value)}
              disabled={loading}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}
