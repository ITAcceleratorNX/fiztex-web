import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { DraftQuestionBadge } from '@/components/ui/DraftQuestionBadge';
import { DraftReviewBanner } from '@/components/ui/DraftReviewBanner';
import { useTest, useUpdateTest } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import type { QuestionType, VersionStrategy } from '@/lib/types';
import {
  QUESTION_TYPE_LABELS,
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
import { VersionDecisionModal } from './VersionDecisionModal';

function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  showDraftUi = true,
}: {
  question: QuestionDraft;
  index: number;
  total: number;
  onChange: (next: QuestionDraft) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  showDraftUi?: boolean;
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
    if (type === 'PHOTO') next.allowPhoto = true;
    onChange(next);
  }

  return (
    <div
      className={
        showDraftUi && question.isDraft
          ? 'rounded-xl border border-amber-200 bg-amber-50/40 p-4'
          : 'rounded-xl border border-slate-200 bg-white p-4'
      }
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <GripVertical className="h-4 w-4 text-slate-300" />
          <span className="text-sm font-semibold text-slate-800">Вопрос {index + 1}</span>
          {showDraftUi && question.isDraft && <DraftQuestionBadge />}
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
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Балл" required>
          <TextInput
            type="number"
            min={1}
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

      {(question.type === 'OPEN_TEXT' || question.type === 'PHOTO') && (
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
    </div>
  );
}

export function TestQuestionsModal({
  open,
  onClose,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  testId: number | null;
}) {
  const { data: test, isLoading, isError, error, refetch } = useTest(open ? testId : null);
  const update = useUpdateTest();
  const toast = useToast();

  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [hadDraftsOnOpen, setHadDraftsOnOpen] = useState(false);

  const draftCount = useMemo(() => questions.filter((q) => q.isDraft).length, [questions]);
  const isAi = test?.useAiGeneration === true;
  const showDraftUi = isAi;

  useEffect(() => {
    if (!open || !test) return;
    setFormError(null);
    setDecisionOpen(false);
    const loaded = (test.questions ?? []).map(questionFromResponse);
    setQuestions(loaded);
    setHadDraftsOnOpen(loaded.some((q) => q.isDraft));
  }, [open, test]);

  const pending = update.isPending;

  async function save(versionStrategy?: VersionStrategy) {
    if (!test) return;
    const validation = validateQuestions(questions);
    if (validation) {
      setFormError(validation);
      return;
    }

    const body = buildTestRequest(
      test,
      questions.map(questionToRequest),
      versionStrategy,
    );

    try {
      await update.mutateAsync({ id: test.id, body });
      const publishedDrafts = hadDraftsOnOpen;
      if (publishedDrafts) {
        toast.success(
          versionStrategy === 'NEW_VERSION'
            ? 'Создана новая версия — черновики опубликованы'
            : 'Вопросы проверены и опубликованы',
        );
      } else {
        toast.success(versionStrategy === 'NEW_VERSION' ? 'Создана новая версия с вопросами' : 'Вопросы сохранены');
      }
      setDecisionOpen(false);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.isVersionDecision) {
        setDecisionOpen(true);
        return;
      }
      setFormError(err instanceof ApiError ? err.message : 'Не удалось сохранить вопросы');
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

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={test ? `Вопросы: ${test.title}` : 'Вопросы теста'}
        subtitle={
          test
            ? showDraftUi && draftCount > 0
              ? `${test.subjectName} · ${test.grade} · ${draftCount} черновиков`
              : `${test.subjectName} · ${test.grade}`
            : undefined
        }
        footer={
          test ? (
            <>
              {showDraftUi && draftCount > 0 && (
                <span className="mr-auto text-xs text-amber-700">
                  Сохранение опубликует {draftCount}{' '}
                  {draftCount === 1 ? 'черновик' : draftCount < 5 ? 'черновика' : 'черновиков'}
                </span>
              )}
              <Button variant="secondary" onClick={onClose} disabled={pending}>
                Отмена
              </Button>
              <Button loading={pending} onClick={() => void save()}>
                {showDraftUi && draftCount > 0 ? 'Сохранить и опубликовать' : 'Сохранить вопросы'}
              </Button>
            </>
          ) : undefined
        }
      >
        {isLoading ? (
          <LoadingBlock label="Загрузка вопросов…" />
        ) : isError || !test ? (
          <ErrorBlock
            message={error instanceof ApiError ? error.message : 'Не удалось загрузить тест'}
            onRetry={refetch}
          />
        ) : (
          <div className="space-y-4">
            {formError && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
                {formError}
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
                description="Добавьте вопросы вручную — они будут показаны поступающим при прохождении теста."
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
        )}
      </Modal>

      <VersionDecisionModal
        open={decisionOpen}
        onClose={() => setDecisionOpen(false)}
        loading={pending}
        onChoose={(strategy) => void save(strategy)}
      />
    </>
  );
}
