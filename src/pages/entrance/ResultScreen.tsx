import { ArrowLeft, BookOpen, Check } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { cx } from '@/lib/format';
import type { ApplicantResult, ApplicantView } from '@/lib/entranceTypes';

/** Result report — mobile Figma + desktop two-column mockup. */
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
      applicantName={applicant?.fullName}
      onExit={onExit}
      navActive="tests"
      showLogo={false}
    >
      {/* —— Mobile —— */}
      <div className="lg:hidden">
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
      </div>

      {/* —— Desktop —— */}
      <div className="hidden lg:block">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-500 transition hover:text-brand-600"
        >
          <ArrowLeft className="size-4" strokeWidth={2.5} />
          Вернуться к списку тестов
        </button>

        <div className="grid grid-cols-[1fr_320px] gap-5">
          <div className="rounded-2xl bg-white p-7 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <dl className="space-y-3">
              <MetaRow label="Название теста" value={result.testTitle} />
              <MetaRow label="Предмет" value={result.subject} />
              <MetaRow
                label="Статус проверки"
                value={
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Проверено школой
                  </span>
                }
              />
            </dl>

            <div className="mt-8">
              <p className="text-5xl font-black leading-none text-navy-700">{displayScore}</p>
              <p className="mt-1 text-base font-semibold text-slate-500">балла из 100</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Минимальный проходной балл
                </p>
                <p className="mt-1 text-lg font-bold text-[#111827]">{result.minScore}</p>
              </div>
              <div
                className={cx(
                  'rounded-xl border px-4 py-3',
                  result.passed
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-red-200 bg-red-50',
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Ваш результат
                </p>
                <p
                  className={cx(
                    'mt-1 text-lg font-bold',
                    result.passed ? 'text-emerald-700' : 'text-red-700',
                  )}
                >
                  {displayScore}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {hasStrong ? (
              <div className="rounded-2xl bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#111827]">
                  <Check className="size-4 text-emerald-500" strokeWidth={2.5} />
                  Сильные темы
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.strongTopics.map((topic) => (
                    <span
                      key={topic}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                    >
                      <Check className="size-3" strokeWidth={3} />
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {hasWeak ? (
              <div className="rounded-2xl bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#111827]">
                  <BookOpen className="size-4 text-navy-600" strokeWidth={2} />
                  Темы для повторения
                </h2>
                <ul className="mt-3 space-y-2">
                  {result.weakTopics.map((topic) => (
                    <li key={topic} className="flex gap-2 text-sm text-slate-600">
                      <span className="text-slate-300">•</span>
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {result.schoolComment?.trim() ? (
          <div className="mt-5 rounded-2xl bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <h2 className="text-base font-bold text-[#111827]">Комментарий приёмной комиссии</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{result.schoolComment}</p>
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl bg-[#eff6ff] p-6">
          <h2 className="text-base font-bold text-navy-800">Что дальше?</h2>
          <p className="mt-2 text-sm leading-relaxed text-navy-700/80">
            Результаты вступительного тестирования переданы в приёмную комиссию. Следите за
            дальнейшими сообщениями от школы о следующем этапе поступления.
          </p>
        </div>
      </div>
    </EntranceShell>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-semibold text-[#111827]">{value}</dd>
    </div>
  );
}
