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
import { useEndSurvey, usePublishSurvey, useSurvey } from '@/hooks/surveyQueries';
import { useAcademicYears, useSchoolClasses } from '@/platform/hooks/useScheduleSettings';
import { groupClassesByGrade } from '@/lib/platformCoreApi';
import { canPublishSurvey, publishBlockedReason } from '@/lib/surveyModel';
import { useToast } from '@/context/ToastContext';
import { ROUTES } from '@/lib/routes';
import { ApiError } from '@/lib/api';

type SurveyTab = 'questions' | 'audience' | 'results' | 'ai';

const TAB_VALUES: SurveyTab[] = ['questions', 'audience', 'results', 'ai'];

/**
 * Карточка опроса: вопросы, аудитория, результаты, AI-анализ — четыре вкладки одного
 * экрана, а не четыре разных страницы, чтобы переключение между «что задано» и «кто
 * ответил» не теряло контекст опроса.
 */
export function SurveyDetailPage() {
  const { surveyId: surveyIdParam } = useParams();
  const surveyId = Number(surveyIdParam);
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: SurveyTab = TAB_VALUES.includes(tabParam as SurveyTab) ? (tabParam as SurveyTab) : 'questions';

  const surveyQuery = useSurvey(Number.isFinite(surveyId) ? surveyId : null);
  const survey = surveyQuery.data;

  const publish = usePublishSurvey(surveyId);
  const end = useEndSurvey(surveyId);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Классы школы — общий источник и для дерева выбора аудитории, и для подписей класса
  // на вкладках результатов и AI-анализа: список один на всех, отдельно не запрашивается.
  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data?.content ?? [];
  const activeYearId = years.find((y) => y.status === 'ACTIVE')?.id ?? years[0]?.id ?? null;
  const classesQuery = useSchoolClasses(activeYearId);
  const classes = useMemo(() => classesQuery.data?.content ?? [], [classesQuery.data]);
  const gradeGroups = useMemo(() => groupClassesByGrade(classes), [classes]);
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
      toast.success('Опрос опубликован');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не удалось опубликовать опрос');
    }
  }

  async function handleEnd() {
    try {
      await end.mutateAsync();
      toast.success('Опрос завершён');
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
        to={ROUTES.surveys}
        className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        К опросам
      </Link>

      {surveyQuery.isLoading ? (
        <div className="card">
          <LoadingBlock label="Загрузка опроса…" />
        </div>
      ) : surveyQuery.isError || !survey ? (
        <div className="card">
          <ErrorBlock
            message={
              surveyQuery.error instanceof ApiError ? surveyQuery.error.message : 'Не удалось загрузить опрос'
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
                  Завершить опрос
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
                <TabsTrigger value="ai">AI-анализ</TabsTrigger>
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
                />
              )}
              {tab === 'results' && (
                <SurveyResultsTab surveyId={survey.id as number} classOptions={audienceClassOptions} />
              )}
              {tab === 'ai' && (
                <SurveyAiAnalysisTab surveyId={survey.id as number} classOptions={audienceClassOptions} />
              )}
            </div>
          </div>

          <ConfirmDialog
            open={endConfirmOpen}
            onClose={() => setEndConfirmOpen(false)}
            onConfirm={() => void handleEnd()}
            title="Завершить опрос?"
            confirmLabel="Завершить"
            danger
            loading={end.isPending}
            message="Опрос перестанет принимать ответы. Это действие нельзя отменить."
          />
        </>
      )}
    </div>
  );
}
