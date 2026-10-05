import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import {
  useHomeworkAiJob,
  useHomeworkQuestions,
  useRegenerateQuestion,
  useSaveHomeworkQuestions,
} from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { withHomeworkReturnTo } from '@/lib/homeworkListNavigation';
import { homeworkApi } from '@/lib/homeworkApi';
import { QuestionCard } from '@/components/homework/QuestionCard';
import { TestTemplateActions } from './TestTemplateActions';
import {
  emptyQuestion,
  move,
  toDraft,
  toRequest,
  validateQuestions,
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
  const cardUrl = withHomeworkReturnTo(`/homework/${id}`, useLocation().search);
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
    navigate(cardUrl);
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
        {homework?.answerFormat === 'TEST' && !dirty && !questionsQuery.isPending && !questionsQuery.isError &&
          <TestTemplateActions homeworkId={id} homeworkTitle={homework.title ?? 'Тест'}
            questionCount={questions.length} canApply={!readOnly}
            onApplied={() => { void questionsQuery.refetch(); }} />}
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
        onConfirm={() => navigate(cardUrl)}
        title="Уйти без сохранения?"
        confirmLabel="Уйти"
        danger
        message="Правки вопросов не сохранены и будут потеряны."
      />
    </div>
  );
}
