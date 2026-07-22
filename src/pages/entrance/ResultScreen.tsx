import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import type { ApplicantResult, ApplicantView } from '@/lib/entranceTypes';

/** Result screen — school opened the score for viewing (Figma). */
export function ResultScreen({
  result,
  applicant,
  onBack,
  onExit,
}: {
  result: ApplicantResult;
  applicant?: ApplicantView | null;
  onBack: () => void;
  onExit: () => void;
}) {
  const displayScore = Math.round(result.percent > 0 ? result.percent : result.totalScore);
  const hasStrong = result.strongTopics.length > 0;
  const hasWeak = result.weakTopics.length > 0;

  return (
    <EntranceShell
      variant="portal"
      size="lg"
      applicantName={applicant?.fullName}
      onExit={onExit}
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white shadow-[0_8px_8px_rgba(251,146,60,0.19)] transition hover:bg-brand-600"
      >
        <ArrowLeft className="size-4" />
        Вернуться к списку тестов
      </button>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[24px] bg-white p-6 shadow-[0_8px_24px_rgba(39,65,133,0.08)] sm:p-8">
          <dl className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-slate-400">Название теста:</dt>
              <dd className="font-semibold text-[#1a1f36]">{result.testTitle}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-slate-400">Предмет:</dt>
              <dd className="font-semibold text-[#1a1f36]">{result.subject}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-x-2">
              <dt className="text-slate-400">Статус проверки:</dt>
              <dd className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                <span className="size-2 rounded-full bg-emerald-500" />
                Проверено школой
              </dd>
            </div>
          </dl>

          <div className="mt-10 text-center">
            <p className="text-[64px] font-extrabold leading-none tracking-tight text-navy-700">
              {displayScore}
            </p>
            <p className="mt-2 text-sm text-slate-400">балла из 100</p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
              <p className="text-xs text-slate-400">Минимальный проходной балл</p>
              <p className="mt-1.5 text-2xl font-bold text-[#1a1f36]">{result.minScore}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
              <p className="text-xs text-slate-400">Ваш результат</p>
              <p className="mt-1.5 text-2xl font-bold text-emerald-700">{displayScore}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {hasStrong ? (
            <div className="rounded-[24px] bg-white p-5 shadow-[0_8px_24px_rgba(39,65,133,0.08)] sm:p-6">
              <h2 className="text-sm font-bold text-[#1a1f36]">Сильные темы</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {result.strongTopics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700"
                  >
                    <CheckCircle2 className="size-3.5" />
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {hasWeak ? (
            <div className="rounded-[24px] bg-white p-5 shadow-[0_8px_24px_rgba(39,65,133,0.08)] sm:p-6">
              <h2 className="text-sm font-bold text-[#1a1f36]">Темы для повторения</h2>
              <ul className="mt-4 space-y-2">
                {result.weakTopics.map((topic) => (
                  <li key={topic} className="flex items-start gap-2 text-sm text-navy-700">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-navy-700" />
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {result.schoolComment?.trim() ? (
        <div className="mt-5 rounded-[24px] bg-white p-6 shadow-[0_8px_24px_rgba(39,65,133,0.08)] sm:p-8">
          <h2 className="text-base font-bold text-navy-700">Комментарий приёмной комиссии</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#374151]">{result.schoolComment}</p>
        </div>
      ) : null}

      <div className="mt-5 rounded-[24px] border border-[rgba(39,65,133,0.08)] bg-[#f0f4ff] p-6 sm:p-8">
        <h2 className="text-base font-bold text-navy-700">Что дальше?</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#374151]">
          Приёмная комиссия рассмотрит все результаты. Информацию о следующем этапе поступления
          школа сообщит отдельно.
        </p>
      </div>
    </EntranceShell>
  );
}
