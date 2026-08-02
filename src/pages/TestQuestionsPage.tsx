import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { DraftQuestionBadge } from '@/components/ui/DraftQuestionBadge';
import { DraftReviewBanner } from '@/components/ui/DraftReviewBanner';
import { useTest, useUpdateTest } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { pluralRu } from '@/lib/format';
import type { QuestionType, VersionStrategy } from '@/lib/types';
import {
  QUESTION_TYPE_LABELS,
  SELECTABLE_QUESTION_TYPES,
  QUESTION_DIFFICULTY_LABELS,
  QUESTION_DIFFICULTIES,
  buildTestRequest,
  emptyQuestion,
  isChoiceType,
  newLocalId,
  questionFromResponse,
  questionToRequest,
  validateQuestions,
  type QuestionDraft,
} from '@/lib/testQuestions';
import { VersionDecisionModal } from './modals/VersionDecisionModal';
import {
  mapTestActivationError,
  violationsByQuestionIndex,
  type TestActivationViolation,
} from './modals/testActivationHelpers';

function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  showDraftUi = true,
  invalidMessages = [],
}: {
  question: QuestionDraft;
  index: number;
  total: number;
  onChange: (next: QuestionDraft) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  showDraftUi?: boolean;
  invalidMessages?: string[];
}) {
  function setType(type: QuestionType) {
    const next = { ...question, type };
    if (isChoiceType(type) && question.options.length < 2) {
      next.options = [
        { localId: newLocalId(), text: '', isCorrect: true },
        { localId: newLocalId(), text: '', isCorrect: false },
      ];
    }
    if (!isChoiceType(type)) next.options = [];
    onChange(next);
  }

  return (
    <div
      id={`question-card-${index}`}
      className={
        invalidMessages.length > 0
          ? 'rounded-xl border border-red-300 bg-red-50/40 p-4'
          : showDraftUi && question.isDraft
            ? 'rounded-xl border border-amber-200 bg-amber-50/40 p-4'
            : 'rounded-xl border border-slate-200 bg-white p-4'
      }
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <GripVertical className="h-4 w-4 text-slate-300" />
          <span className="text-sm font-semibold text-slate-800">Вопрос {index + 1}</span>
          {showDraftUi && question.isDraft && <DraftQuestionBadge />}
          {invalidMessages.length > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Невалиден
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
            title="Выше"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
            title="Ниже"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
            title="Удалить"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Тип вопроса" required>
          <Select value={question.type} onChange={(e) => setType(e.target.value as QuestionType)}>
            {SELECTABLE_QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Балл" required>
          <TextInput
            type="number"
            min={0.5}
            step={0.5}
            value={question.maxScore}
            onChange={(e) => onChange({ ...question, maxScore: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field label="Тема">
          <TextInput
            value={question.topic}
            onChange={(e) => onChange({ ...question, topic: e.target.value })}
            placeholder="Например, Алгебра"
          />
        </Field>
        <Field label="Сложность">
          <Select
            value={question.difficulty}
            onChange={(e) =>
              onChange({ ...question, difficulty: e.target.value as QuestionDraft['difficulty'] })
            }
          >
            <option value="">Не указана</option>
            {QUESTION_DIFFICULTIES.map((level) => (
              <option key={level} value={level}>
                {QUESTION_DIFFICULTY_LABELS[level]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Текст вопроса" required>
          <TextArea
            value={question.text}
            onChange={(e) => onChange({ ...question, text: e.target.value })}
            placeholder="Сформулируйте вопрос для поступающего"
          />
        </Field>
      </div>

      {isChoiceType(question.type) && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Варианты ответа</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() =>
                onChange({
                  ...question,
                  options: [...question.options, { localId: newLocalId(), text: '', isCorrect: false }],
                })
              }
            >
              Вариант
            </Button>
          </div>
          {question.options.map((opt, optIndex) => (
            <div key={opt.localId} className="flex items-center gap-2">
              <input
                type={question.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                checked={opt.isCorrect}
                onChange={() => {
                  const options = question.options.map((o, i) => {
                    if (question.type === 'SINGLE_CHOICE') return { ...o, isCorrect: i === optIndex };
                    if (i === optIndex) return { ...o, isCorrect: !o.isCorrect };
                    return o;
                  });
                  onChange({ ...question, options });
                }}
                className="h-4 w-4 shrink-0 accent-brand-500"
                title="Правильный ответ"
              />
              <TextInput
                value={opt.text}
                onChange={(e) => {
                  const options = question.options.map((o, i) =>
                    i === optIndex ? { ...o, text: e.target.value } : o,
                  );
                  onChange({ ...question, options });
                }}
                placeholder={`Вариант ${optIndex + 1}`}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...question,
                    options: question.options.filter((_, i) => i !== optIndex),
                  })
                }
                disabled={question.options.length <= 2}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {question.type === 'OPEN_TEXT' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Эталонный ответ">
            <TextArea
              value={question.referenceAnswer}
              onChange={(e) => onChange({ ...question, referenceAnswer: e.target.value })}
              placeholder="Для проверки администратором или AI"
            />
          </Field>
          <Field label="Критерии оценки">
            <TextArea
              value={question.gradingCriteria}
              onChange={(e) => onChange({ ...question, gradingCriteria: e.target.value })}
              placeholder="По каким правилам выставлять балл"
            />
          </Field>
        </div>
      )}

      {question.type === 'OPEN_TEXT' && (
        <div className="mt-4">
          <Toggle
            checked={question.allowPhoto}
            onChange={(v) => onChange({ ...question, allowPhoto: v })}
            label="Разрешить прикрепить фото к ответу"
          />
        </div>
      )}

      {invalidMessages.length > 0 && (
        <ul className="mt-4 list-inside list-disc space-y-1 text-xs text-red-600">
          {invalidMessages.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TestQuestionsPage() {
  const { testId: testIdParam } = useParams();
  const testId = Number(testIdParam);
  const navigate = useNavigate();
  const toast = useToast();

  const { data: test, isLoading, isError, error, refetch } = useTest(
    Number.isFinite(testId) ? testId : null,
  );
  const update = useUpdateTest();

  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [activationViolations, setActivationViolations] = useState<TestActivationViolation[]>([]);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [hadDraftsOnOpen, setHadDraftsOnOpen] = useState(false);

  const draftCount = useMemo(() => questions.filter((q) => q.isDraft).length, [questions]);
  const invalidByIndex = useMemo(
    () => violationsByQuestionIndex(activationViolations),
    [activationViolations],
  );
  const isAi = test?.useAiGeneration === true;
  const showDraftUi = isAi;

  useEffect(() => {
    if (!test) return;
    const loaded = (test.questions ?? []).map(questionFromResponse);
    setQuestions(loaded);
    setHadDraftsOnOpen(loaded.some((q) => q.isDraft));
    // Только при первой загрузке теста — не перетирать правки админа при фоновом рефетче.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test?.id]);

  useEffect(() => {
    if (activationViolations.length === 0) return;
    const firstIndex = activationViolations
      .map((v) => v.questionOrderIndex)
      .filter((index): index is number => index != null)
      .sort((a, b) => a - b)[0];
    if (firstIndex == null) return;
    requestAnimationFrame(() => {
      document.getElementById(`question-card-${firstIndex}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  }, [activationViolations]);

  const pending = update.isPending;

  function goBack() {
    navigate(-1);
  }

  async function save(versionStrategy?: VersionStrategy) {
    if (!test) return;
    const validation = validateQuestions(questions, test.minScore);
    if (validation) {
      setFormError(validation);
      setActivationViolations([]);
      return;
    }

    setFormError(null);
    setActivationViolations([]);

    const body = buildTestRequest(test, questions.map(questionToRequest), versionStrategy);

    try {
      await update.mutateAsync({ id: test.id, body });
      if (hadDraftsOnOpen) {
        toast.success(
          versionStrategy === 'NEW_VERSION'
            ? 'Создана новая версия — черновики опубликованы'
            : 'Вопросы проверены и опубликованы',
        );
      } else {
        toast.success(versionStrategy === 'NEW_VERSION' ? 'Создана новая версия с вопросами' : 'Вопросы сохранены');
      }
      setDecisionOpen(false);
      goBack();
    } catch (err) {
      if (err instanceof ApiError && err.isVersionDecision) {
        setDecisionOpen(true);
        return;
      }
      const mapped = mapTestActivationError(err);
      setActivationViolations(mapped.violations);
      setFormError(mapped.form ?? (mapped.violations.length > 0 ? null : 'Не удалось сохранить вопросы'));
    }
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  if (testIdParam != null && (!Number.isFinite(testId) || testId <= 0)) {
    return <ErrorBlock message="Некорректный идентификатор теста." />;
  }

  return (
    <div className="pb-24">
      <button
        onClick={goBack}
        className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </button>

      {isLoading ? (
        <div className="card">
          <LoadingBlock label="Загрузка вопросов…" />
        </div>
      ) : isError || !test ? (
        <div className="card">
          <ErrorBlock
            message={error instanceof ApiError ? error.message : 'Не удалось загрузить тест'}
            onRetry={refetch}
          />
        </div>
      ) : (
        <>
          <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
            Вопросы: {test.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {test.subjectName} · {test.grade}
            {showDraftUi && draftCount > 0 ? ` · ${draftCount} черновиков` : ''}
          </p>

          <div className="mt-6 space-y-4">
            {formError && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
                {formError}
              </div>
            )}

            {activationViolations.some((v) => v.questionOrderIndex == null) && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
                <ul className="list-inside list-disc space-y-1">
                  {activationViolations
                    .filter((v) => v.questionOrderIndex == null)
                    .map((v) => (
                      <li key={v.code}>{v.message}</li>
                    ))}
                </ul>
              </div>
            )}

            {showDraftUi && (
              <DraftReviewBanner draftCount={draftCount}>
                {test.assignmentCount > 0 && (
                  <p className="mt-2 text-xs text-amber-800">
                    Тест уже назначался — при сохранении выберите стратегию версии.
                  </p>
                )}
              </DraftReviewBanner>
            )}

            {questions.length === 0 ? (
              <EmptyBlock
                title="В тесте пока нет вопросов"
                description="Добавьте хотя бы один вопрос, чтобы активировать тест."
                action={
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setQuestions([emptyQuestion()])}>
                    Добавить первый вопрос
                  </Button>
                }
              />
            ) : (
              <>
                <div className="space-y-3">
                  {questions.map((q, index) => (
                    <QuestionEditor
                      key={q.localId}
                      question={q}
                      index={index}
                      total={questions.length}
                      showDraftUi={showDraftUi}
                      invalidMessages={(invalidByIndex.get(index) ?? []).map((v) => v.message)}
                      onChange={(next) =>
                        setQuestions((prev) => prev.map((item, i) => (i === index ? next : item)))
                      }
                      onRemove={() => setQuestions((prev) => prev.filter((_, i) => i !== index))}
                      onMoveUp={() => moveQuestion(index, -1)}
                      onMoveDown={() => moveQuestion(index, 1)}
                    />
                  ))}
                </div>
                <Button
                  variant="secondary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
                >
                  Добавить вопрос
                </Button>
              </>
            )}
          </div>

          <div className="sticky bottom-0 -mx-8 -mb-8 mt-6 flex items-center justify-end gap-3 border-t border-slate-100 bg-white/95 px-8 py-4 backdrop-blur">
            {showDraftUi && draftCount > 0 && (
              <span className="mr-auto text-xs text-amber-700">
                Сохранение опубликует {draftCount} {pluralRu(draftCount, ['черновик', 'черновика', 'черновиков'])}
              </span>
            )}
            <Button variant="secondary" onClick={goBack} disabled={pending}>
              Отмена
            </Button>
            <Button loading={pending} onClick={() => void save()}>
              {showDraftUi && draftCount > 0 ? 'Сохранить и опубликовать' : 'Сохранить вопросы'}
            </Button>
          </div>
        </>
      )}

      <VersionDecisionModal
        open={decisionOpen}
        onClose={() => setDecisionOpen(false)}
        loading={pending}
        onChoose={(strategy) => void save(strategy)}
      />
    </div>
  );
}

export { QuestionEditor };
