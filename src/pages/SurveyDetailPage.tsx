import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { SurveyStatusBadge } from '@/components/ui/SurveyStatusBadge';
import { SurveyQuestionEditor } from '@/components/survey/SurveyQuestionEditor';
import { SurveyAudienceTab } from '@/components/survey/SurveyAudienceTab';
import { SurveyResultsTab } from '@/components/survey/SurveyResultsTab';
import { SurveyAiAnalysisTab } from '@/components/survey/SurveyAiAnalysisTab';
import { useEndSurvey, usePublishSurvey, useSurvey, useSurveyAudienceClasses } from '@/hooks/surveyQueries';
import {
  SURVEY_VARIANT_COPY,
  canPublishSurvey,
  groupAudienceClasses,
  publishBlockedReason,
  toAudienceClasses,
  type SurveyVariant,
} from '@/lib/surveyModel';
import { useToast } from '@/context/ToastContext';
import { ROUTES } from '@/lib/routes';
import { ApiError } from '@/lib/api';

type SurveyTab = 'questions' | 'audience' | 'results' | 'ai';

/**
 * Карточка опроса: вопросы, аудитория, результаты, AI-анализ — четыре вкладки одного
 * экрана, а не четыре разных страницы, чтобы переключение между «что задано» и «кто
 * ответил» не теряло контекст опроса.
 *
 * `variant="psychology"` — психологический тест психолога (PSYCHOLOGIST-002): те же вкладки
 * без AI-анализа (ответы учеников во внешнюю модель не отправляются) и аудитория только из
 * учеников. Чей это опрос, решает бэкенд: психологу чужие опросы отвечают 404.
 */
export function SurveyDetailPage({ variant = 'school' }: { variant?: SurveyVariant }) {
  const copy = SURVEY_VARIANT_COPY[variant];
  const tabValues: SurveyTab[] = copy.aiAnalysis
    ? ['questions', 'audience', 'results', 'ai']
    : ['questions', 'audience', 'results'];
  const { surveyId: surveyIdParam } = useParams();
  const surveyId = Number(surveyIdParam);
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: SurveyTab = tabValues.includes(tabParam as SurveyTab) ? (tabParam as SurveyTab) : 'questions';

  const surveyQuery = useSurvey(Number.isFinite(surveyId) ? surveyId : null);
  const survey = surveyQuery.data;

  const publish = usePublishSurvey(surveyId);
  const end = useEndSurvey(surveyId);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Классы текущего года — общий источник и для дерева выбора аудитории, и для подписей
  // класса на вкладках результатов и AI-анализа. Из раздела опросов, а не из /admin/classes:
  // тот закрыт психологу, а экран у него тот же.
  const classesQuery = useSurveyAudienceClasses();
  const classes = useMemo(() => toAudienceClasses(classesQuery.data), [classesQuery.data]);
  const gradeGroups = useMemo(() => groupAudienceClasses(classes), [classes]);
  const classNameById = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const audienceClassOptions = useMemo(
    () =>
      (survey?.audienceClassIds ?? []).map((id) => ({
        id,
        name: classNameById.get(id) ?? `Класс #${id}`,
      })),
    [survey?.audienceClassIds, classNameById],
  );

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  async function handlePublish() {
    setActionError(null);
    try {
      await publish.mutateAsync();
      toast.success(copy.publishedToast);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не удалось опубликовать опрос');
    }
  }

  async function handleEnd() {
    try {
      await end.mutateAsync();
      toast.success(copy.endedToast);
      setEndConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось завершить опрос');
      setEndConfirmOpen(false);
    }
  }

  if (!Number.isFinite(surveyId) || surveyId <= 0) {
    return <ErrorBlock message="Некорректный идентификатор опроса." />;
  }

  return (
    <div>
      <Link
        to={variant === 'psychology' ? ROUTES.psychologistTests : ROUTES.surveys}
        className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        {copy.backLabel}
      </Link>

      {surveyQuery.isLoading ? (
        <div className="card">
          <LoadingBlock label="Загрузка опроса…" />
        </div>
      ) : surveyQuery.isError || !survey ? (
        <div className="card">
          <ErrorBlock
            message={
              surveyQuery.error instanceof ApiError ? surveyQuery.error.message : copy.loadError
            }
            onRetry={() => void surveyQuery.refetch()}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
                  {survey.title}
                </h1>
                <SurveyStatusBadge status={survey.status} />
              </div>
              {survey.description && <p className="mt-1 max-w-2xl text-slate-500">{survey.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {survey.status === 'DRAFT' && (
                <Button
                  onClick={() => void handlePublish()}
                  loading={publish.isPending}
                  disabled={!canPublishSurvey(survey)}
                  title={publishBlockedReason(survey) ?? undefined}
                >
                  Опубликовать
                </Button>
              )}
              {/* Кнопка остаётся видимой и после дедлайна: автозакрытия по сроку нет,
                  «Завершить опрос» — единственный способ закрыть его. */}
              {survey.status === 'ACTIVE' && (
                <Button variant="danger" onClick={() => setEndConfirmOpen(true)}>
                  {copy.endLabel}
                </Button>
              )}
            </div>
          </div>

          {survey.status === 'DRAFT' && !canPublishSurvey(survey) && (
            <p className="mt-2 text-sm text-amber-700">{publishBlockedReason(survey)}</p>
          )}
          {actionError && (
            <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              {actionError}
            </div>
          )}

          <div className="mt-6">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="questions">Вопросы</TabsTrigger>
                <TabsTrigger value="audience">Аудитория</TabsTrigger>
                <TabsTrigger value="results">Результаты</TabsTrigger>
                {copy.aiAnalysis && <TabsTrigger value="ai">AI-анализ</TabsTrigger>}
              </TabsList>
            </Tabs>

            <div className="mt-5">
              {tab === 'questions' && (
                <SurveyQuestionEditor surveyId={survey.id as number} canEdit={Boolean(survey.canEdit)} />
              )}
              {tab === 'audience' && (
                <SurveyAudienceTab
                  survey={survey}
                  classes={classes}
                  gradeGroups={gradeGroups}
                  canEdit={Boolean(survey.canEdit)}
                  studentsOnly={copy.studentsOnly}
                />
              )}
              {tab === 'results' && (
                <SurveyResultsTab
                  surveyId={survey.id as number}
                  mode={survey.mode}
                  classOptions={audienceClassOptions}
                />
              )}
              {tab === 'ai' && copy.aiAnalysis && (
                <SurveyAiAnalysisTab surveyId={survey.id as number} classOptions={audienceClassOptions} />
              )}
            </div>
          </div>

          <ConfirmDialog
            open={endConfirmOpen}
            onClose={() => setEndConfirmOpen(false)}
            onConfirm={() => void handleEnd()}
            title={copy.endTitle}
            confirmLabel="Завершить"
            danger
            loading={end.isPending}
            message={copy.endMessage}
          />
        </>
      )}
    </div>
  );
}
