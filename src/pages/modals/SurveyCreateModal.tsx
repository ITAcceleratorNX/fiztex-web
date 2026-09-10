import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { useCreateSurvey } from '@/hooks/surveyQueries';
import { ApiError } from '@/lib/api';
import type { SurveyMode } from '@/lib/surveyApi';

/**
 * Создание опроса — модалка, а не отдельная страница: полей мало (название, режим,
 * необязательные даты), и следующего шага мастера здесь нет — вопросы и аудитория
 * заводятся уже на карточке созданного опроса.
 */
export function SurveyCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<SurveyMode>('NAMED');
  const [startAt, setStartAt] = useState('');
  const [deadlineAt, setDeadlineAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateSurvey();

  function reset() {
    setTitle('');
    setDescription('');
    setMode('NAMED');
    setStartAt('');
    setDeadlineAt('');
    setError(null);
  }

  function close() {
    if (create.isPending) return;
    reset();
    onClose();
  }

  async function submit() {
    setError(null);
    try {
      const created = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        mode,
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
        deadlineAt: deadlineAt ? new Date(deadlineAt).toISOString() : undefined,
      });
      reset();
      onCreated(created.id as number);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать опрос');
    }
  }

  const valid = title.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Новый опрос"
      subtitle="Вопросы и аудитория добавляются на карточке после создания."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={create.isPending}>
            Отмена
          </Button>
          <Button
            form="survey-create-form"
            type="submit"
            loading={create.isPending}
            disabled={!valid}
          >
            Создать опрос
          </Button>
        </>
      }
    >
      <form
        id="survey-create-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
            {error}
          </div>
        )}

        <Field label="Название опроса" required>
          <TextInput
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Удовлетворённость учёбой"
          />
        </Field>

        <Field label="Описание" hint="Необязательно">
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="О чём опрос и зачем он проводится"
          />
        </Field>

        <div>
          <p className="label-base">Режим</p>
          <div
            role="radiogroup"
            aria-label="Режим опроса"
            className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
          >
            {(
              [
                ['NAMED', 'Именной'],
                ['ANONYMOUS', 'Анонимный'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={
                  mode === value
                    ? 'rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm'
                    : 'rounded-lg px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-600'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Начало" hint="Необязательно">
            <TextInput type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </Field>
          <Field label="Срок" hint="Необязательно">
            <TextInput type="date" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
