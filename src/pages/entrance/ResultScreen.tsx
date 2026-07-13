import { ArrowLeft, CheckCircle2, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/format';
import type { ApplicantResult } from '@/lib/entranceTypes';

/** Result screen — shown when the school opened the score for viewing. */
export function ResultScreen({
  result,
  onBack,
  onExit,
}: {
  result: ApplicantResult;
  onBack: () => void;
  onExit: () => void;
}) {
  const topics = Object.entries(result.topicBreakdown);
  const maxTotal = topics.reduce((sum, [, t]) => sum + t.max, 0) || result.minScore;
  const hasTopics = result.strongTopics.length > 0 || result.weakTopics.length > 0;

  return (
    <EntranceShell size="lg">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        К списку тестов
      </button>

      <div className="card overflow-hidden">
        <div
          className={cx(
            'px-6 py-8 text-center',
            result.passed ? 'bg-emerald-50' : 'bg-red-50',
          )}
        >
          <div
            className={cx(
              'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
              result.passed ? 'bg-emerald-100' : 'bg-red-100',
            )}
          >
            {result.passed ? (
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            ) : (
              <XCircle className="h-9 w-9 text-red-500" />
            )}
          </div>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {result.subject}
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">{result.testTitle}</h1>
          <p
            className={cx(
              'mt-3 text-2xl font-extrabold',
              result.passed ? 'text-emerald-700' : 'text-red-600',
            )}
          >
            {result.passed ? 'Зачёт' : 'Недостаточно баллов'}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Набрано{' '}
            <span className="font-bold text-slate-900">
              {result.totalScore}
              {maxTotal > 0 ? ` / ${maxTotal}` : ''}
            </span>
            {result.percent > 0 && (
              <span className="ml-2 text-slate-500">({Math.round(result.percent)}%)</span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">Минимальный проходной балл: {result.minScore}</p>
        </div>

        <div className="space-y-5 px-6 py-6">
          {result.schoolComment?.trim() && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Комментарий школы
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{result.schoolComment}</p>
            </div>
          )}

          {hasTopics && (
            <div className="grid gap-4 sm:grid-cols-2">
              {result.strongTopics.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <h2 className="text-sm font-semibold text-emerald-800">Сильные темы</h2>
                  </div>
                  <ul className="space-y-1.5">
                    {result.strongTopics.map((topic) => (
                      <li key={topic} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.weakTopics.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-amber-600" />
                    <h2 className="text-sm font-semibold text-amber-800">Слабые темы</h2>
                  </div>
                  <ul className="space-y-1.5">
                    {result.weakTopics.map((topic) => (
                      <li key={topic} className="flex items-center gap-2 text-sm text-slate-700">
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button className="flex-1" onClick={onBack}>
              К списку тестов
            </Button>
            <Button variant="ghost" className="flex-1" onClick={onExit}>
              Выйти
            </Button>
          </div>
        </div>
      </div>
    </EntranceShell>
  );
}
