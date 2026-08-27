import { useState } from 'react';
import { Award } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GradeChip } from '@/components/ui/GradeChip';
import { GradePicker } from '@/components/ui/GradePicker';
import { useToast } from '@/context/ToastContext';
import {
  useGradeScale,
  useHomeworkGrades,
  useRemoveHomeworkGrade,
  useSetHomeworkGrade,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { GradeType } from '@/lib/gradesApi';

/**
 * Оценка за домашнее задание.
 *
 * Место выбрано по ходу работы: учитель уже открыл работу, чтобы принять или вернуть
 * её, — оценка ставится здесь же, а не отдельным экраном. Правило домена: на задание
 * приходится <b>ровно одна</b> актуальная оценка на ученика, поэтому вторую не
 * создают, а исправляют первую (GRADES-001 §5).
 *
 * Тип оценки не спрашиваем: у источника `HOMEWORK` пустое значение сервер сохраняет
 * как `HOMEWORK`, и выбор из десяти типов здесь был бы выбором без разницы.
 */
export function SubmissionGradeBlock({
  homeworkId,
  studentProfileId,
  disabled,
}: {
  homeworkId: number;
  studentProfileId: number;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [picking, setPicking] = useState(false);

  const scaleQuery = useGradeScale();
  const gradesQuery = useHomeworkGrades(homeworkId);
  const setGrade = useSetHomeworkGrade(homeworkId);
  const removeGrade = useRemoveHomeworkGrade(homeworkId);

  const grade = (gradesQuery.data ?? []).find(
    (row) => row.studentProfileId === studentProfileId && !row.deleted,
  );
  const busy = setGrade.isPending || removeGrade.isPending;

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof ApiError ? error.message : fallback);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <p className="flex items-center gap-2 text-11 font-bold uppercase text-subtle">
        <Award className="size-4 text-subtle" />
        Оценка за задание
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {grade ? (
            <>
              <GradeChip value={grade.scaleCode ?? ''} />
              <span className="text-13 text-muted">Выставлена</span>
            </>
          ) : (
            <span className="text-13 text-subtle">
              {gradesQuery.isPending ? 'Загружаем…' : 'Оценки нет'}
            </span>
          )}
        </div>

        {!disabled && (
          <div className="relative">
            <Button
              size="sm"
              variant={grade ? 'secondary' : 'primary'}
              disabled={busy || scaleQuery.isPending}
              onClick={() => setPicking((open) => !open)}
            >
              {grade ? 'Изменить' : 'Поставить оценку'}
            </Button>

            {picking && (
              <div className="absolute right-0 top-full z-20 mt-2">
                <GradePicker
                  scale={scaleQuery.data ?? []}
                  value={grade?.scaleCode ?? null}
                  gradeType={(grade?.gradeType as GradeType | undefined) ?? null}
                  busy={busy}
                  canRemove={Boolean(grade)}
                  onPick={(scaleCode) =>
                    setGrade.mutate(
                      { studentProfileId, scaleCode, gradeId: grade?.id ?? null },
                      {
                        onSuccess: () => setPicking(false),
                        onError: (error) => fail(error, 'Не удалось выставить оценку'),
                      },
                    )
                  }
                  onTypeChange={() => {}}
                  onRemove={() =>
                    grade?.id != null
                      ? removeGrade.mutate(
                          { gradeId: grade.id },
                          {
                            onSuccess: () => setPicking(false),
                            onError: (error) => fail(error, 'Не удалось снять оценку'),
                          },
                        )
                      : undefined
                  }
                  onClose={() => setPicking(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {grade && (
        <p className="text-11 text-subtle">
          Ученик и родитель видят её сразу — отложенной публикации у оценок нет.
        </p>
      )}
    </section>
  );
}
