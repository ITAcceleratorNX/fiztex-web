import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { DraftQuestionBadge } from '@/components/ui/DraftQuestionBadge';
import { TestStatusBadge } from '@/components/ui/TestStatusBadge';
import { useTests, useTestsByGrade, useTestQuestions } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { pluralRu } from '@/lib/format';
import { QUESTION_TYPE_LABELS, difficultyLabel } from '@/lib/testQuestions';
import type { QuestionResponse, Test } from '@/lib/types';

/**
 * Выбор вопроса в чужом тесте: класс → тест → вопрос.
 *
 * <p>Окно не закрывается после добавления: администратор обычно берёт из одного теста несколько
 * вопросов, и каждый раз проходить цепочку заново было бы издевательством.
 */
export function AddFromTestModal({
  open,
  onClose,
  currentTestId,
  addedSourceIds,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  currentTestId: number;
  /** id исходных вопросов, уже добавленных в текущий тест (включая несохранённые копии). */
  addedSourceIds: Set<number>;
  onAdd: (question: QuestionResponse, sourceTest: Test) => void;
}) {
  const [grade, setGrade] = useState<string | null>(null);
  const [sourceTest, setSourceTest] = useState<Test | null>(null);

  const allTests = useTests();
  const gradeTests = useTestsByGrade(grade);
  const questions = useTestQuestions(sourceTest?.id ?? null);

  useEffect(() => {
    if (!open) return;
    setGrade(null);
    setSourceTest(null);
  }, [open]);

  const grades = useMemo(() => {
    const unique = new Set((allTests.data ?? []).map((t) => t.grade).filter(Boolean));
    return [...unique].sort((a, b) => collateGrades(a, b));
  }, [allTests.data]);

  const tests = useMemo(
    () => (gradeTests.data ?? []).filter((t) => t.id !== currentTestId),
    [gradeTests.data, currentTestId],
  );

  const step = sourceTest ? 3 : grade ? 2 : 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить вопрос из другого теста"
      subtitle={
        step === 1
          ? 'Шаг 1 из 3 — выберите класс'
          : step === 2
            ? `Шаг 2 из 3 — тесты класса «${grade}»`
            : `Шаг 3 из 3 — вопросы теста «${sourceTest?.title}»`
      }
      footer={
        <>
          {step > 1 && (
            <Button
              variant="secondary"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => (sourceTest ? setSourceTest(null) : setGrade(null))}
            >
              Назад
            </Button>
          )}
          <Button onClick={onClose}>Готово</Button>
        </>
      }
    >
      {step === 1 && (
        <StepBlock
          isLoading={allTests.isLoading}
          isError={allTests.isError}
          error={allTests.error}
          onRetry={allTests.refetch}
          emptyTitle="Пока нет ни одного теста"
          emptyDescription="Вопросы можно копировать только из уже созданных тестов."
          isEmpty={grades.length === 0}
        >
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {grades.map((g) => (
              <li key={g}>
                <button
                  type="button"
                  onClick={() => setGrade(g)}
                  className="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                >
                  {g}
                </button>
              </li>
            ))}
          </ul>
        </StepBlock>
      )}

      {step === 2 && (
        <StepBlock
          isLoading={gradeTests.isLoading}
          isError={gradeTests.isError}
          error={gradeTests.error}
          onRetry={gradeTests.refetch}
          emptyTitle="В этом классе нет других тестов"
          emptyDescription="Выберите другой класс."
          isEmpty={tests.length === 0}
        >
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {tests.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSourceTest(t)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {t.title}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {t.subjectName} · {t.questionCount}{' '}
                      {pluralRu(t.questionCount, ['вопрос', 'вопроса', 'вопросов'])}
                    </span>
                  </span>
                  <TestStatusBadge status={t.status} />
                </button>
              </li>
            ))}
          </ul>
        </StepBlock>
      )}

      {step === 3 && sourceTest && (
        <StepBlock
          isLoading={questions.isLoading}
          isError={questions.isError}
          error={questions.error}
          onRetry={questions.refetch}
          emptyTitle="В этом тесте нет вопросов"
          emptyDescription="Выберите другой тест."
          isEmpty={(questions.data ?? []).length === 0}
        >
          <ul className="space-y-2">
            {(questions.data ?? []).map((q, index) => {
              const added = addedSourceIds.has(q.id);
              return (
                <li
                  key={q.id}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">
                          Вопрос {index + 1}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {QUESTION_TYPE_LABELS[q.type]}
                        </span>
                        {q.topic && <span className="text-xs text-slate-400">{q.topic}</span>}
                        {difficultyLabel(q.difficulty) && (
                          <span className="text-xs text-slate-400">
                            {difficultyLabel(q.difficulty)}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">{q.maxScore} б.</span>
                        {q.isDraft && <DraftQuestionBadge />}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{q.text}</p>
                      {q.options.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {q.options.map((o) => (
                            <li
                              key={o.id}
                              className={
                                o.isCorrect
                                  ? 'text-xs font-medium text-emerald-700'
                                  : 'text-xs text-slate-500'
                              }
                            >
                              {o.isCorrect ? '✓ ' : '• '}
                              {o.text}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {added ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-500">
                        <Check className="h-3.5 w-3.5" />
                        Уже добавлен
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() => onAdd(q, sourceTest)}
                      >
                        Добавить
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </StepBlock>
      )}
    </Modal>
  );
}

function StepBlock({
  isLoading,
  isError,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  if (isLoading) return <LoadingBlock label="Загрузка…" />;
  if (isError) {
    return (
      <ErrorBlock
        message={error instanceof ApiError ? error.message : 'Не удалось загрузить список'}
        onRetry={onRetry}
      />
    );
  }
  if (isEmpty) return <EmptyBlock title={emptyTitle} description={emptyDescription} />;
  return <>{children}</>;
}

/** «10 класс» должен идти после «9 класс», а не между «1» и «2», как при обычной сортировке строк. */
function collateGrades(a: string, b: string): number {
  const numberOf = (value: string) => Number.parseInt(value, 10);
  const left = numberOf(a);
  const right = numberOf(b);
  if (Number.isNaN(left) || Number.isNaN(right)) return a.localeCompare(b, 'ru');
  return left - right;
}
