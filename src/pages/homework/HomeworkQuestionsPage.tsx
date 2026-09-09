import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { FormulaField } from '@/components/ui/FormulaField';
import { AiGeneratedBadge } from '@/components/ui/AiGeneratedBadge';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { AiJobProgress } from '@/components/ui/AiJobProgress';
import {
  useHomeworkAiJob,
  useHomeworkQuestions,
  useRegenerateQuestion,
  useSaveHomeworkQuestions,
} from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { homeworkApi } from '@/lib/homeworkApi';
import { checkFormulas } from '@/lib/formulaChecks';
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  emptyQuestion,
  isChoiceType,
  move,
  newLocalId,
  toDraft,
  toRequest,
  validateQuestions,
  withCorrect,
  withType,
  type HomeworkQuestionType,
  type QuestionDraft,
} from './homeworkQuestionsModel';

/**
 * Вопросы домашнего задания (ТЗ HOMEWORK-BE-006 §6).
 *
 * <p>Отдельная страница, а не блок в карточке: десять вопросов с вариантами и формулами —
 * это экран, а карточка задания и без того плотная.
 *
 * <p><b>Про AI здесь почти ничего нет.</b> Сгенерированный тест ложится сюда обычными
 * строками, и учитель точно так же собирает тест руками, ни разу не позвав модель.
 * Машинное происхождение — только пометка и кнопка «Заменить вопрос».
 */
