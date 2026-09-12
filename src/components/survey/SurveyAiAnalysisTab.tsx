import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { AiJobProgress } from '@/components/ui/AiJobProgress';
import { LoadingBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useSurveyAiAnalysisAction } from '@/components/survey/useSurveyAiAnalysisAction';
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
            <div className="card space-y-3 p-5">
              {isStale && (
                <NoticeBar tone="soft">
                  Появились новые ответы после этого анализа — результат мог устареть.
                </NoticeBar>
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">
                {analysis?.resultMarkdown}
              </pre>
            </div>
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
