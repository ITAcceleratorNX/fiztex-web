import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cx } from '@/lib/format';
import type { GradeScaleValue, GradeType } from '@/lib/gradesApi';
import { GRADE_TYPES, GRADE_TYPE_LABELS } from '@/lib/gradesModel';

/**
 * Выбор оценки: сетка значений шкалы и необязательный тип
 * (Figma 2098:357 «grade-selection-popup», 2098:384 «grade-type-dropdown»).
 *
 * <p><b>Значения приходят с сервера.</b> Шкала — справочник (`GET /api/grades/scale`), и
 * порядок в сетке берётся из его `sortOrder`. Зашить «2, 3−, 3 …» в клиент значило бы
 * завести вторую шкалу, которая разойдётся с той, что принимает бэкенд.
 *
 * <p><b>Тип необязателен</b> (ТЗ §5.1), поэтому список типов спрятан за ссылкой и
 * открывается по требованию: у обычной оценки за работу на уроке тип не спрашивают.
 *
 * <p>Список типов — справочник бэкенда, а не набор из макета: в Figma в нём есть
 * «Диктант» и «Реферат», которых в API нет (см. `gradesModel.ts`).
 */
export function GradePicker({
  scale,
  studentName,
  value,
  gradeType,
  busy,
  error,
  canRemove,
  onPick,
  onTypeChange,
  onRemove,
  onClose,
}: {
  scale: GradeScaleValue[];
  /** Чью оценку выбирают — уходит в имя диалога для скринридера. */
  studentName?: string | null;
  value?: string | null;
  gradeType?: GradeType | null;
  busy?: boolean;
  error?: string | null;
  canRemove?: boolean;
  onPick: (scaleCode: string) => void;
  onTypeChange: (type: GradeType | null) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Тип уже выбран — список открыт сразу: иначе учитель не увидит, что именно стоит.
  const [typesOpen, setTypesOpen] = useState(Boolean(gradeType));

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

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={studentName ? `Оценка: ${studentName}` : 'Выбор оценки'}
      className={cx(
        'absolute right-0 top-full z-30 mt-2 flex w-[230px] flex-col gap-3 rounded-lg',
        'border border-slate-200 bg-white p-3 shadow-pop animate-scale-in',
        busy && 'pointer-events-none opacity-70',
      )}
    >
      <div className="grid grid-cols-5 gap-1">
        {scale.map((item) => {
          const code = item.code ?? '';
          const selected = code === value;
          return (
            <button
              key={code}
              type="button"
              onClick={() => onPick(code)}
              className={cx(
                'h-8 rounded-md text-13 font-semibold transition',
                selected
                  ? 'bg-navy-700 text-white'
                  : 'border border-slate-300 text-slate-600 hover:border-navy-700 hover:text-navy-700',
              )}
            >
              {code}
            </button>
          );
        })}
      </div>

      <hr className="border-slate-200" />

      {typesOpen ? (
        <div className="flex max-h-64 flex-col overflow-y-auto">
          <button
            type="button"
            onClick={() => onTypeChange(null)}
            className={cx(
              'flex h-8 shrink-0 items-center rounded-lg px-3 text-left text-13 transition',
              gradeType == null
                ? 'bg-navy-50 font-semibold text-navy-700'
                : 'font-medium text-slate-600 hover:bg-slate-50',
            )}
          >
            Без типа
          </button>
          {GRADE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onTypeChange(type)}
              className={cx(
                'flex h-8 shrink-0 items-center rounded-lg px-3 text-left text-13 transition',
                gradeType === type
                  ? 'bg-navy-50 font-semibold text-navy-700'
                  : 'font-medium text-slate-600 hover:bg-slate-50',
              )}
            >
              {GRADE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setTypesOpen(true)}
          className="self-start text-13 font-medium text-navy-700 hover:text-navy-800"
        >
          + Добавить тип (необязательно)
        </button>
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
