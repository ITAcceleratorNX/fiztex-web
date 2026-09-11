import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { ClassGradePicker } from '@/platform/pages/schedule/ClassGradePicker';
import { useToast } from '@/context/ToastContext';
import { useSetSurveyAudience } from '@/hooks/surveyQueries';
import { ApiError } from '@/lib/api';
import type { Survey } from '@/lib/surveyApi';
import type { GradeClassGroup, SchoolClassRef } from '@/lib/scheduleSettingsTypes';

/**
 * Аудитория опроса — первый настоящий потребитель `ClassGradePicker`: раньше на него
 * никто не ссылался (см. док-комментарий самого компонента), поэтому дерево «параллель →
 * классы» здесь подключается впервые, а не копируется откуда-то ещё.
 */
export function SurveyAudienceTab({
  survey,
  classes,
  gradeGroups,
  canEdit,
}: {
  survey: Survey;
  classes: SchoolClassRef[];
  gradeGroups: GradeClassGroup[];
  canEdit: boolean;
}) {
  const toast = useToast();
  const setAudience = useSetSurveyAudience(survey.id as number);

  const [targetsStudents, setTargetsStudents] = useState(Boolean(survey.targetsStudents));
  const [targetsParents, setTargetsParents] = useState(Boolean(survey.targetsParents));
  const [selectedClassIds, setSelectedClassIds] = useState<Set<number>>(
    () => new Set(survey.audienceClassIds ?? []),
  );
  const [error, setError] = useState<string | null>(null);

  // Карточка могла обновиться после публикации или правки в другой вкладке — форма
  // подхватывает новые значения, только пока сама не тронута локально.
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (dirty) return;
    setTargetsStudents(Boolean(survey.targetsStudents));
    setTargetsParents(Boolean(survey.targetsParents));
    setSelectedClassIds(new Set(survey.audienceClassIds ?? []));
  }, [survey, dirty]);

  const distinctGrades = useMemo(() => {
    const set = new Set(classes.map((c) => c.grade));
    return [...set].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
  }, [classes]);

  const [fromGrade, setFromGrade] = useState('');
  const [toGrade, setToGrade] = useState('');

  function toggleClass(classId: number) {
    setDirty(true);
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  function toggleGrade(classIds: number[]) {
    setDirty(true);
    setSelectedClassIds((prev) => {
      const allOn = classIds.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of classIds) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  /**
   * Диапазон параллелей — по позиции в отсортированном списке уникальных значений
   * `grade`, а не по числовому парсингу: часть школ использует нечисловые параллели
   * («Дошкольная»), и сравнение чисел там просто не сработало бы. Индекс в
   * отсортированном списке работает для любых значений одинаково.
   */
  function applyGradeRange() {
    if (!fromGrade || !toGrade) return;
    const fromIndex = distinctGrades.indexOf(fromGrade);
    const toIndex = distinctGrades.indexOf(toGrade);
    if (fromIndex === -1 || toIndex === -1) return;
    const [lo, hi] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    const gradesInRange = new Set(distinctGrades.slice(lo, hi + 1));
    setDirty(true);
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      for (const schoolClass of classes) {
        if (gradesInRange.has(schoolClass.grade)) next.add(schoolClass.id);
      }
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    try {
      await setAudience.mutateAsync({
        targetsStudents,
        targetsParents,
        classIds: [...selectedClassIds],
      });
      setDirty(false);
      toast.success('Аудитория сохранена');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить аудиторию');
    }
  }

  return (
    <div className="space-y-5">
      {!canEdit && (
        <p className="text-sm text-slate-500">
          Опрос опубликован — аудитория теперь доступна только для просмотра.
        </p>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Toggle
          checked={targetsStudents}
          onChange={(v) => {
            setDirty(true);
            setTargetsStudents(v);
          }}
          label="Ученики"
        />
        <Toggle
          checked={targetsParents}
          onChange={(v) => {
            setDirty(true);
            setTargetsParents(v);
          }}
          label="Родители"
        />
      </div>

      {canEdit && distinctGrades.length > 1 && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div>
            <p className="label-base">От параллели</p>
            <Select value={fromGrade} onChange={(e) => setFromGrade(e.target.value)} className="w-32">
              <option value="">—</option>
              {distinctGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="label-base">До параллели</p>
            <Select value={toGrade} onChange={(e) => setToGrade(e.target.value)} className="w-32">
              <option value="">—</option>
              {distinctGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="secondary" size="sm" onClick={applyGradeRange} disabled={!fromGrade || !toGrade}>
            Выбрать классы диапазона
          </Button>
        </div>
      )}

      <div className="card p-4">
        <ClassGradePicker
          gradeGroups={gradeGroups}
          selectedClassIds={selectedClassIds}
          onToggleClass={toggleClass}
          onToggleGrade={toggleGrade}
          disabled={!canEdit}
        />
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => void handleSave()} loading={setAudience.isPending}>
            Сохранить аудиторию
          </Button>
        </div>
      )}
    </div>
  );
}
