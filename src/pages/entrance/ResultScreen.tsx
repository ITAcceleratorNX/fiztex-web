import { ArrowLeft, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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

          {topics.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-semibold text-slate-800">Результаты по темам</h2>
              </div>
              <ul className="space-y-2.5">
                {topics.map(([topic, score]) => {
                  const pct = score.max > 0 ? Math.round(score.percent) : 0;
                  const weak = result.weakTopics.includes(topic);
                  return (
                    <li key={topic} className="rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-800">{topic}</span>
                        <span className="text-sm tabular-nums text-slate-600">
                          {score.earned} / {score.max}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cx(
                            'h-full rounded-full transition-all',
                            weak ? 'bg-amber-400' : 'bg-brand-500',
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      {weak && (
                        <div className="mt-2">
                          <Badge tone="amber">Требует внимания</Badge>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
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
