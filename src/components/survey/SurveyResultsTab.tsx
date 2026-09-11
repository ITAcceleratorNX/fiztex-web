import { useState } from 'react';
import { Field, Select } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useSurveyStats } from '@/hooks/surveyQueries';
import { ApiError } from '@/lib/api';

/**
 * Результаты опроса. Именной и анонимный режим рисуются одинаково: ни `SurveyStatsView`,
 * ни `QuestionStatsView` не несут ничего про автора ответа ни в каком режиме, поэтому
 * прятать здесь нечего.
 *
 * Класс-фильтр — серверный параметр: смена класса переспрашивает `stats`, а не
 * пересчитывает проценты по уже пришедшему ответу — числитель и знаменатель считает
 * бэкенд по тому же срезу.
 */
export function SurveyResultsTab({
  surveyId,
  classOptions,
}: {
  surveyId: number;
  classOptions: Array<{ id: number; name: string }>;
}) {
  const [classId, setClassId] = useState<number | undefined>(undefined);
  const statsQuery = useSurveyStats(surveyId, classId);
  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      {classOptions.length > 1 && (
        <Field label="Класс">
          <Select
            value={classId != null ? String(classId) : ''}
            onChange={(e) => setClassId(Number(e.target.value) || undefined)}
            className="w-auto"
          >
            <option value="">Все классы</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {statsQuery.isLoading ? (
        <LoadingBlock label="Загрузка результатов…" />
      ) : statsQuery.isError ? (
        <ErrorBlock
          message={
            statsQuery.error instanceof ApiError ? statsQuery.error.message : 'Не удалось загрузить результаты'
          }
          onRetry={() => void statsQuery.refetch()}
        />
      ) : !stats ? null : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Получили" value={stats.recipientsTotal ?? 0} />
            <StatCard label="Ответили" value={stats.respondedCount ?? 0} />
            <StatCard
              label="% прохождения"
              value={stats.completionPercent != null ? `${Math.round(stats.completionPercent)}%` : '—'}
            />
          </div>

          {(stats.questions ?? []).length === 0 ? (
            <EmptyBlock title="В опросе нет вопросов" />
          ) : (
            <div className="space-y-4">
              {(stats.questions ?? []).map((question) => (
                <div key={question.questionId} className="card p-5">
                  <p className="mb-3 font-semibold text-slate-800">
                    {question.orderIndex != null ? `${question.orderIndex + 1}. ` : ''}
                    {question.text}
                  </p>

                  {question.type === 'OPEN_TEXT' ? (
                    (question.openAnswers ?? []).length === 0 ? (
                      <p className="text-sm text-slate-400">Пока нет ответов</p>
                    ) : (
                      <ul className="space-y-2">
                        {(question.openAnswers ?? []).map((answer, index) => (
                          <li
                            key={index}
                            className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                          >
                            {answer}
                          </li>
                        ))}
                      </ul>
                    )
                  ) : (question.options ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400">Пока нет ответов</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <th className="py-1.5">Вариант</th>
                          <th className="py-1.5 text-right">Ответов</th>
                          <th className="py-1.5 text-right">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(question.options ?? []).map((option) => (
                          <tr key={option.optionId}>
                            <td className="py-1.5 text-sm text-slate-700">{option.text}</td>
                            <td className="py-1.5 text-right text-sm font-medium text-slate-700">
                              {option.count ?? 0}
                            </td>
                            <td className="py-1.5 text-right text-sm text-slate-500">
                              {option.percent != null ? `${Math.round(option.percent)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <p className="mt-2 text-xs text-slate-400">Ответили: {question.answeredCount ?? 0}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