export function HomeworkQuestionsPage() {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const id = Number(homeworkId);
  const valid = Number.isFinite(id) && id > 0;
  const navigate = useNavigate();
  const toast = useToast();

  useDocumentTitle('Вопросы задания');

  const homeworkQuery = useQuery({
    queryKey: ['homework', 'card', id],
    queryFn: ({ signal }) => homeworkApi.card(id, signal),
    enabled: valid,
  });
  const questionsQuery = useHomeworkQuestions(valid ? id : null);
  const save = useSaveHomeworkQuestions(id);
  const regenerate = useRegenerateQuestion(id);

  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [regeneratingJob, setRegeneratingJob] = useState<number | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  const { data: job } = useHomeworkAiJob(regeneratingJob);
  const homework = homeworkQuery.data;
  const frozen = homework?.hasAnswers === true;
  const readOnly = frozen || homework?.status === 'COMPLETED' || homework?.status === 'CANCELLED';

  useEffect(() => {
    if (!questionsQuery.data) return;
    setQuestions(questionsQuery.data.map(toDraft));
    setDirty(false);
  }, [questionsQuery.data]);

  // Замена вопроса меняет одну строку на сервере — перечитываем список, когда она готова.
  useEffect(() => {
    if (job?.status !== 'DONE' && job?.status !== 'FAILED') return;
    if (job.status === 'DONE') {
      void questionsQuery.refetch();
      toast.success('Вопрос заменён');
    } else {
      toast.error(job.errorMessage ?? 'Не удалось заменить вопрос');
    }
    setRegeneratingJob(null);
    setRegeneratingIndex(null);
    // questionsQuery в зависимостях не нужен: он меняется на каждый рендер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  const problems = useMemo(() => validateQuestions(questions), [questions]);
  const canSave = !readOnly && dirty && problems.size === 0;

  function update(next: QuestionDraft[]) {
    setQuestions(next);
    setDirty(true);
  }

  async function onSave() {
    try {
      await save.mutateAsync(toRequest(questions));
      setDirty(false);
      toast.success('Вопросы сохранены');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось сохранить вопросы');
    }
  }

  async function onRegenerate(index: number) {
    const question = questions[index];
    if (question.id == null) {
      toast.error('Сначала сохраните вопрос — заменять можно только сохранённый');
      return;
    }
    try {
      const started = await regenerate.mutateAsync({
        questionId: question.id,
        key: crypto.randomUUID(),
      });
      setRegeneratingJob(started.id ?? null);
      setRegeneratingIndex(index);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось запустить замену');
    }
  }

  function leave() {
    if (dirty) {
      setLeaving(true);
      return;
    }
    navigate(`/homework/${id}`);
  }

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={leave}
          aria-label="К заданию"
          className="text-subtle transition hover:text-ink"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-28 font-bold text-ink">Вопросы задания</h1>
          {homework && <p className="truncate text-13 text-muted">{homework.title}</p>}
        </div>
        {!readOnly && (
          <Button onClick={() => void onSave()} disabled={!canSave} loading={save.isPending}>
            Сохранить
          </Button>
        )}
      </div>

      {/* Выключенные кнопки без объяснения читаются как поломка. */}
      {frozen && (
        <NoticeBar tone="soft">
          По заданию уже есть ответы учеников — вопросы менять нельзя. Иначе ученик отвечал
          бы на один вопрос, а проверялся по другому.
        </NoticeBar>
      )}
      {!frozen && readOnly && (
        <NoticeBar tone="soft">
          Завершённое и отменённое задание не редактируется.
        </NoticeBar>
      )}

      {questionsQuery.isPending ? (
        <div className="card">
          <LoadingBlock label="Загрузка вопросов…" />
        </div>
      ) : questionsQuery.isError ? (
        <div className="card">
          <ErrorBlock
            message="Не удалось загрузить вопросы"
            onRetry={() => void questionsQuery.refetch()}
          />
        </div>
      ) : questions.length === 0 ? (
        <div className="card">
          <EmptyBlock
            title="Вопросов пока нет"
            description={
              readOnly
                ? 'У задания нет вопросов — оно проверяется текстом и вложениями.'
                : 'Добавьте вопросы сами или вернитесь в задание и сгенерируйте тест по материалам урока.'
            }
            action={
              readOnly ? undefined : (
                <Button size="sm" onClick={() => update([...questions, emptyQuestion()])}>
                  Добавить вопрос
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.localId}
              question={question}
              index={index}
              total={questions.length}
              readOnly={readOnly}
              messages={problems.get(index) ?? []}
              regenerating={regeneratingIndex === index ? job : undefined}
              onChange={(next) => update(questions.map((q, i) => (i === index ? next : q)))}
              onRemove={() => update(questions.filter((_, i) => i !== index))}
              onMove={(delta) => update(move(questions, index, delta))}
              onRegenerate={() => void onRegenerate(index)}
            />
          ))}
        </div>
      )}

      {!readOnly && questions.length > 0 && (
        <div>
          <Button
            variant="secondary"
            onClick={() => update([...questions, emptyQuestion()])}
          >
            <Plus className="size-4" aria-hidden />
            Добавить вопрос
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={leaving}
        onClose={() => setLeaving(false)}
        onConfirm={() => navigate(`/homework/${id}`)}
        title="Уйти без сохранения?"
        confirmLabel="Уйти"
        danger
        message="Правки вопросов не сохранены и будут потеряны."
      />
    </div>
  );
}

function QuestionCard({
  question,
  index,
  total,
  readOnly,
  messages,
  regenerating,
  onChange,
  onRemove,
  onMove,
  onRegenerate,
}: {
  question: QuestionDraft;
  index: number;
  total: number;
  readOnly: boolean;
  messages: string[];
  regenerating: Parameters<typeof AiJobProgress>[0]['job'];
  onChange: (next: QuestionDraft) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  onRegenerate: () => void;
}) {
  const invalid = messages.length > 0;
  const formulaProblems = checkFormulas([
    { where: 'Текст вопроса', text: question.text },
    ...(isChoiceType(question.type)
      ? question.options.map((option, i) => ({ where: `Вариант ${i + 1}`, text: option.text }))
      : []),
    { where: 'Эталонный ответ', text: question.referenceAnswer },
    { where: 'Критерии оценки', text: question.gradingCriteria },
  ]);

  return (
    <div
      className={
        invalid
          ? 'rounded-xl border border-red-300 bg-red-50/40 p-4'
          : 'rounded-xl border border-slate-200 bg-white p-4'
      }
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">Вопрос {index + 1}</span>
          {question.aiGenerated && <AiGeneratedBadge />}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              aria-label="Выше"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              aria-label="Ниже"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
            >
              <ArrowDown className="size-4" />
            </button>
            {/* Кнопка не про происхождение вопроса, а про «этот мне не нравится», —
                поэтому есть и у написанного руками. */}
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating != null}
              aria-label="Заменить вопрос"
              title="Заменить вопрос другим"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label="Удалить вопрос"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>

      {regenerating && <AiJobProgress job={regenerating} className="mb-4" />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Тип вопроса">
          <Select
            value={question.type}
            disabled={readOnly}
            onChange={(event) => onChange(withType(question, event.target.value as HomeworkQuestionType))}
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Балл за вопрос">
          <TextInput
            type="number"
            min={0.5}
            step={0.5}
            disabled={readOnly}
            value={question.maxScore}
            onChange={(event) => onChange({ ...question, maxScore: Number(event.target.value) })}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Текст вопроса" required>
          <FormulaField
            value={question.text}
            onChange={(text) => onChange({ ...question, text })}
            placeholder="Сформулируйте вопрос"
            ariaLabel={`Текст вопроса ${index + 1}`}
          />
        </Field>
      </div>

      {isChoiceType(question.type) && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Варианты ответа</p>
            {!readOnly && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  onChange({
                    ...question,
                    options: [
                      ...question.options,
                      { localId: newLocalId(), text: '', correct: false },
                    ],
                  })
                }
              >
                <Plus className="size-3.5" aria-hidden />
                Вариант
              </Button>
            )}
          </div>
          {question.options.map((option, optionIndex) => (
            <div key={option.localId} className="flex items-start gap-2">
              <input
                type={question.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                checked={option.correct}
                disabled={readOnly}
                onChange={() => onChange(withCorrect(question, optionIndex))}
                className="mt-3 size-4 shrink-0 accent-brand-500"
                aria-label={`Вариант ${optionIndex + 1} правильный`}
              />
              <div className="flex-1">
                <FormulaField
                  multiline={false}
                  value={option.text}
                  onChange={(text) =>
                    onChange({
                      ...question,
                      options: question.options.map((o, i) =>
                        i === optionIndex ? { ...o, text } : o,
                      ),
                    })
                  }
                  placeholder={`Вариант ${optionIndex + 1}`}
                  ariaLabel={`Вариант ${optionIndex + 1}`}
                />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...question,
                      options: question.options.filter((_, i) => i !== optionIndex),
                    })
                  }
                  disabled={question.options.length <= 2}
                  aria-label={`Удалить вариант ${optionIndex + 1}`}
                  className="mt-1 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {question.type === 'OPEN_TEXT' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Эталонный ответ" hint="Ученику не показывается">
            <FormulaField
              value={question.referenceAnswer}
              onChange={(referenceAnswer) => onChange({ ...question, referenceAnswer })}
              placeholder="По нему вы будете проверять работу"
              ariaLabel="Эталонный ответ"
            />
          </Field>
          <Field label="Критерии оценки" hint="Их использует подсказка ИИ">
            <FormulaField
              value={question.gradingCriteria}
              onChange={(gradingCriteria) => onChange({ ...question, gradingCriteria })}
              placeholder="За что снижать балл"
              ariaLabel="Критерии оценки"
            />
          </Field>

          {/*
            Решение задачи по физике — это выкладки и чертёж, а не абзац текста: набирать
            такое на телефоне ученик не станет. Галочка на вопросе, а не на задании,
            потому что в одном тесте бывает и «дайте определение», и «решите задачу».
          */}
          <div className="sm:col-span-2 flex flex-wrap items-center gap-4 rounded-xl bg-neutral-bg px-3 py-3">
            <label className="flex items-center gap-2 text-13 text-ink">
              <input
                type="checkbox"
                checked={question.allowPhoto}
                disabled={readOnly}
                onChange={(event) =>
                  onChange({ ...question, allowPhoto: event.target.checked })
                }
                className="size-4 shrink-0 accent-brand-500"
              />
              Разрешить фото решения
            </label>
            {question.allowPhoto && (
              <label className="flex items-center gap-2 text-13 text-muted">
                Не больше
                <TextInput
                  type="number"
                  min={1}
                  max={5}
                  value={String(question.maxPhotos)}
                  disabled={readOnly}
                  onChange={(event) =>
                    onChange({ ...question, maxPhotos: Number(event.target.value) })
                  }
                  className="w-16"
                  aria-label="Сколько фотографий можно приложить"
                />
                шт.
              </label>
            )}
          </div>
        </div>
      )}

      {formulaProblems.length > 0 && (
        <ul className="mt-4 list-inside list-disc space-y-1 text-xs text-amber-700">
          {formulaProblems.map((problem) => (
            <li key={`${problem.where}-${problem.message}`}>
              {problem.where}: {problem.message}
            </li>
          ))}
        </ul>
      )}

      {invalid && (
        <ul className="mt-4 list-inside list-disc space-y-1 text-xs text-red-600">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
