import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCorrectionNextLesson } from '@/hooks/queries';
import { cx } from '@/lib/format';
import type { CorrectionGradeValue, GradeCorrection } from '@/lib/gradeCorrectionsApi';
import { longDate, todayIso } from '@/lib/gradeCorrectionModel';
import type { GradeScaleValue, GradeType } from '@/lib/gradesApi';

/** Форма значения временной оценки — та же, что у листа урока (`valueMode`). */
export interface TemporaryGradeOptions {
  pointsMode: boolean;
  scale: GradeScaleValue[];
  defaultWorkType: GradeType;
}

export interface CorrectionFormValues {
  comment: string;
  deadline: string;
  /** `null` — временной оценки нет (или её сняли). */
  temporaryGrade: CorrectionGradeValue | null;
}

type DeadlineChoice = { kind: 'next' | 'date'; date: string } | null;

/**
 * «Отметить исправление» (Figma 1987:22190, 1987:22379): комментарий, необязательная
 * временная оценка и срок. Та же форма открывается у активного исправления — с текущими
 * данными сервера, и сохраняет только изменённое.
 *
 * <p>Комментарий обязателен: без него «Сохранить» неактивна (ТЗ FE §3).
 */
export function CorrectionFormModal({
  lessonId,
  studentName,
  correction,
  options,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  lessonId: number;
  studentName: string;
  /** Активное исправление — форма правки; без него — создание. */
  correction?: GradeCorrection | null;
  options: TemporaryGradeOptions;
  busy: boolean;
  error: string | null;
  onSubmit: (values: CorrectionFormValues) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState(correction?.comment ?? '');
  const [temporary, setTemporary] = useState<string | null>(initialTemporary(correction, options));
  const [deadline, setDeadline] = useState<DeadlineChoice>(
    correction?.deadline ? { kind: 'date', date: correction.deadline } : null,
  );

  const canSave = comment.trim() !== '' && deadline != null && deadline.date !== '' && !busy;

  function submit() {
    if (!canSave || !deadline) return;
    onSubmit({
      comment: comment.trim(),
      deadline: deadline.date,
      temporaryGrade: temporary == null ? null : temporaryValue(temporary, options),
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`${correction ? 'Исправление' : 'Отметить исправление'} — ${studentName}`}
      subtitle={
        correction
          ? 'Измените комментарий, временную оценку или срок исправления.'
          : 'Укажите, что нужно исправить, и задайте срок для повторной проверки.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button variant="navy" onClick={submit} disabled={!canSave} loading={busy}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-900">Комментарий</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            maxLength={2000}
            data-modal-initial-focus
            placeholder="Что нужно исправить"
            className="resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-navy-700 focus:ring-1 focus:ring-navy-700"
          />
        </label>

        <TemporaryGradeField options={options} value={temporary} onChange={setTemporary} />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-900">Срок исправления</span>
          <DeadlinePicker lessonId={lessonId} value={deadline} onChange={setDeadline} />
        </div>

        {error && (
          <p role="alert" className="text-13 text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * «Срок истёк» (Figma 1987:23005, 1987:23193): комментарий, исходный срок и два действия.
 * «Продлить срок» раскрывает выбор нового срока здесь же; «Выставить итоговую оценку»
 * закрывает окно и открывает выбор оценки в строке ученика — там же, где её ставят всегда.
 */
export function CorrectionExpiredModal({
  lessonId,
  correction,
  busy,
  error,
  onExtend,
  onGrade,
  onClose,
}: {
  lessonId: number;
  correction: GradeCorrection;
  busy: boolean;
  error: string | null;
  onExtend: (deadline: string) => void;
  onGrade: () => void;
  onClose: () => void;
}) {
  const [extending, setExtending] = useState(false);
  const [deadline, setDeadline] = useState<DeadlineChoice>(null);
  const canSave = deadline != null && deadline.date !== '' && !busy;

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Срок истёк"
      subtitle="Исправление не было завершено в установленный срок."
      footer={
        extending ? (
          <>
            <Button variant="secondary" onClick={() => setExtending(false)} disabled={busy}>
              Отмена
            </Button>
            <Button
              variant="navy"
              disabled={!canSave}
              loading={busy}
              onClick={() => deadline && onExtend(deadline.date)}
            >
              Сохранить
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-900">Комментарий</span>
          <p className="whitespace-pre-line rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-13 text-slate-600">
            {correction.comment}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-900">Исходный срок</span>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">
              {longDate(correction.deadline)}
            </span>
            <span className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">Срок истёк</span>
          </div>
        </div>

        <div className="border-t border-slate-200" />

        {extending ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-900">Новый срок</span>
            <DeadlinePicker lessonId={lessonId} value={deadline} onChange={setDeadline} withHint />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-slate-900">Что сделать дальше</span>
            <button
              type="button"
              onClick={() => setExtending(true)}
              className="h-11 rounded-lg border border-slate-300 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
            >
              Продлить срок
            </button>
            <Button variant="navy" onClick={onGrade}>
              Выставить итоговую оценку
            </Button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-13 text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * Временная оценка: значения шкалы (или 1–10 в периоде по политике) пунктирными
 * клетками — пунктир и отличает её от итоговой во всех местах экрана. Повторное нажатие
 * на выбранное значение снимает оценку: она необязательна.
 */
function TemporaryGradeField({
  options,
  value,
  onChange,
}: {
  options: TemporaryGradeOptions;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(value != null);
  const values = temporaryValues(options);

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">Временная оценка (необязательно)</span>
        {expanded && options.pointsMode && <span className="text-11 text-slate-400">1–10</span>}
      </span>
      {expanded ? (
        <div className="grid w-fit grid-cols-5 gap-2" role="group" aria-label="Временная оценка">
          {values.map((item) => {
            const selected = item === value;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(selected ? null : item)}
                className={cx(
                  'flex h-9 min-w-11 items-center justify-center rounded-md border border-dashed px-1 text-sm transition',
                  selected
                    ? 'border-amber-600 bg-orange-50 font-semibold text-amber-600'
                    : 'border-slate-300 text-slate-500 hover:border-amber-600 hover:bg-orange-50/60',
                )}
              >
                {item}
              </button>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-11 items-center rounded-lg bg-slate-50 px-3 text-left text-sm font-medium text-navy-700 hover:bg-slate-100"
        >
          + Добавить временную оценку
        </button>
      )}
    </div>
  );
}

/**
 * Срок: «До следующего урока» (дату называет сервер по расписанию) или своя дата. Выбрать
 * дату раньше сегодняшней поле не даёт — и сервер такую не примет.
 */
function DeadlinePicker({
  lessonId,
  value,
  onChange,
  withHint,
}: {
  lessonId: number;
  value: DeadlineChoice;
  onChange: (value: DeadlineChoice) => void;
  withHint?: boolean;
}) {
  const nextQuery = useCorrectionNextLesson(lessonId, true);
  const nextDate = nextQuery.data?.lessonDate ?? null;
  const noNext = nextQuery.isSuccess && nextDate == null;

  const choiceClass = (active: boolean) =>
    cx(
      'h-9 rounded-lg border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
      active
        ? 'border-navy-700 bg-navy-50 font-semibold text-navy-700'
        : 'border-slate-300 text-slate-700 hover:border-navy-700',
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-pressed={value?.kind === 'next'}
          disabled={nextDate == null}
          title={noNext ? 'Следующего урока нет в расписании' : undefined}
          onClick={() => nextDate && onChange({ kind: 'next', date: nextDate })}
          className={choiceClass(value?.kind === 'next')}
        >
          До следующего урока
        </button>
        {value?.kind === 'next' && <span className="text-13 text-slate-400">{longDate(value.date)}</span>}
        <button
          type="button"
          aria-pressed={value?.kind === 'date'}
          onClick={() => onChange({ kind: 'date', date: value?.kind === 'date' ? value.date : '' })}
          className={choiceClass(value?.kind === 'date')}
        >
          Выбрать дату
        </button>
        {value?.kind === 'date' && (
          <input
            type="date"
            aria-label="Дата срока исправления"
            value={value.date}
            min={todayIso()}
            onChange={(event) => onChange({ kind: 'date', date: event.target.value })}
            className="h-9 rounded-lg border border-slate-300 px-2 text-sm text-slate-700 outline-none focus:border-navy-700"
          />
        )}
        {value == null && <span className="text-13 text-slate-400">Срок не выбран</span>}
      </div>
      {withHint && value != null && (
        <span className="text-xs text-slate-500">
          {value.kind === 'next' ? 'Новый срок — до следующего урока' : 'Новый срок выбран вручную'}
        </span>
      )}
      {noNext && value == null && (
        <span className="text-xs text-slate-400">Следующего урока нет в расписании — выберите дату</span>
      )}
    </div>
  );
}

function temporaryValues(options: TemporaryGradeOptions): string[] {
  if (options.pointsMode) return Array.from({ length: 10 }, (_, index) => String(index + 1));
  return options.scale.map((item) => item.code ?? '').filter(Boolean);
}

function temporaryValue(value: string, options: TemporaryGradeOptions): CorrectionGradeValue {
  return options.pointsMode
    ? { score: Number(value), gradeType: options.defaultWorkType }
    : { scaleCode: value };
}

function initialTemporary(correction: GradeCorrection | null | undefined, options: TemporaryGradeOptions) {
  const grade = correction?.temporaryGrade;
  if (!grade) return null;
  if (!options.pointsMode) return grade.scaleCode ?? null;
  return grade.score != null ? String(Number(grade.score)) : null;
}
