import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { AiJobProgress } from '@/components/ui/AiJobProgress';
import { Markdown } from '@/components/ui/Markdown';
import { LoadingBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useSurveyAiAnalysisAction } from '@/components/survey/useSurveyAiAnalysisAction';
import { formatDateTime } from '@/lib/format';
import type { SurveyAiScope } from '@/lib/surveyApi';

/**
 * AI-анализ ответов опроса. `GET` только показывает последний посчитанный результат —
 * запуск новой задачи всегда через отдельную кнопку и `POST`, и результат остаётся на
 * экране даже устаревшим (`stale`): его прячут только за пометкой, никогда целиком.
 */
export function SurveyAiAnalysisTab({
  surveyId,
  classOptions,
}: {
  surveyId: number;
  classOptions: Array<{ id: number; name: string }>;
}) {
  const hasMultipleClasses = classOptions.length > 1;
  const [scope, setScope] = useState<SurveyAiScope>('ALL');
  const [classId, setClassId] = useState<number | undefined>(undefined);

  const effectiveClassId = scope === 'CLASS' ? classId : undefined;
  const { analysis, isLoading, isRunning, job, starting, start } = useSurveyAiAnalysisAction(
    surveyId,
    scope,
    effectiveClassId,
  );

  const canStart = scope !== 'CLASS' || classId != null;
  const hasResult = Boolean(analysis?.resultMarkdown);
  const isStale = Boolean(analysis?.stale);

  // Охват берётся у посчитанного отчёта, а не у переключателя: переключатель уже
  // может стоять на другом классе, а текст на экране — по-прежнему прежний.
  const analysisClassId = analysis?.job?.schoolClassId;
  const scopeLabel = analysis?.job?.scope === 'CLASS'
    ? classOptions.find((c) => c.id === analysisClassId)?.name ?? 'по классу'
    : hasMultipleClasses ? 'все классы' : null;

  return (
    <div className="space-y-4">
      {hasMultipleClasses && (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedTabs
            value={scope}
            options={[
              { value: 'ALL', label: 'Все классы' },
              { value: 'CLASS', label: 'По классу' },
            ]}
            onChange={(value) => {
              setScope(value);
              if (value === 'ALL') setClassId(undefined);
            }}
            ariaLabel="Охват анализа"
          />
          {scope === 'CLASS' && (
            <Select
              value={classId != null ? String(classId) : ''}
              onChange={(e) => setClassId(Number(e.target.value) || undefined)}
              className="w-auto"
            >
              <option value="">Выберите класс</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      {isLoading ? (
        <LoadingBlock label="Загрузка анализа…" />
      ) : isRunning ? (
        <AiJobProgress job={job} />
      ) : (
        <>
          {hasResult ? (
            <article className="card space-y-4 p-6">
              {/* Шапка отчёта своя, а не заголовок из разметки: модель начинает
                  названием опроса, которое уже стоит над вкладками. Зато отсюда
                  видно, к какому моменту и к какому охвату относится текст, —
                  без этого «обновить анализ» нажимают вслепую. */}
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <p className="flex items-center gap-2 text-11 font-bold uppercase tracking-wide text-muted">
                  <Sparkles className="size-4 text-brand-500" />
                  Отчёт AI
                </p>
                <p className="text-11 text-subtle">
                  {analysis?.job?.finishedAt ? `Собран ${formatDateTime(analysis.job.finishedAt)}` : null}
                  {scopeLabel ? ` · ${scopeLabel}` : null}
                </p>
              </header>

              {isStale && (
                <NoticeBar tone="soft">
                  Появились новые ответы после этого анализа — результат мог устареть.
                </NoticeBar>
              )}

              <Markdown source={analysis?.resultMarkdown} skipLeadingHeading />
            </article>
          ) : (
            <EmptyBlock
              title="Анализа пока нет"
              description="Запустите анализ ответов участников через AI."
            />
          )}

          {(!hasResult || isStale) && (
            <div>
              <Button onClick={() => void start()} loading={starting} disabled={!canStart}>
                {hasResult ? 'Обновить анализ' : 'Анализировать с AI'}
              </Button>
              {!canStart && (
                <p className="mt-1.5 text-xs text-slate-400">Выберите класс, чтобы запустить анализ.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
