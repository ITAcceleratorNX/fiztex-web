import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MathText } from '@/components/ui/MathText';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useHomeworkAiResult } from '@/hooks/queries';
import { pluralRu } from '@/lib/format';
import type { HomeworkAiJob, HomeworkAiResult } from '@/lib/homeworkAiApi';

/**
 * Свой вариант против машинного — рядом, до решения.
 *
 * <p><b>Зачем экран.</b> Бэкенд не применяет результат поверх правок учителя и оставляет
 * выбор человеку. Пока выбор предлагался без предпросмотра, это был не выбор: «заменить
 * мой текст» означало «замени неизвестно на что». Здесь оба варианта видны сразу.
 *
 * <p><b>Слева — своё, справа — предложенное.</b> Порядок не декоративный: сначала то, что
 * учитель уже написал и за что отвечает, потом то, что предлагают. Обратный порядок
 * читается как «вот правильный вариант, сравните со своим».
 *
 * <p><b>Тексты — через MathText.</b> И конспект модели, и текст учителя могут содержать
 * формулы; сравнивать сырой LaTeX с сырым LaTeX человек не должен.
 */
export function HomeworkAiCompareModal({
  open,
  onClose,
  homeworkId,
  job,
  currentText,
  currentQuestionCount,
  busy,
  onApply,
  onDiscard,
}: {
  open: boolean;
  onClose: () => void;
  homeworkId: number;
  job: HomeworkAiJob | undefined;
  /** Что сейчас в задании: его описание. */
  currentText: string | null | undefined;
  /** Что сейчас в задании: число вопросов для теста. */
  currentQuestionCount: number;
  busy: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const jobId = open && job?.id != null ? job.id : null;
  const query = useHomeworkAiResult(homeworkId, jobId);
  const isTest = job?.kind === 'TEST';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isTest ? 'Новый набор вопросов' : 'Новый вариант текста задания'}
      subtitle="Слева то, что в задании сейчас. Справа — то, что предлагает модель."
      size="lg"
    >
      <div className="flex flex-col gap-5">
        {query.isPending ? (
          <LoadingBlock />
        ) : query.isError ? (
          <ErrorBlock
            message="Не удалось загрузить предложенный вариант"
            onRetry={() => void query.refetch()}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Column title="Сейчас в задании">
              {isTest ? (
                <p className="text-sm text-muted">
                  {currentQuestionCount > 0
                    ? `${currentQuestionCount} ${pluralRu(currentQuestionCount, ['вопрос', 'вопроса', 'вопросов'])}`
                    : 'Вопросов нет'}
                </p>
              ) : currentText?.trim() ? (
                <MathText text={currentText} className="block text-sm text-ink" />
              ) : (
                <p className="text-sm text-subtle">Пусто</p>
              )}
            </Column>

            <Column title="Предлагает модель" accent>
              <ProposedContent result={query.data} isTest={isTest} />
            </Column>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onDiscard} disabled={busy || query.isPending}>
            Оставить мой
          </Button>
          <Button onClick={onApply} loading={busy} disabled={query.isPending || query.isError}>
            {isTest ? 'Взять машинные вопросы' : 'Взять машинный текст'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ProposedContent({
  result,
  isTest,
}: {
  result: HomeworkAiResult | undefined;
  isTest: boolean;
}) {
  if (!isTest) {
    return result?.text?.trim() ? (
      <MathText text={result.text} className="block text-sm text-ink" />
    ) : (
      <EmptyBlock title="Модель ничего не предложила" />
    );
  }

  const questions = result?.questions ?? [];
  if (questions.length === 0) return <EmptyBlock title="Модель ничего не предложила" />;

  return (
    <ol className="flex list-decimal flex-col gap-3 pl-5">
      {questions.map((question, index) => (
        <li key={index} className="text-sm text-ink">
          <MathText text={question.text} className="block" />
          {/* Балл и варианты — то, по чему учитель понимает, тест это или сочинение. */}
          <p className="mt-1 text-11 text-subtle">
            {question.type === 'OPEN_TEXT' ? 'Открытый' : 'С вариантами'} · {question.maxScore} б.
          </p>
          {(question.options?.length ?? 0) > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {question.options?.map((option, optionIndex) => (
                <li key={optionIndex} className="text-13 text-muted">
                  <MathText text={option} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

function Column({
  title,
  accent = false,
  children,
}: {
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-11 font-medium uppercase tracking-wide text-subtle">{title}</h3>
      <div
        className={
          accent
            ? 'max-h-80 overflow-y-auto rounded-xl bg-violet-50/60 p-3 ring-1 ring-inset ring-violet-200'
            : 'max-h-80 overflow-y-auto rounded-xl bg-neutral-bg p-3'
        }
      >
        {children}
      </div>
    </section>
  );
}
