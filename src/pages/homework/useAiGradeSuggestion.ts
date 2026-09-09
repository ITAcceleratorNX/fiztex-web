import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/context/ToastContext';
import {
  useAiRecommendation,
  useHomeworkAiQuota,
  useLastGradeSuggestion,
  useSuggestGrades,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';

/**
 * Проверка работы ИИ: одна кнопка, одна задача, одна рекомендация.
 *
 * <p>Хук общий для двух экранов проверки — теста и обычного задания. Логика тут не
 * сложная, но её легко расписать по-разному: где-то забыть перечитать рекомендацию, где-то
 * показать тост о задаче, законченной до открытия экрана. Расхождение в этом месте учитель
 * читает как «работает через раз».
 *
 * <p>Состояние задачи спрашивается у сервера, а не хранится в браузере: учитель, открывший
 * проверку на другом устройстве или в другом окне, обязан увидеть ту же задачу — иначе
 * второе нажатие стоило бы вторых денег.
 *
 * @param onDone что перечитать после успешной проверки, кроме самой рекомендации:
 *               у теста это баллы по вопросам, у обычной работы — ничего
 */
export function useAiGradeSuggestion(
  homeworkId: number,
  studentProfileId: number,
  onDone?: () => Promise<unknown> | void,
) {
  const toast = useToast();
  const suggestGrades = useSuggestGrades(homeworkId, studentProfileId);
  const quotaQuery = useHomeworkAiQuota();
  const suggestionQuery = useLastGradeSuggestion(homeworkId, studentProfileId);
  const recommendationQuery = useAiRecommendation(homeworkId, studentProfileId);

  const job = suggestionQuery.data ?? undefined;
  const status = job?.status;
  const jobId = job?.id;
  const isRunning = status === 'PENDING' || status === 'RUNNING';

  /**
   * Задача, за концом которой мы следим. Нужна, чтобы отличить «закончилась при нас» от
   * «была закончена ещё до открытия экрана»: во втором случае тост «готово» — сообщение о
   * том, что учитель и так видит на экране.
   */
  const watchedJobId = useRef<number | null>(null);

  // Один и тот же компонент может остаться смонтированным при переходе к соседнему ученику.
  useEffect(() => {
    watchedJobId.current = null;
  }, [homeworkId, studentProfileId]);

  // Задача, начатая до открытия экрана, тоже наша: за её концом следим так же.
  useEffect(() => {
    if (isRunning && jobId != null) {
      watchedJobId.current = jobId;
    }
  }, [isRunning, jobId]);

  const refetchRecommendation = recommendationQuery.refetch;
  useEffect(() => {
    if (jobId == null || watchedJobId.current !== jobId) return;
    if (status !== 'DONE' && status !== 'FAILED') return;

    watchedJobId.current = null;

    if (status === 'DONE') {
      void onDone?.();
      // Рекомендация появляется последним шагом проверки: перечитываем её тогда же, а не
      // опрашиваем всё время, что учитель читает работу.
      void refetchRecommendation();
      toast.success(
        job?.warningMessage
          ? `Проверка ИИ готова. ${job.warningMessage}`
          : 'Проверка ИИ готова — решение по оценке остаётся за вами',
      );
      return;
    }
    toast.error('Не удалось выполнить проверку ИИ. Оценку можно поставить вручную.');
  }, [job?.warningMessage, jobId, onDone, refetchRecommendation, status, toast]);

  const start = useCallback(async () => {
    try {
      const started = await suggestGrades.mutateAsync(crypto.randomUUID());
      if (started.id == null) throw new Error('AI job id is missing');
      // Сервер мог вернуть уже идущую или уже законченную задачу по этой попытке —
      // повторный запрос по неизменённой работе намеренно бесплатный.
      watchedJobId.current = started.id;
      await suggestionQuery.refetch();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.message
          : 'Не удалось запустить проверку ИИ. Оценку можно поставить вручную.',
      );
    }
  }, [suggestGrades, suggestionQuery, toast]);

  return {
    job,
    isRunning,
    starting: suggestGrades.isPending,
    start,
    recommendation: recommendationQuery.data ?? undefined,
    unavailableText: unavailableText(quotaQuery.data),
  };
}

/** Почему кнопка выключена. Молчащая кнопка читается как поломка, а не как лимит. */
function unavailableText(
  quota: { enabled?: boolean; remaining?: number } | undefined,
): string | null {
  if (!quota) return null;
  if (quota.enabled === false) return 'Проверка ИИ сейчас недоступна. Оценку можно поставить вручную.';
  if ((quota.remaining ?? 1) <= 0) {
    return 'Лимит обращений к ИИ на сегодня исчерпан. Оценку можно поставить вручную.';
  }
  return null;
}
