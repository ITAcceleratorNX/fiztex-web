import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { AnswerScoreField } from '@/components/ui/AnswerScoreField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AiJobProgress } from '@/components/ui/AiJobProgress';
import { MathText } from '@/components/ui/MathText';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import {
  useAiRecommendation,
  useHomeworkAiQuota,
  useLastGradeSuggestion,
  useSetAnswerScores,
  useSuggestGrades,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { AiRecommendation, HomeworkQuestion, TeacherAnswer } from '@/lib/homeworkAiApi';
import { homeworkAnswersApi } from '@/lib/homeworkAiApi';
import { AttachmentThumb } from './AttachmentLink';
import { cx, pluralRu } from '@/lib/format';
import {
  isScoreDraftDirty,
  mergeScoreDrafts,
  scoreDraftFrom,
  scoreFromDraft,
  type AnswerScoreDraft,
  type AnswerScoreDrafts,
} from './homeworkAnswerReviewModel';

const TYPE_LABELS = {
  SINGLE_CHOICE: 'Один ответ',
  MULTIPLE_CHOICE: 'Несколько ответов',
  OPEN_TEXT: 'Развёрнутый ответ',
} as const;

/**
 * Разбор ответов теста внутри существующей проверки работы.
 *
 * <p>Это не оценка в журнале. Здесь учитель только разбирает каждый ответ и при желании
 * сохраняет свой балл; отдельный {@code SubmissionGradeBlock} остаётся за пределами
 * компонента и создаёт Grade явным действием.
 */
export function HomeworkTestAnswerReview({
  homeworkId,
  studentProfileId,
  answers,
  questions,
  questionsLoading = false,
  questionsError = false,
  onRetryQuestions,
  onRefreshAnswers,
}: {
  homeworkId: number;
  studentProfileId: number;
  answers: TeacherAnswer[];
  questions?: HomeworkQuestion[];
  questionsLoading?: boolean;
  questionsError?: boolean;
  onRetryQuestions: () => void;
  onRefreshAnswers: () => Promise<unknown> | void;
}) {
  const toast = useToast();
  const suggestGrades = useSuggestGrades(homeworkId, studentProfileId);
  const setScores = useSetAnswerScores(homeworkId, studentProfileId);
  const openAnswers = useMemo(() => answers.filter((answer) => answer.type === 'OPEN_TEXT'), [answers]);
  const quotaQuery = useHomeworkAiQuota(openAnswers.length > 0);

  const [drafts, setDrafts] = useState<AnswerScoreDrafts>({});
  const [savingAnswerId, setSavingAnswerId] = useState<number | null>(null);

  /**
   * Состояние задачи спрашивается у сервера, а не хранится в браузере: учитель, открывший
   * проверку на другом устройстве или в другом окне, обязан увидеть ту же задачу. Раньше
   * идентификатор лежал в localStorage, и на втором устройстве экран выглядел так, будто
   * подсказки не запускали, — второе нажатие стоило вторых денег.
   */
  const suggestionQuery = useLastGradeSuggestion(homeworkId, studentProfileId);
  const suggestionJob = suggestionQuery.data ?? undefined;
  const recommendationQuery = useAiRecommendation(homeworkId, studentProfileId);

  /**
   * Задача, за концом которой мы следим. Нужна, чтобы отличить «закончилась при нас» от
   * «была закончена ещё до открытия экрана»: во втором случае тост «подсказки готовы» —
   * это сообщение о том, что учитель и так видит в баллах.
   */
  const watchedJobId = useRef<number | null>(null);

  useEffect(() => {
    setDrafts((previous) => mergeScoreDrafts(answers, previous));
  }, [answers]);

  // Один и тот же компонент может остаться смонтированным при переходе к соседнему ученику.
  useEffect(() => {
    watchedJobId.current = null;
  }, [homeworkId, studentProfileId]);

  const suggestionStatus = suggestionJob?.status;
  const suggestionJobId = suggestionJob?.id;
  const isSuggestionRunning = suggestionStatus === 'PENDING' || suggestionStatus === 'RUNNING';

  // Задача, начатая до открытия экрана, тоже наша: за её концом следим так же.
  useEffect(() => {
    if (isSuggestionRunning && suggestionJobId != null) {
      watchedJobId.current = suggestionJobId;
    }
  }, [isSuggestionRunning, suggestionJobId]);

  useEffect(() => {
    if (suggestionJobId == null || watchedJobId.current !== suggestionJobId) return;
    if (suggestionStatus !== 'DONE' && suggestionStatus !== 'FAILED') return;

    watchedJobId.current = null;

    if (suggestionStatus === 'DONE') {
      void onRefreshAnswers();
      // Рекомендация появляется последним шагом проверки: перечитываем её тогда же, когда
      // обновляем баллы, — опрашивать её всё время, что учитель читает работу, незачем.
      void recommendationQuery.refetch();
      toast.success(
        suggestionJob?.warningMessage
          ? `Подсказки ИИ готовы. ${suggestionJob.warningMessage}`
          : 'Подсказки ИИ готовы — проверьте их перед сохранением баллов',
      );
      return;
    }
    toast.error('Не удалось подготовить подсказки ИИ. Баллы можно поставить вручную.');
    // recommendationQuery намеренно не в зависимостях: у объекта запроса новая ссылка на
    // каждый рендер, и эффект перезапускался бы бесконечно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefreshAnswers, suggestionJob?.warningMessage, suggestionJobId, suggestionStatus, toast]);

  const questionsById = useMemo(
    () =>
      new Map(
        (questions ?? [])
          .filter((question): question is HomeworkQuestion & { id: number } => question.id != null)
          .map((question) => [question.id, question]),
      ),
    [questions],
  );
  const aiUnavailableText = aiAvailabilityText(quotaQuery.data);

  // Стабильная ссылка: AttachmentThumb перезагружает картинку при смене загрузчика, и
  // новая функция на каждый рендер означала бы бесконечную перезагрузку фотографий.
  const loadPhoto = useCallback(
    (photoId: number) => homeworkAnswersApi.photoBlob(homeworkId, studentProfileId, photoId),
    [homeworkId, studentProfileId],
  );

  async function startSuggestion() {
    try {
      const job = await suggestGrades.mutateAsync(crypto.randomUUID());
      if (job.id == null) throw new Error('AI job id is missing');
      // Сервер мог вернуть уже идущую или уже законченную задачу по этой попытке —
      // повторный запрос по неизменённой работе намеренно бесплатный.
      watchedJobId.current = job.id;
      await suggestionQuery.refetch();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.message
          : 'Не удалось запустить подсказки ИИ. Баллы можно поставить вручную.',
      );
    }
  }

  async function saveScore(answer: TeacherAnswer) {
    if (answer.id == null) return;
    const draft = drafts[answer.id] ?? scoreDraftFrom(answer);
    const finalScore = scoreFromDraft(draft, answer.maxScore);
    if (finalScore == null) {
      toast.error('Введите балл в допустимом диапазоне перед сохранением');
      return;
    }

    setSavingAnswerId(answer.id);
    try {
      const saved = await setScores.mutateAsync({
        items: [
          {
            answerId: answer.id,
            finalScore,
            // Пока отдельного поля комментария нет, существующий комментарий сохраняем.
            comment: draft.comment.trim() || undefined,
          },
        ],
      });
      const updated = saved.find((item) => item.id === answer.id);
      if (updated) {
        setDrafts((previous) => ({ ...previous, [answer.id as number]: scoreDraftFrom(updated) }));
      }
      toast.success('Балл сохранён');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Не удалось сохранить балл');
    } finally {
      setSavingAnswerId(null);
    }
  }

  if (questionsLoading) {
    return (
      <section className="card">
        <LoadingBlock label="Загрузка вопросов теста…" />
      </section>
    );
  }

  if (questionsError) {
    return (
      <section className="card">
        <ErrorBlock message="Не удалось загрузить вопросы теста" onRetry={onRetryQuestions} />
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="test-review-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="test-review-heading" className="text-base font-semibold text-ink">
            Проверка теста
          </h2>
          <p className="mt-1 text-13 text-muted">
            Баллы за вопросы и оценка в журнале — разные действия.
          </p>
        </div>
        <Badge tone="gray">
          {answers.length} {pluralRu(answers.length, ['вопрос', 'вопроса', 'вопросов'])}
        </Badge>
      </div>

      {openAnswers.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-bg px-3 py-3">
          <div>
            <p className="text-13 font-medium text-ink">Открытые ответы</p>
            <p className="mt-0.5 text-11 text-muted">
              ИИ предлагает балл, но решение и сохранение остаются за учителем.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={
              suggestGrades.isPending || isSuggestionRunning || aiUnavailableText != null
            }
            loading={suggestGrades.isPending}
            onClick={() => void startSuggestion()}
          >
            <Sparkles className="size-4" aria-hidden />
            {isSuggestionRunning ? 'Проверяю ответы…' : 'Получить подсказки ИИ'}
          </Button>
        </div>
      ) : (
        <NoticeBar tone="soft">
          В тесте нет открытых ответов — все вопросы уже проверены автоматически.
        </NoticeBar>
      )}

      {aiUnavailableText && <NoticeBar tone="soft">{aiUnavailableText}</NoticeBar>}

      {recommendationQuery.data && <RecommendationCard recommendation={recommendationQuery.data} />}

      {suggestionJob && (
        <AiJobProgress
          job={suggestionJob}
          fallbackAction={<p className="text-11 text-muted">Баллы можно поставить вручную ниже.</p>}
        />
      )}

      <div className="flex flex-col gap-3">
        {answers.map((answer, index) => {
          const answerId = answer.id;
          const draft = answerId != null ? drafts[answerId] ?? scoreDraftFrom(answer) : scoreDraftFrom(answer);
          const dirty = isScoreDraftDirty(draft, answer);
          return (
            <TestAnswerCard
              key={answerId ?? `answer-${index}`}
              answer={answer}
              loadPhoto={loadPhoto}
              question={answer.questionId != null ? questionsById.get(answer.questionId) : undefined}
              index={index + 1}
              draft={draft}
              disabled={setScores.isPending || answerId == null}
              saving={savingAnswerId === answerId}
              dirty={dirty}
              onScoreChange={(score) => {
                if (answerId == null) return;
                setDrafts((previous) => ({ ...previous, [answerId]: { ...draft, score } }));
              }}
              onAcceptSuggestion={() => {
                if (answerId == null || answer.aiSuggestedScore == null) return;
                setDrafts((previous) => ({
                  ...previous,
                  [answerId]: { ...draft, score: String(answer.aiSuggestedScore) },
                }));
              }}
              onSave={() => void saveScore(answer)}
            />
          );
        })}
      </div>
    </section>
  );
}

function TestAnswerCard({
  answer,
  loadPhoto,
  question,
  index,
  draft,
  disabled,
  saving,
  dirty,
  onScoreChange,
  onAcceptSuggestion,
  onSave,
}: {
  answer: TeacherAnswer;
  loadPhoto: (photoId: number) => Promise<Blob>;
  question?: HomeworkQuestion;
  index: number;
  draft: AnswerScoreDraft;
  disabled: boolean;
  saving: boolean;
  dirty: boolean;
  onScoreChange: (score: string) => void;
  onAcceptSuggestion: () => void;
  onSave: () => void;
}) {
  const type = answer.type ?? 'SINGLE_CHOICE';
  const choice = type !== 'OPEN_TEXT';

  return (
    <article className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-13 font-semibold text-ink">Вопрос {index}</span>
        <Badge tone="gray">{TYPE_LABELS[type]}</Badge>
      </div>

      <MathText text={answer.questionText ?? question?.text} className="mt-2 block text-sm font-medium text-ink" />

      {choice ? (
        <ChoiceAnswer answer={answer} question={question} />
      ) : (
        <OpenTextAnswer answer={answer} loadPhoto={loadPhoto} />
      )}

      <AnswerScoreField
        inputId={`answer-score-${answer.id ?? index}`}
        score={draft.score}
        maxScore={answer.maxScore}
        autoScore={answer.autoScore}
        aiSuggestedScore={answer.aiSuggestedScore}
        aiRationale={answer.aiRationale}
        disabled={disabled}
        saving={saving}
        dirty={dirty}
        onScoreChange={onScoreChange}
        onAcceptSuggestion={onAcceptSuggestion}
        onSave={onSave}
      />
    </article>
  );
}

/**
 * Рекомендация за работу целиком (ТЗ §6).
 *
 * <p>Оценку здесь выбрала не модель: баллы сложила система, процент перевела в оценку
 * школьная шкала. Модель написала обоснование и перечень ошибок — и об этом на карточке
 * сказано прямо, иначе «рекомендует ИИ» читается как «так решил компьютер».
 */
function RecommendationCard({ recommendation }: { recommendation: AiRecommendation }) {
  const issues = recommendation.issues ?? [];
  const closedMax = Number(recommendation.closedMax ?? 0);

  return (
    <section
      className="rounded-xl border border-line bg-neutral-bg p-4"
      aria-label="Рекомендация за работу"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-11 font-semibold uppercase tracking-wide text-subtle">
          Рекомендация за работу
        </p>
        <p className="text-11 text-muted">
          {formatScore(recommendation.score)} из {formatScore(recommendation.maxScore)} баллов
          {recommendation.percent != null && ` · ${recommendation.percent}%`}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {recommendation.scaleCode ? (
          <span className="rounded-lg bg-white px-3 py-1.5 text-lg font-semibold text-ink ring-1 ring-line">
            {recommendation.scaleCode}
          </span>
        ) : (
          <span className="text-13 text-muted">
            Оценка не выведена: школа не задала пороги. Решите по баллам.
          </span>
        )}
        <p className="text-11 text-muted">
          Не оценка: в журнал ничего не попадёт, пока вы не выставите её сами.
        </p>
      </div>

      <MathText text={recommendation.summary} className="mt-3 block text-13 text-ink" />

      {issues.length > 0 && (
        <ul className="mt-3 list-inside list-disc space-y-1 text-13 text-ink">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      {closedMax > 0 && (
        <p className="mt-3 text-11 text-muted">
          Из них {formatScore(recommendation.closedScore)} из {formatScore(recommendation.closedMax)}{' '}
          за закрытые вопросы — их проверила система, ИИ их не пересматривал.
        </p>
      )}
    </section>
  );
}

/** Балл без хвоста нулей: «2», а не «2.00» — это читает человек. */
function formatScore(value: number | undefined): string {
  if (value == null) return '0';
  return String(Number(value)).replace('.', ',');
}

function ChoiceAnswer({ answer, question }: { answer: TeacherAnswer; question?: HomeworkQuestion }) {
  const selected = new Set(answer.selectedOptionIds ?? []);
  const correct = new Set(
    answer.correctOptionIds ?? question?.options?.filter((option) => option.correct).map((option) => option.id ?? -1) ?? [],
  );
  const options = question?.options ?? [];

  if (options.length === 0) {
    return (
      <p className="mt-3 rounded-xl bg-neutral-bg px-3 py-2 text-13 text-muted">
        Варианты ответа недоступны. Автопроверка и ручная корректировка балла остаются доступны.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-2" aria-label="Выбранные и правильные варианты">
      {options.map((option) => {
        const optionId = option.id;
        const wasSelected = optionId != null && selected.has(optionId);
        const isCorrect = optionId != null && correct.has(optionId);
        const state = isCorrect ? 'correct' : wasSelected ? 'wrong' : 'neutral';
        return (
          <li
            key={optionId ?? option.text}
            className={cx(
              'flex items-start gap-2 rounded-xl px-3 py-2 text-13 ring-1',
              state === 'correct'
                ? 'bg-success-bg text-ink ring-success-border/30'
                : state === 'wrong'
                  ? 'bg-danger-bg text-ink ring-red-200'
                  : 'bg-white text-muted ring-line',
            )}
          >
            {isCorrect ? (
              <Check className="mt-0.5 size-4 shrink-0 text-success-fg" aria-hidden />
            ) : wasSelected ? (
              <X className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
            ) : (
              <span className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <MathText text={option.text} className="min-w-0 flex-1" />
            {(isCorrect || wasSelected) && (
              <span className="shrink-0 text-11 font-medium text-muted">
                {isCorrect && wasSelected
                  ? 'верно выбрал'
                  : isCorrect
                    ? 'верный ответ'
                    : 'выбрал ученик'}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function OpenTextAnswer({
  answer,
  loadPhoto,
}: {
  answer: TeacherAnswer;
  loadPhoto: (photoId: number) => Promise<Blob>;
}) {
  const hasReference = Boolean(answer.referenceAnswer?.trim() || answer.gradingCriteria?.trim());
  const photos = answer.photos ?? [];
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="rounded-xl bg-neutral-bg px-3 py-3">
        <p className="text-11 font-semibold uppercase tracking-wide text-subtle">Ответ ученика</p>
        {answer.openText?.trim() ? (
          <MathText text={answer.openText} className="mt-1 block text-13 text-ink" />
        ) : photos.length === 0 ? (
          <p className="mt-1 text-13 italic text-muted">Нет ответа</p>
        ) : (
          <p className="mt-1 text-13 italic text-muted">Решение на фотографии</p>
        )}

        {/*
          Снимки решения рядом с текстом, а не в общем списке вложений работы: учитель
          проверяет по одному вопросу за раз, и «какое фото к какой задаче» не должно
          быть его задачей.
        */}
        {photos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Фотографии решения">
            {photos.map((photo, photoIndex) => (
              <AttachmentThumb
                key={photo.id ?? `photo-${photoIndex}`}
                attachment={photo}
                load={loadPhoto}
              />
            ))}
          </div>
        )}
      </div>

      {hasReference && (
        <details className="rounded-xl border border-line px-3 py-2.5">
          <summary className="cursor-pointer text-13 font-medium text-link">
            Эталон и критерии для проверки
          </summary>
          <div className="mt-3 flex flex-col gap-3 text-13 text-ink">
            {answer.referenceAnswer?.trim() && (
              <div>
                <p className="text-11 font-semibold uppercase tracking-wide text-subtle">Эталонный ответ</p>
                <MathText text={answer.referenceAnswer} className="mt-1 block" />
              </div>
            )}
            {answer.gradingCriteria?.trim() && (
              <div>
                <p className="text-11 font-semibold uppercase tracking-wide text-subtle">Критерии</p>
                <MathText text={answer.gradingCriteria} className="mt-1 block" />
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function aiAvailabilityText(quota: { enabled?: boolean; remaining?: number } | undefined): string | null {
  if (!quota) return null;
  if (quota.enabled === false) return 'Подсказки ИИ сейчас недоступны. Баллы можно поставить вручную.';
  if ((quota.remaining ?? 1) <= 0) return 'Лимит подсказок ИИ на сегодня исчерпан. Баллы можно поставить вручную.';
  return null;
}
