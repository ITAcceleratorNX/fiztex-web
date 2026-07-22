import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import type { ApplicantView, AttemptDetail } from '@/lib/entranceTypes';

function formatSubmittedAt(iso: string | null | undefined): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return {
      date: now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
      time: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };
  }
  return {
    date: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Section 11 — test submitted, awaiting school review (Figma). */
export function FinishedScreen({
  attempt,
  applicant,
  onBackToList,
  onExit,
}: {
  attempt?: AttemptDetail | null;
  applicant?: ApplicantView | null;
  onBackToList: () => void;
  onExit: () => void;
}) {
  const { date, time } = formatSubmittedAt(null);

  const rows: Array<{ label: string; value: ReactNode }> = [
    { label: 'Название теста', value: attempt?.testTitle ?? '—' },
    { label: 'Предмет', value: attempt?.subject ?? '—' },
    { label: 'Дата отправки', value: date },
    { label: 'Время отправки', value: time },
    {
      label: 'Статус',
      value: (
        <span className="inline-flex rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
          На проверке
        </span>
      ),
    },
  ];

  return (
    <EntranceShell
      variant="session"
      size="md"
      applicantName={applicant?.fullName}
      onExit={onExit}
    >
      <div className="mx-auto max-w-[520px] rounded-[28px] bg-white px-8 py-10 shadow-[0_16px_40px_rgba(0,0,0,0.12)] sm:px-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-navy-700 text-white">
            <Check className="size-8" strokeWidth={2.5} />
          </div>
          <h1 className="mt-5 text-[28px] font-bold tracking-tight text-[#1a1f36]">Тест завершён</h1>
        </div>

        <div className="mt-6 rounded-2xl border border-[rgba(39,65,133,0.08)] bg-[#f0f4ff] px-5 py-4">
          <div className="flex gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[10px] bg-navy-700 text-[11px] font-extrabold text-white">
              i
            </span>
            <p className="text-[13px] leading-relaxed text-[#374151]">
              Результаты публикуются только после проверки школой. До этого момента баллы, правильные
              ответы и подробный разбор вопросов недоступны.
            </p>
          </div>
        </div>

        <dl className="mt-6 divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 py-3.5">
              <dt className="text-sm text-slate-400">{row.label}</dt>
              <dd className="text-right text-sm font-semibold text-[#1a1f36]">{row.value}</dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          onClick={onBackToList}
          className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl bg-navy-700 text-sm font-semibold text-white transition hover:bg-navy-800"
        >
          Вернуться к списку тестов
        </button>
      </div>
    </EntranceShell>
  );
}
