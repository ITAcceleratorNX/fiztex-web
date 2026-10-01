import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cx } from '@/lib/format';
import type { GradeType, SheetWorkType } from '@/lib/gradesApi';
import { GRADE_TYPE_LABELS } from '@/lib/gradesModel';
import { COMPONENT_SHORT } from '@/lib/gradingModel';

export type PointsValue = { score: number; maxScore: number | null; gradeType: GradeType };

const TEN_POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Выбор оценки в баллах (GRADES-003) — пара к `GradePicker` для периодов, которые
 * считаются по политике оценивания.
 *
 * <p><b>Что как оценивается, решает политика</b>, а не поповер: типы работ и их способ
 * приходят в листе урока (`workTypes`). У 10-балльной работы — сетка 1…10 и одно нажатие,
 * как у старой шкалы; у СОР и СОЧ — «балл из максимума»: максимум общий для работы, поэтому
 * его подставляет последний введённый на этом уроке (`suggestedMax`).
 *
 * <p>Тип выбирается первым и не сохраняется сам по себе: смена типа может сменить способ
 * оценивания (7 из 10 → 15 из 20), и сохранить «новый тип со старым баллом» значило бы
 * отправить заведомо неверную оценку.
 */
export function PointsPicker({
  workTypes,
  value,
  defaultType,
  suggestedMax,
  studentName,
  busy,
  error,
  canRemove,
  onSubmit,
  onRemove,
  onClose,
}: {
  workTypes: SheetWorkType[];
  value?: { score?: number | null; maxScore?: number | null; gradeType?: GradeType | null } | null;
  defaultType: GradeType;
  /** Максимум, который учитель уже вводил для такой работы на этом уроке. */
  suggestedMax?: (type: GradeType) => number | null;
  studentName?: string | null;
  busy?: boolean;
  error?: string | null;
  canRemove?: boolean;
  onSubmit: (value: PointsValue) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [type, setType] = useState<GradeType>(value?.gradeType ?? defaultType);
  const rule = workTypes.find((item) => item.type === type);
  const tenPoint = rule?.scoring !== 'RAW_POINTS';

  const [score, setScore] = useState(value?.score != null && !tenPoint ? String(value.score) : '');
  const [maxScore, setMaxScore] = useState(() => {
    if (value?.maxScore != null && value.gradeType === type && !tenPoint) return String(value.maxScore);
    const suggested = suggestedMax?.(type);
    return suggested != null ? String(suggested) : '';
  });

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  function changeType(next: GradeType) {
    setType(next);
    const nextRule = workTypes.find((item) => item.type === next);
    if (nextRule?.scoring === 'RAW_POINTS') {
      const suggested = suggestedMax?.(next);
      setMaxScore(suggested != null ? String(suggested) : '');
      setScore('');
    }
  }

  const rawScore = Number(score);
  const rawMax = Number(maxScore);
  // Подсказка, а не проверка: пределы всё равно проверяет сервер (контракт §4).
  const rawValid =
    score.trim() !== '' &&
    maxScore.trim() !== '' &&
    Number.isInteger(rawScore) &&
    Number.isInteger(rawMax) &&
    rawMax > 0 &&
    rawScore >= 0 &&
    rawScore <= rawMax;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={studentName ? `Оценка: ${studentName}` : 'Выбор оценки'}
      className={cx(
        'absolute right-0 top-full z-30 mt-2 flex w-[260px] flex-col gap-3 rounded-lg',
        'border border-slate-200 bg-white p-3 shadow-pop animate-scale-in',
        busy && 'pointer-events-none opacity-70',
      )}
    >
      <label className="flex flex-col gap-1">
        <span className="text-11 font-bold uppercase text-slate-400">Вид работы</span>
        <select
          value={type}
          onChange={(event) => changeType(event.target.value as GradeType)}
          className="input-base h-9 py-1 text-13"
        >
          {workTypes.map((item) => (
            <option key={item.type} value={item.type}>
              {GRADE_TYPE_LABELS[item.type as GradeType] ?? item.type}
              {item.component ? ` · ${COMPONENT_SHORT[item.component]}` : ' · не учитывается'}
            </option>
          ))}
        </select>
      </label>

      {tenPoint ? (
        <div className="grid grid-cols-5 gap-1" role="group" aria-label="Балл по 10-балльной шкале">
          {TEN_POINTS.map((point) => {
            const selected = value?.gradeType === type && Number(value?.score) === point;
            return (
              <button
                key={point}
                type="button"
                onClick={() => onSubmit({ score: point, maxScore: 10, gradeType: type })}
                className={cx(
                  'h-8 rounded-md text-13 font-semibold transition',
                  selected
                    ? 'bg-navy-700 text-white'
                    : 'border border-slate-300 text-slate-600 hover:border-navy-700 hover:text-navy-700',
                )}
              >
                {point}
              </button>
            );
          })}
        </div>
      ) : (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (rawValid) onSubmit({ score: rawScore, maxScore: rawMax, gradeType: type });
          }}
        >
          <label className="flex w-16 flex-col gap-1">
            <span className="text-11 font-bold uppercase text-slate-400">Балл</span>
            <input
              autoFocus
              inputMode="numeric"
              value={score}
              onChange={(event) => setScore(event.target.value.replace(/[^\d]/g, ''))}
              className="input-base h-9 px-2 py-1 text-center text-13"
            />
          </label>
          <span className="pb-2 text-13 text-slate-400">из</span>
          <label className="flex w-16 flex-col gap-1">
            <span className="text-11 font-bold uppercase text-slate-400">Макс.</span>
            <input
              inputMode="numeric"
              value={maxScore}
              onChange={(event) => setMaxScore(event.target.value.replace(/[^\d]/g, ''))}
              className="input-base h-9 px-2 py-1 text-center text-13"
            />
          </label>
          <button
            type="submit"
            disabled={!rawValid}
            className="h-9 flex-1 rounded-md bg-navy-700 px-2 text-13 font-semibold text-white transition hover:bg-navy-800 disabled:bg-disabled disabled:text-slate-400"
          >
            Сохранить
          </button>
        </form>
      )}

      {canRemove && (
        <>
          <hr className="border-slate-200" />
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-2 self-start text-13 font-medium text-red-600 hover:text-red-700"
          >
            <Trash2 className="size-4" />
            Снять оценку
          </button>
        </>
      )}

      {error && <p className="text-13 font-medium text-red-600">{error}</p>}
    </div>
  );
}
