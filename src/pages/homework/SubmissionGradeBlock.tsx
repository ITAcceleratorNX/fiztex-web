import { useState } from 'react';
import { Award } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GradeChip } from '@/components/ui/GradeChip';
import { GradePicker } from '@/components/ui/GradePicker';
import { PointsPicker } from '@/components/ui/PointsPicker';
import { useToast } from '@/context/ToastContext';
import {
  useAiRecommendation,
  useGradeScale,
  useHomeworkGrades,
  useHomeworkValueMode,
  useRemoveHomeworkGrade,
  useSetHomeworkGrade,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { GradeType } from '@/lib/gradesApi';
import { gradeValueLabel, isKeptScaleGrade } from '@/lib/gradesModel';

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
 *
 * <p>В четверти, которая считается по политике оценивания (GRADES-003), оценка ставится
 * баллом: форму называет сервер (`value-mode`), и тогда вместо шкалы — выбор балла с
 * видом работы «Домашнее задание» по умолчанию.
 */
export function SubmissionGradeBlock({
  homeworkId,
  studentProfileId,
  disabled,
  withAiSuggestion = false,
}: {
  homeworkId: number;
  studentProfileId: number;
  disabled?: boolean;
  /** Есть сданная работа — у неё может быть рекомендация ИИ; без работы её не спрашиваем. */
  withAiSuggestion?: boolean;
}) {
  const toast = useToast();
  const [picking, setPicking] = useState(false);

  const scaleQuery = useGradeScale();
  const modeQuery = useHomeworkValueMode(homeworkId);
  const pointsMode = modeQuery.data?.valueMode === 'POINTS';
  const gradesQuery = useHomeworkGrades(homeworkId);
  const setGrade = useSetHomeworkGrade(homeworkId);
  const removeGrade = useRemoveHomeworkGrade(homeworkId);

  const grade = (gradesQuery.data ?? []).find(
    (row) => row.studentProfileId === studentProfileId && !row.deleted,
  );
  const busy = setGrade.isPending || removeGrade.isPending;
  // Оценка 2–5, оставленная при переходе периода на баллы, правится в своей шкале (QA-06).
  const keptScale = isKeptScaleGrade(modeQuery.data?.valueMode, grade);

  // Рекомендация ИИ — подсказка, а не оценка: в журнал её кладёт только нажатие учителя.
  // Тот же кэш, что у карточки проверки, второго запроса нет.
  const recommendation = useAiRecommendation(
    withAiSuggestion ? homeworkId : null,
    withAiSuggestion ? studentProfileId : null,
  ).data ?? null;
  const suggestedCode = recommendation?.scaleCode;
  const suggestedScore = recommendation?.suggestedScore;
  const suggestedMax = recommendation?.suggestedMaxScore ?? 10;
  const suggestion = !pointsMode
    ? suggestedCode
      ? { label: suggestedCode, value: { scaleCode: suggestedCode } }
      : null
    : suggestedScore != null && !keptScale
      ? {
          label: `${suggestedScore} из ${suggestedMax}`,
          value: {
            score: suggestedScore,
            maxScore: suggestedMax,
            gradeType: (modeQuery.data?.defaultWorkType ?? 'HOMEWORK') as GradeType,
          },
        }
      : null;
  const suggestionApplied = suggestion != null && grade != null
    && gradeValueLabel(grade) === (pointsMode ? String(suggestedScore) : suggestedCode);

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
              <GradeChip value={gradeValueLabel(grade) ?? ''} />
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
              disabled={busy || scaleQuery.isPending || modeQuery.isPending}
              onClick={() => setPicking((open) => !open)}
            >
              {grade ? 'Изменить' : 'Поставить оценку'}
            </Button>

            {picking && pointsMode && !keptScale && (
                <PointsPicker
                  workTypes={modeQuery.data?.workTypes ?? []}
                  value={grade ?? null}
                  defaultType={(modeQuery.data?.defaultWorkType ?? 'HOMEWORK') as GradeType}
                  busy={busy}
                  canRemove={Boolean(grade)}
                  onSubmit={(value) =>
                    setGrade.mutate(
                      {
                        studentProfileId,
                        score: value.score,
                        maxScore: value.maxScore,
                        gradeType: value.gradeType,
                        gradeId: grade?.id ?? null,
                      },
                      {
                        onSuccess: () => setPicking(false),
                        onError: (error) => fail(error, 'Не удалось выставить оценку'),
                      },
                    )
                  }
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
            )}

            {picking && (!pointsMode || keptScale) && (
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
            )}
          </div>
        )}
      </div>

      {suggestion && !disabled && !suggestionApplied && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-bg px-3 py-2">
          <p className="text-13 text-ink">
            ИИ предлагает: <strong>{suggestion.label}</strong>
            <span className="text-11 text-muted"> — оценку выставляете вы</span>
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || modeQuery.isPending}
            onClick={() =>
              setGrade.mutate({ studentProfileId, gradeId: grade?.id ?? null, ...suggestion.value }, {
                onError: (error) => fail(error, 'Не удалось выставить оценку'),
              })
            }
          >
            Выставить {suggestion.label}
          </Button>
        </div>
      )}

      {grade && (
        <p className="text-11 text-subtle">
          Ученик и родитель видят её сразу — отложенной публикации у оценок нет.
        </p>
      )}
    </section>
  );
}
