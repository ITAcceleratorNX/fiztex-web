import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useCreateTest, useSubjects, useUpdateTest } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import type { Test, TestRequest, TestStatus, VersionStrategy } from '@/lib/types';
import { mapTestActivationError, type TestActivationViolation } from './testActivationHelpers';

export interface TestFormState {
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

function emptyState(): TestFormState {
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

/** Shared form state + validation + submit for creating/editing a test (modal and page layouts). */
export function useTestForm({
  active,
  test,
  aiTest = false,
  onSaved,
}: {
  /** Whether this form instance is currently shown (modal `open`, or `true` for a page). */
  active: boolean;
  test: Test | null;
  /** When true, creates/updates an AI test (useAiGeneration=true). */
  aiTest?: boolean;
  onSaved: (saved: Test) => void;
}) {
  const isEdit = Boolean(test);
  const subjects = useSubjects();
  const create = useCreateTest();
  const update = useUpdateTest();
  const toast = useToast();

  const [form, setForm] = useState<TestFormState>(emptyState);
  const [error, setError] = useState<string | null>(null);
  const [activationViolations, setActivationViolations] = useState<TestActivationViolation[]>([]);
  const [decisionOpen, setDecisionOpen] = useState(false);

  useEffect(() => {
    if (!active) return;
    setError(null);
    setActivationViolations([]);
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
  }, [active, test]);

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
    if (test?.maxScore != null && test.maxScore > 0 && min > test.maxScore) {
      return `Минимальный балл не может превышать сумму баллов вопросов (${test.maxScore})`;
    }
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
      useAiGeneration: aiTest ? true : test?.useAiGeneration ?? false,
      versionStrategy,
    };
  }

  async function submit(versionStrategy?: VersionStrategy) {
    try {
      let saved: Test;
      if (isEdit && test) {
        saved = await update.mutateAsync({ id: test.id, body: buildBody(versionStrategy) });
        toast.success(versionStrategy === 'NEW_VERSION' ? 'Создана новая версия теста' : 'Тест обновлён');
      } else {
        saved = await create.mutateAsync(buildBody());
        toast.success(aiTest ? 'Тест создан' : 'Карточка теста создана. Теперь добавьте вопросы.');
      }
      setDecisionOpen(false);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.isVersionDecision) {
        // Test already assigned — ask the admin how to save.
        setDecisionOpen(true);
        return;
      }
      setDecisionOpen(false);
      const mapped = mapTestActivationError(err);
      setActivationViolations(mapped.violations);
      setError(mapped.form ?? (mapped.violations.length > 0 ? null : 'Не удалось сохранить тест'));
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

  function set<K extends keyof TestFormState>(key: K, value: TestFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return {
    isEdit,
    form,
    set,
    error,
    activationViolations,
    decisionOpen,
    setDecisionOpen,
    subjectOptions,
    pending,
    onSubmit,
    submit,
  };
}
