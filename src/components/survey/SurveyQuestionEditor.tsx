import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useSaveSurveyQuestions, useSurveyQuestions } from '@/hooks/surveyQueries';
import { ApiError } from '@/lib/api';
import {
  SURVEY_QUESTION_TYPE_LABELS,
  SURVEY_QUESTION_TYPES,
  emptySurveyQuestion,
  isSurveyChoiceType,
  newLocalId,
  surveyQuestionFromView,
  surveyQuestionToRequest,
  validateSurveyQuestions,
  withSurveyQuestionType,
  type SurveyQuestionDraft,
} from '@/lib/surveyQuestions';
import type { SurveyQuestionType } from '@/lib/surveyApi';

/**
 * Редактор вопросов опроса. Новый компонент, а не переиспользование `QuestionEditor`
 * вступительных тестов: там у каждого вопроса баллы и правильный ответ, здесь этого нет
 * ни в модели (`surveyQuestions.ts`), ни на экране — переключателя «правильный вариант»
 * тут нет в принципе, потому что оценивать здесь нечего.
 */
export function SurveyQuestionEditor({ surveyId, canEdit }: { surveyId: number; canEdit: boolean }) {
  const questionsQuery = useSurveyQuestions(surveyId);
  const saveQuestions = useSaveSurveyQuestions(surveyId);
  const toast = useToast();

  const [drafts, setDrafts] = useState<SurveyQuestionDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Черновик правится локально, пока не сохранён — перечитывать список поверх правок нельзя.
  useEffect(() => {
    if (questionsQuery.data && drafts === null) {
      setDrafts(questionsQuery.data.map(surveyQuestionFromView));
    }
  }, [questionsQuery.data, drafts]);

  if (questionsQuery.isLoading || drafts === null) {
    return <LoadingBlock label="Загрузка вопросов…" />;
  }
  if (questionsQuery.isError) {
    return (
      <ErrorBlock
        message={
          questionsQuery.error instanceof ApiError
            ? questionsQuery.error.message
            : 'Не удалось загрузить вопросы'
        }
        onRetry={() => void questionsQuery.refetch()}
      />
    );
  }

  function updateQuestion(localId: string, patch: Partial<SurveyQuestionDraft>) {
    setDrafts((prev) => (prev ?? []).map((q) => (q.localId === localId ? { ...q, ...patch } : q)));
  }

  function changeType(localId: string, type: SurveyQuestionType) {
    setDrafts((prev) =>
      (prev ?? []).map((q) => (q.localId === localId ? withSurveyQuestionType(q, type) : q)),
    );
  }

  function addQuestion() {
    setDrafts((prev) => [...(prev ?? []), emptySurveyQuestion()]);
  }

  function removeQuestion(localId: string) {
    setDrafts((prev) => (prev ?? []).filter((q) => q.localId !== localId));
  }

  function addOption(questionLocalId: string) {
    setDrafts((prev) =>
      (prev ?? []).map((q) =>
        q.localId === questionLocalId
          ? { ...q, options: [...q.options, { localId: newLocalId(), text: '' }] }
          : q,
      ),
    );
  }

  function removeOption(questionLocalId: string, optionLocalId: string) {
    setDrafts((prev) =>
      (prev ?? []).map((q) =>
        q.localId === questionLocalId
          ? { ...q, options: q.options.filter((o) => o.localId !== optionLocalId) }
          : q,
      ),
    );
  }

  function updateOption(questionLocalId: string, optionLocalId: string, text: string) {
    setDrafts((prev) =>
      (prev ?? []).map((q) =>
        q.localId === questionLocalId
          ? {
              ...q,
              options: q.options.map((o) => (o.localId === optionLocalId ? { ...o, text } : o)),
            }
          : q,
      ),
    );
  }

  async function handleSave() {
    const list = drafts ?? [];
    const validationError = validateSurveyQuestions(list);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      await saveQuestions.mutateAsync({ questions: list.map(surveyQuestionToRequest) });
      toast.success('Вопросы сохранены');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить вопросы');
    }
  }

  const list = drafts ?? [];

  return (
    <div className="space-y-4">
      {!canEdit && (
        <p className="text-sm text-slate-500">
          Опрос опубликован — вопросы теперь доступны только для просмотра.
        </p>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
          {error}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyBlock
          title="Пока нет вопросов"
          description={canEdit ? 'Добавьте хотя бы один вопрос.' : 'В опросе нет вопросов.'}
        />
      ) : (
        <div className="space-y-4">
          {list.map((question, index) => (
            <div key={question.localId} className="card space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="mt-2 text-sm font-semibold text-slate-400">{index + 1}.</span>
                <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem]">
                  <Field label="Текст вопроса">
                    <TextInput
                      value={question.text}
                      disabled={!canEdit}
                      onChange={(e) => updateQuestion(question.localId, { text: e.target.value })}
                      placeholder="Например: Насколько вам понятен материал урока?"
                    />
                  </Field>
                  <Field label="Тип ответа">
                    <Select
                      value={question.type}
                      disabled={!canEdit}
                      onChange={(e) => changeType(question.localId, e.target.value as SurveyQuestionType)}
                    >
                      {SURVEY_QUESTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {SURVEY_QUESTION_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {canEdit && (
                  <button
                    onClick={() => removeQuestion(question.localId)}
                    title="Удалить вопрос"
                    className="mt-6 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {isSurveyChoiceType(question.type) && (
                <div className="space-y-2 pl-8">
                  {question.options.map((option) => (
                    <div key={option.localId} className="flex items-center gap-2">
                      <TextInput
                        value={option.text}
                        disabled={!canEdit}
                        onChange={(e) => updateOption(question.localId, option.localId, e.target.value)}
                        placeholder="Вариант ответа"
                        className="flex-1"
                      />
                      {canEdit && question.options.length > 2 && (
                        <button
                          onClick={() => removeOption(question.localId, option.localId)}
                          title="Убрать вариант"
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => addOption(question.localId)}
                    >
                      Добавить вариант
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addQuestion}>
            Добавить вопрос
          </Button>
          <Button onClick={() => void handleSave()} loading={saveQuestions.isPending}>
            Сохранить вопросы
          </Button>
        </div>
      )}
    </div>
  );
}
