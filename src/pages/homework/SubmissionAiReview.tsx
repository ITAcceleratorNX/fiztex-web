import { Sparkles } from 'lucide-react';
import { AiJobProgress } from '@/components/ui/AiJobProgress';
import { Button } from '@/components/ui/Button';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { RecommendationCard } from './RecommendationCard';
import { useAiGradeSuggestion } from './useAiGradeSuggestion';

/**
 * Проверка ИИ на экране обычного задания — текста и вложений (ТЗ §11, AIGRADE-006).
 *
 * <p>Кнопка одна на всю работу, как и у теста: ТЗ §4.1 требует именно этого, а разбор по
 * вопросам здесь показывать не по чему — вопросов нет. Модель читает текст, фотографии и
 * приложенные файлы, называет процент выполнения, а в оценку его переводит школьная шкала.
 *
 * <p>Блок ничего не блокирует: отказ ИИ оставляет и комментарий, и оценку доступными —
 * это AC-9 и главный инвариант всей фичи.
 */
export function SubmissionAiReview({
  homeworkId,
  studentProfileId,
}: {
  homeworkId: number;
  studentProfileId: number;
}) {
  const ai = useAiGradeSuggestion(homeworkId, studentProfileId);

  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="ai-review-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ai-review-heading" className="text-base font-semibold text-ink">
            Проверка ИИ
          </h2>
          <p className="mt-1 text-13 text-muted">
            ИИ читает работу и предлагает оценку. Решение и журнал остаются за вами.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={ai.starting || ai.isRunning || ai.unavailableText != null}
          loading={ai.starting}
          onClick={() => void ai.start()}
        >
          <Sparkles className="size-4" aria-hidden />
          {ai.isRunning ? 'Проверяю работу…' : 'Получить рекомендацию ИИ'}
        </Button>
      </div>

      {ai.unavailableText && <NoticeBar tone="soft">{ai.unavailableText}</NoticeBar>}

      {ai.job && (
        <AiJobProgress
          job={ai.job}
          fallbackAction={
            <p className="text-11 text-muted">Оценку можно поставить вручную ниже.</p>
          }
        />
      )}

      {ai.recommendation && <RecommendationCard recommendation={ai.recommendation} />}
    </section>
  );
}
