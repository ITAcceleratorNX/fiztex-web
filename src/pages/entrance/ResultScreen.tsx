import { ArrowLeft } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { cx } from '@/lib/format';
import type { ApplicantResult, ApplicantView } from '@/lib/entranceTypes';

/** Mobile result — Figma `Frame 4` / Result Report (105:4320). */
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

  return (
    <EntranceShell
      variant="portal"
      applicantName={applicant?.fullName}
      onExit={onExit}
      navActive="tests"
      showLogo={false}
    >
      <header className="relative mb-5 flex h-10 items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="absolute left-0 flex size-6 items-center justify-center text-navy-700"
        >
          <ArrowLeft className="size-6" strokeWidth={2} />
        </button>
        <h1 className="text-[17px] font-semibold text-[#1e293b]">Результат</h1>
      </header>

      <div className="flex flex-col gap-5">
        <div className="rounded-[32px] bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-5xl font-black leading-none text-navy-700">{displayScore}</p>
              <p className="mt-1 text-[15px] font-semibold text-[#64748b]">балла из 100</p>
            </div>
            <span
              className={cx(
                'inline-flex rounded-full px-4 py-2 text-sm font-bold uppercase',
                result.passed
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-red-500/10 text-red-500',
              )}
            >
              {result.passed ? 'Тест пройден' : 'Не пройден'}
            </span>
          </div>
        </div>

        <div className="flex rounded-[20px] bg-[#eff6ff] p-5">
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-xs font-semibold uppercase text-[#64748b]">Проходной балл</p>
            <p className="text-[17px] font-bold text-[#1e293b]">{result.minScore}</p>
          </div>
          <div className="mx-4 w-px self-stretch bg-[#e2e8f0]" />
          <div className="flex flex-1 flex-col items-end gap-1">
            <p className="text-xs font-semibold uppercase text-[#64748b]">Ваш результат</p>
            <p className="text-[17px] font-bold text-emerald-500">{displayScore}</p>
          </div>
        </div>

        {hasStrong ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-[17px] font-bold text-[#1e293b]">Сильные стороны</h2>
            <div className="flex flex-wrap gap-2">
              {result.strongTopics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-sm font-semibold text-emerald-500"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {result.schoolComment?.trim() ? (
          <div className="flex gap-4 rounded-[20px] bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
            <div className="w-1 shrink-0 rounded-full bg-navy-700" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#64748b]">Комментарий комиссии</p>
              <p className="mt-2 text-[15px] leading-relaxed text-[#1e293b]">
                {result.schoolComment}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </EntranceShell>
  );
}
