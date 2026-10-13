import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { TimeInput } from '@/components/ui/TimeInput';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/format';
import { groupClassesByGrade } from '@/lib/platformCoreApi';
import {
  AUDIENCE_OPTIONS,
  COMMENT_MAX,
  TITLE_MAX,
  emptyForm,
  formFromEvent,
  mapOneTimeEventError,
  toRequest,
  validateForm,
  type OneTimeEventErrors,
  type OneTimeEventForm,
} from '@/lib/oneTimeEventModel';
import { ONE_TIME_EVENTS_KEY, oneTimeEventsApi, type OneTimeEvent } from '@/lib/oneTimeEventsApi';
import { useSchoolClasses } from '@/platform/hooks/useScheduleSettings';

/**
 * Создание и правка разового события.
 *
 * Кого событие касается и какие уроки оно перекрывает, форма не считает: она отправляет поля, а
 * сетка после ответа перечитывается целиком. Ошибка сервера оставляет введённое на месте и
 * встаёт к полю, если по ней понятно, к какому.
 */
export function OneTimeEventFormModal({
  open,
  onClose,
  yearId,
  event,
  defaultDate,
  defaultClassId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  yearId: number;
  /** Правка — событие с сервера; создание — {@code null}. */
  event: OneTimeEvent | null;
  defaultDate: string;
  /** Класс открытой сетки — им создание и начинается. */
  defaultClassId?: string;
  onSaved: (saved: OneTimeEvent) => void;
}) {
  const isEdit = event != null;
  const toast = useToast();
  const queryClient = useQueryClient();
  const classesQuery = useSchoolClasses(open ? yearId : null);
  const [form, setForm] = useState<OneTimeEventForm>(() => emptyForm(defaultDate, defaultClassId));
  const [errors, setErrors] = useState<OneTimeEventErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(event ? formFromEvent(event) : emptyForm(defaultDate, defaultClassId));
    setErrors({});
    setFormError(null);
  }, [open, event, defaultDate, defaultClassId]);

  const classes = useMemo(() => classesQuery.data?.content ?? [], [classesQuery.data]);
  const grades = useMemo(() => groupClassesByGrade(classes).map((group) => group.grade), [classes]);
  const classOptions = useMemo(
    () => groupClassesByGrade(classes).flatMap((group) =>
      group.classes.map((c) => ({ value: String(c.id), label: c.name }))),
    [classes],
  );

  const save = useMutation({
    mutationFn: () => {
      const body = toRequest(form);
      return event?.id != null
        ? oneTimeEventsApi.update(event.id, body)
        : oneTimeEventsApi.create(yearId, body);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ONE_TIME_EVENTS_KEY });
      toast.success(isEdit ? 'Событие изменено' : 'Событие создано');
      onSaved(saved);
    },
    onError: (error) => {
      const mapped = mapOneTimeEventError(error);
      setErrors(mapped.fields);
      setFormError(mapped.form ?? null);
    },
  });

  function patch(next: Partial<OneTimeEventForm>) {
    setForm((current) => ({ ...current, ...next }));
    const touched = Object.keys(next);
    setErrors((current) => {
      const copy = { ...current };
      for (const key of touched) {
        if (key === 'grade' || key === 'classIds') delete copy.audience;
        else delete copy[key as keyof OneTimeEventErrors];
      }
      return copy;
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (save.isPending) return;
    const local = validateForm(form);
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length > 0) return;
    save.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!save.isPending) onClose();
      }}
      title={isEdit ? 'Изменить разовое событие' : 'Новое разовое событие'}
      subtitle="Событие ложится поверх расписания на выбранную дату — постоянная сетка не меняется"
      size="md"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button type="submit" form="one-time-event-form" loading={save.isPending}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      )}
    >
      <form id="one-time-event-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-13 text-red-600">
            {formError}
          </p>
        )}

        <Field label="Название" required error={errors.title}>
          <TextInput
            value={form.title}
            maxLength={TITLE_MAX}
            placeholder="Например, общешкольная линейка"
            error={Boolean(errors.title)}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Дата" required error={errors.date}>
            <TextInput
              type="date"
              value={form.date}
              error={Boolean(errors.date)}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </Field>
          <Field label="Начало" required error={errors.startTime}>
            <TimeInput
              value={form.startTime}
              aria-label="Начало"
              placeholder="08:00"
              error={Boolean(errors.startTime)}
              onChange={(value) => patch({ startTime: value })}
            />
          </Field>
          <Field label="Окончание" required error={errors.endTime}>
            <TimeInput
              value={form.endTime}
              aria-label="Окончание"
              placeholder="09:00"
              error={Boolean(errors.endTime)}
              onChange={(value) => patch({ endTime: value })}
            />
          </Field>
        </div>

        <Field label="Аудитория" required error={errors.audience}>
          <div className="flex flex-col gap-3">
            <div role="radiogroup" className="flex gap-1 rounded-lg border border-line bg-gray-50 p-[3px]">
              {AUDIENCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={form.audience === option.value}
                  onClick={() => patch({ audience: option.value })}
                  className={cx(
                    'flex-1 rounded-md px-3 py-1.5 text-13 font-semibold transition',
                    form.audience === option.value
                      ? 'bg-white text-navy-700 shadow-[0_1px_1px_rgba(0,0,0,0.04)]'
                      : 'text-muted hover:text-navy-700',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {form.audience === 'GRADE' && (
              <Select
                value={form.grade}
                aria-label="Параллель"
                disabled={classesQuery.isLoading}
                onChange={(e) => patch({ grade: e.target.value })}
              >
                <option value="">Выберите параллель</option>
                {grades.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade} параллель
                  </option>
                ))}
              </Select>
            )}
            {form.audience === 'CLASSES' && (
              <MultiSelect
                options={classOptions}
                value={form.classIds}
                placeholder="Выберите классы"
                emptyLabel={classesQuery.isLoading ? 'Загружаем классы…' : 'Классов нет'}
                error={Boolean(errors.audience)}
                onChange={(next) => patch({ classIds: next })}
              />
            )}
            {form.audience === 'SCHOOL' && (
              <p className="text-xs text-muted">Все классы учебного года</p>
            )}
          </div>
        </Field>

        <Field label="Комментарий" error={errors.comment}>
          <TextArea
            value={form.comment}
            maxLength={COMMENT_MAX}
            placeholder="Необязательно"
            error={Boolean(errors.comment)}
            onChange={(e) => patch({ comment: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}
