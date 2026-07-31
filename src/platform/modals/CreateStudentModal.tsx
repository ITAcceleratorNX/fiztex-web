import { useEffect, useState, type FormEvent } from 'react';
import { Calendar } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import {
  createUser,
  isDuplicateStudentError,
  listAcademicYears,
  listClasses,
  updateStudent,
} from '../services';
import type { AcademicYear, SchoolClass } from '../types';
import { formatPhoneMask } from './createUserHelpers';
import { IssuedCodeResult } from './IssuedCodeResult';

export function CreateStudentModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [classId, setClassId] = useState('');
  const [yearId, setYearId] = useState('');
  const [phone, setPhone] = useState('');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [needForce, setNeedForce] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName('');
    setBirthDate('');
    setClassId('');
    setYearId('');
    setPhone('');
    setError(null);
    setNeedForce(false);
    setIssuedCode(null);
    setLoadingMeta(true);
    void listAcademicYears()
      .then((list) => {
        setYears(list);
        const active = list.find((y) => y.status === 'ACTIVE') ?? list[0];
        if (active) setYearId(active.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить годы'))
      .finally(() => setLoadingMeta(false));
  }, [open]);

  // Класс выбирается явно из активных классов года — угадывать по параллели нельзя,
  // в параллели почти всегда больше одного класса.
  useEffect(() => {
    if (!open || !yearId) {
      setClasses([]);
      return;
    }
    setClassId('');
    void listClasses({ academicYearId: yearId, status: 'ACTIVE' })
      .then(setClasses)
      .catch(() => setClasses([]));
  }, [open, yearId]);

  async function submit(force: boolean) {
    setError(null);
    if (!fullName.trim()) {
      setError('Укажите ФИО');
      return;
    }
    if (!yearId) {
      setError('Укажите учебный год');
      return;
    }
    if (!classId) {
      setError('Укажите класс зачисления');
      return;
    }

    setPending(true);
    try {
      // Аккаунт, профиль и зачисление в класс — один запрос, одна транзакция.
      const created = await createUser(
        {
          fullName: fullName.trim(),
          role: 'STUDENT',
          phone: phone.trim() || undefined,
          classId: Number(classId),
        },
        { force },
      );

      if (created.schoolProfileId != null && birthDate) {
        await updateStudent(created.schoolProfileId, { birthDate });
      }

      onSaved();
      if (created.issuedCode) {
        setIssuedCode(created.issuedCode);
      } else {
        onClose();
      }
    } catch (err) {
      if (isDuplicateStudentError(err) && !force) {
        setNeedForce(true);
        setError('В классе уже есть ученик с похожим ФИО. Нажмите «Создать» ещё раз для подтверждения.');
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось создать ученика');
      }
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submit(needForce);
  }

  function handleDone() {
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleDone}
      title={issuedCode ? 'Ученик создан' : 'Создать ученика'}
      subtitle={
        issuedCode
          ? 'Передайте персональный код ученику для входа в мобильное приложение'
          : 'Заполните основную информацию об ученике'
      }
      footer={
        issuedCode ? undefined : (
          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Отмена
            </Button>
            <Button onClick={onSubmit} loading={pending}>
              {needForce ? 'Создать всё равно' : 'Создать ученика'}
            </Button>
          </div>
        )
      }
    >
      {issuedCode ? (
        <IssuedCodeResult
          roleLabel="ученик"
          code={issuedCode}
          hint="Ученик вводит этот персональный код и задаёт PIN (4–6 цифр) при первом входе."
          onDone={handleDone}
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="ФИО" required>
            <TextInput
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Фамилия Имя Отчество"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Дата рождения">
              <div className="relative">
                <TextInput
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="pr-10"
                />
                <Calendar className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>
            <Field label="Учебный год" required>
              <Select value={yearId} onChange={(e) => setYearId(e.target.value)} disabled={loadingMeta}>
                <option value="">{loadingMeta ? 'Загрузка…' : 'Выберите год'}</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Класс зачисления" required>
              <Select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setNeedForce(false);
                }}
                disabled={loadingMeta || !yearId || classes.length === 0}
              >
                <option value="">
                  {!yearId
                    ? 'Сначала выберите год'
                    : classes.length === 0
                      ? 'В этом году нет классов'
                      : 'Выберите класс'}
                </option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Телефон">
              <TextInput
                value={phone}
                onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                placeholder="+7 (___) ___-__-__"
                inputMode="tel"
              />
            </Field>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
