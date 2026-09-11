import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/context/ToastContext';
import { useSurveyAiAnalysis, useTriggerSurveyAiAnalysis } from '@/hooks/surveyQueries';
import { ApiError } from '@/lib/api';
import type { SurveyAiScope } from '@/lib/surveyApi';

/**
 * Запуск и опрос AI-анализа опроса — тот же протокол, что у проверки ИИ домашнего
 * задания (`useAiGradeSuggestion.ts`): ключ идемпотентности один на нажатие кнопки,
 * состояние задачи спрашивается у сервера, а не хранится в браузере, и тост о «готово»
 * показывается только по задаче, за которой следили именно мы — а не по любой, что
 * оказалась завершена к моменту открытия вкладки.
 */
export function useSurveyAiAnalysisAction(surveyId: number, scope: SurveyAiScope, classId: number | undefined) {
  const toast = useToast();
  const analysisQuery = useSurveyAiAnalysis(surveyId, scope, classId);
  const trigger = useTriggerSurveyAiAnalysis(surveyId);

  const job = analysisQuery.data?.job ?? undefined;
  const status = job?.status;
  const jobId = job?.id;
  const isRunning = status === 'PENDING' || status === 'RUNNING';

  const watchedJobId = useRef<number | null>(null);

  useEffect(() => {
    watchedJobId.current = null;
  }, [surveyId, scope, classId]);

  useEffect(() => {
    if (isRunning && jobId != null) watchedJobId.current = jobId;
  }, [isRunning, jobId]);

  useEffect(() => {
    if (jobId == null || watchedJobId.current !== jobId) return;
    if (status !== 'DONE' && status !== 'FAILED') return;
    watchedJobId.current = null;
    if (status === 'DONE') toast.success('Анализ готов');
    else toast.error('Не удалось выполнить анализ. Попробуйте ещё раз.');
  }, [jobId, status, toast]);

  const start = useCallback(async () => {
    try {
      const key = crypto.randomUUID();
      const started = await trigger.mutateAsync({ scope, classId, key });
      watchedJobId.current = started.id ?? null;
      await analysisQuery.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Не удалось запустить анализ');
    }
  }, [analysisQuery, classId, scope, toast, trigger]);

  return {
    analysis: analysisQuery.data,
    isLoading: analysisQuery.isPending,
    isRunning,
    job,
    starting: trigger.isPending,
    start,
  };
}
