import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { useCreateTest, useSubjects, useUpdateTest } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import type { Test, TestRequest, TestStatus, VersionStrategy } from '@/lib/types';
import { VersionDecisionModal } from './VersionDecisionModal';

interface FormState {
  title: string;
  subjectId: string;
  grade: string;
  durationMinutes: string;
  minScore: string;
  rules: string;
  status: TestStatus;
  allowBackNavigation: boolean;
  maxAttempts: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

function emptyState(): FormState {
  return {
    title: '',
    subjectId: '',
    grade: '',
    durationMinutes: '60',
    minScore: '0',
    rules: '',
    status: 'DRAFT',
    allowBackNavigation: true,
    maxAttempts: '1',
    shuffleQuestions: false,
    shuffleOptions: false,
  };
}

export function TestFormModal({
  open,
  onClose,
  test,
}: {
  open: boolean;
  onClose: () => void;
  test: Test | null;
}) {
  const isEdit = Boolean(test);
  const subjects = useSubjects();
  const create = useCreateTest();
  const update = useUpdateTest();
  const toast = useToast();

  const [form, setForm] = useState<FormState>(emptyState);
  const [error, setError] = useState<string | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDecisionOpen(false);
    if (test) {
      setForm({
        title: test.title,
        subjectId: String(test.subjectId),
        grade: test.grade,
        durationMinutes: String(test.durationMinutes),
        minScore: String(test.minScore),
        rules: test.rules ?? '',
        status: test.status === 'COMPLETED' ? 'ACTIVE' : test.status,
        allowBackNavigation: test.allowBackNavigation,
        maxAttempts: String(test.maxAttempts),
        shuffleQuestions: test.shuffleQuestions,
        shuffleOptions: test.shuffleOptions,
      });
    } else {
      setForm(emptyState());
    }
  }, [open, test]);

  // Active subjects, plus the test's current subject if it is hidden (so it stays visible on edit).
  const subjectOptions = useMemo(() => {
    const all = subjects.data ?? [];
    return all.filter((s) => s.status === 'ACTIVE' || s.id === test?.subjectId);
  }, [subjects.data, test?.subjectId]);

  const pending = create.isPending || update.isPending;

  function validate(): string | null {
    if (!form.title.trim()) return 'Укажите название теста';
    if (!form.subjectId) return 'Выберите предмет';
    if (!form.grade.trim()) return 'Укажите класс поступления';
    const dur = Number(form.durationMinutes);
    if (!Number.isFinite(dur) || dur < 1) return 'Длительность должна быть не меньше 1 минуты';
    const min = Number(form.minScore);
    if (!Number.isFinite(min) || min < 0) return 'Минимальный балл не может быть отрицательным';
    return null;
  }

  function buildBody(versionStrategy?: VersionStrategy): TestRequest {
    return {
      title: form.title.trim(),
      subjectId: Number(form.subjectId),
      grade: form.grade.trim(),
      durationMinutes: Number(form.durationMinutes),
      minScore: Number(form.minScore),
      rules: form.rules.trim() || null,
      status: form.status,
      allowBackNavigation: form.allowBackNavigation,
      maxAttempts: Number(form.maxAttempts) || 1,
      shuffleQuestions: form.shuffleQuestions,
      shuffleOptions: form.shuffleOptions,
      versionStrategy,
    };
  }

  async function submit(versionStrategy?: VersionStrategy) {
    try {
      if (isEdit && test) {
        await update.mutateAsync({ id: test.id, body: buildBody(versionStrategy) });
        toast.success(versionStrategy === 'NEW_VERSION' ? 'Создана новая версия теста' : 'Тест обновлён');
      } else {
        await create.mutateAsync(buildBody());
        toast.success('Тест создан');
      }
      setDecisionOpen(false);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.isVersionDecision) {
        // Test already assigned — ask the admin how to save.
        setDecisionOpen(true);
        return;
      }
      setDecisionOpen(false);
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить тест');
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    void submit();
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={isEdit ? 'Редактировать тест' : 'Новый тест'}
        subtitle="Сначала создайте карточку теста, затем добавьте вопросы через кнопку «Вопросы» в списке или карточке."
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Отмена
            </Button>
            <Button form="test-form" type="submit" loading={pending}>
              {isEdit ? 'Сохранить' : 'Создать тест'}
            </Button>
          </>
        }
      >
        <form id="test-form" onSubmit={onSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              {error}
            </div>
          )}

          <Field label="Название теста" required>
            <TextInput
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Например: Математика · 5 класс"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Предмет" required hint="Только активные предметы">
              <Select value={form.subjectId} onChange={(e) => set('subjectId', e.target.value)}>
                <option value="">Выберите предмет…</option>
                {subjectOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.status === 'HIDDEN' ? ' (скрыт)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Класс поступления" required hint="Произвольное значение">
              <TextInput
                value={form.grade}
                onChange={(e) => set('grade', e.target.value)}
                placeholder="Например: 5 класс"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Длительность (мин)" required>
              <TextInput
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={(e) => set('durationMinutes', e.target.value)}
              />
            </Field>
            <Field label="Минимальный балл" required>
              <TextInput
                type="number"
                min={0}
                value={form.minScore}
                onChange={(e) => set('minScore', e.target.value)}
              />
            </Field>
            <Field label="Статус" required>
              <Select value={form.status} onChange={(e) => set('status', e.target.value as TestStatus)}>
                <option value="DRAFT">Черновик</option>
                <option value="ACTIVE">Активен</option>
              </Select>
            </Field>
          </div>

          <Field
            label="Инструкция"
            hint="Показывается перед началом теста (в будущих scope). Необязательно."
          >
            <TextArea
              value={form.rules}
              onChange={(e) => set('rules', e.target.value)}
              placeholder="Инструкция для поступающего"
            />
          </Field>

          <div>
            <p className="label-base">Базовые правила прохождения</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Toggle
                checked={form.allowBackNavigation}
                onChange={(v) => set('allowBackNavigation', v)}
                label="Можно возвращаться назад"
              />
              <Field label="Количество попыток">
                <TextInput
                  type="number"
                  min={1}
                  value={form.maxAttempts}
                  onChange={(e) => set('maxAttempts', e.target.value)}
                />
              </Field>
              <Toggle
                checked={form.shuffleQuestions}
                onChange={(v) => set('shuffleQuestions', v)}
                label="Перемешивать вопросы"
              />
              <Toggle
                checked={form.shuffleOptions}
                onChange={(v) => set('shuffleOptions', v)}
                label="Перемешивать варианты ответов"
              />
            </div>
          </div>
        </form>
      </Modal>

      <VersionDecisionModal
        open={decisionOpen}
        onClose={() => setDecisionOpen(false)}
        loading={pending}
        onChoose={(strategy) => void submit(strategy)}
      />
    </>
  );
}
