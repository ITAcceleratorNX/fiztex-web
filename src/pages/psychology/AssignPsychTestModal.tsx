import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { ClassGradePicker } from '@/platform/pages/schedule/ClassGradePicker';
import { useToast } from '@/context/ToastContext';
import { useAssignPsychTest, usePsychTestClasses } from '@/hooks/psychTestQueries';
import { ApiError } from '@/lib/api';
import { pluralRu } from '@/lib/format';
import { deadlineToIso, groupPsychClassesByGrade, isDeadlineInPast } from '@/lib/psychTestModel';

const STUDENT_FORMS: [string, string, string] = ['ученик', 'ученика', 'учеников'];

/**
 * Назначение психологического теста классам (PSYCHOLOGIST-002).
 *
 * Получатели — снимок на момент назначения: тест получат те, кто состоит в классах сейчас.
 * Поэтому рядом с каждым классом стоит число учеников — пустой класс виден до отправки, а не
 * по отказу сервера. Число учеников в сумме — оценка сверху: ученика в двух выбранных
 * классах сервер посчитает один раз.
 */
export function AssignPsychTestModal({
  open,
  onClose,
  testId,
  testTitle,
}: {
  open: boolean;
  onClose: () => void;
  testId: number;
  testTitle: string;
}) {
  const toast = useToast();
  const classes = usePsychTestClasses(open);
  const assign = useAssignPsychTest(testId);

  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setDeadline('');
    setError(null);
  }, [open]);

  const groups = useMemo(() => groupPsychClassesByGrade(classes.data ?? []), [classes.data]);
  const studentsByClass = useMemo(
    () => new Map(groups.flatMap((g) => g.classes.map((c) => [c.id, c.studentsCount] as const))),
    [groups],
  );
  const selectedStudents = [...selected].reduce((sum, id) => sum + (studentsByClass.get(id) ?? 0), 0);
  const deadlineInPast = isDeadlineInPast(deadline);

  function toggleClass(classId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  function toggleGrade(classIds: number[]) {
    setSelected((prev) => {
      const allOn = classIds.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of classIds) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function submit() {
    setError(null);
    try {
      const created = await assign.mutateAsync({
        classIds: [...selected],
        deadlineAt: deadlineToIso(deadline),
      });
      const total = created.recipientsTotal ?? 0;
      toast.success(`Тест назначен: ${total} ${pluralRu(total, STUDENT_FORMS)}`);
      onClose();
    } catch (err) {
      // Тексты отказов сервер отдаёт человеческие: «Тест уже открыт для класса: 7А» и т.п.
      setError(err instanceof ApiError ? err.message : 'Не удалось назначить тест');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Назначить классам"
      subtitle={testTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={assign.isPending}>
            Отмена
          </Button>
          <Button
            onClick={() => void submit()}
            loading={assign.isPending}
            disabled={selected.size === 0 || deadlineInPast}
          >
            {selected.size > 0
              ? `Назначить · ${selectedStudents} ${pluralRu(selectedStudents, STUDENT_FORMS)}`
              : 'Назначить'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">{error}</div>
        )}

        <p className="text-sm text-slate-500">
          Тест получат ученики, которые состоят в выбранных классах сейчас. Ответы каждого ученика
          увидите только вы.
        </p>

        {classes.isLoading ? (
          <LoadingBlock label="Загрузка классов…" />
        ) : classes.isError ? (
          <ErrorBlock
            message={classes.error instanceof ApiError ? classes.error.message : 'Не удалось загрузить классы'}
            onRetry={() => void classes.refetch()}
          />
        ) : groups.length === 0 ? (
          <EmptyBlock
            title="Классов нет"
            description="В текущем учебном году нет активных классов — назначать тест некому."
          />
        ) : (
          <div className="rounded-xl ring-1 ring-slate-200">
            <ClassGradePicker
              className="p-3"
              gradeGroups={groups}
              selectedClassIds={selected}
              onToggleClass={toggleClass}
              onToggleGrade={toggleGrade}
              disabled={assign.isPending}
              classMeta={(classId) => {
                const count = studentsByClass.get(classId) ?? 0;
                return (
                  <span className={count === 0 ? 'text-xs text-amber-600' : 'text-xs text-slate-400'}>
                    {count === 0 ? 'нет учеников' : `${count} ${pluralRu(count, STUDENT_FORMS)}`}
                  </span>
                );
              }}
            />
          </div>
        )}

        <Field
          label="Срок прохождения"
          hint="Необязательно. После срока ответы не принимаются; закрыть приём можно и вручную."
          error={deadlineInPast ? 'Срок должен быть в будущем' : undefined}
        >
          <TextInput
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            error={deadlineInPast}
            className="max-w-xs"
          />
        </Field>
      </div>
    </Modal>
  );
}
