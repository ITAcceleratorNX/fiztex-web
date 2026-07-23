import type { ReactNode } from 'react';
import { Check, Info } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { pluralRu } from '@/lib/format';
import type { ApplicantView, AttemptDetail } from '@/lib/entranceTypes';

function formatElapsed(attempt?: AttemptDetail | null): string {
  if (!attempt?.startedAt || !attempt.durationSeconds) {
    const used = Math.max(0, (attempt?.durationMinutes ?? 0) * 60 - (attempt?.remainingSeconds ?? 0));
    const mins = Math.max(1, Math.round(used / 60));
    return `${mins} ${pluralRu(mins, ['минута', 'минуты', 'минут'])}`;
  }
  const started = new Date(attempt.startedAt).getTime();
  const elapsedSec = Math.max(60, Math.round((Date.now() - started) / 1000));
  const mins = Math.round(elapsedSec / 60);
  return `${mins} ${pluralRu(mins, ['минута', 'минуты', 'минут'])}`;
}

function formatSubmitted(attempt?: AttemptDetail | null): { date: string; time: string } {
  const raw = attempt?.startedAt;
  if (!raw) return { date: '—', time: '—' };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—' };
  const date = d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

/** Success / awaiting review — mobile Figma + desktop centered card mockup. */
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
  const answered = attempt?.answers?.filter(
    (a) =>
      (a.photos?.length ?? 0) > 0 ||
      (a.selectedOptionIds?.length ?? 0) > 0 ||
      (a.openTextAnswer ?? '').trim().length > 0,
  ).length;
  const total = attempt?.questions?.length;
  const submitted = formatSubmitted(attempt);

  const mobileRows: Array<{ label: string; value: ReactNode }> = [
    { label: 'Тест', value: attempt?.testTitle ?? '—' },
    {
      label: 'Отвечено',
      value: answered != null && total != null ? `${answered} из ${total}` : '—',
    },
    { label: 'Время', value: formatElapsed(attempt) },
    { label: 'Статус', value: 'На проверке' },
  ];

  const desktopRows: Array<{ label: string; value: ReactNode }> = [
    { label: 'Название теста', value: attempt?.testTitle ?? '—' },
    { label: 'Предмет', value: attempt?.subject ?? '—' },
    { label: 'Дата отправки', value: submitted.date },
    { label: 'Время отправки', value: submitted.time },
    {
      label: 'Статус',
      value: (
        <span className="inline-flex rounded-full bg-brand-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          На проверке
        </span>
      ),
    },
  ];

  return (
    <EntranceShell variant="session" applicantName={applicant?.fullName} onExit={onExit}>
      {/* —— Mobile —— */}
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-10 px-6 py-8 lg:hidden">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-navy-700 text-white">
            <Check className="size-5" strokeWidth={3.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-[28px] font-extrabold tracking-tight text-navy-700">
              Тест завершён!
            </h1>
            <p className="text-[17px] text-[#64748b]">Ваши ответы отправлены на проверку</p>
          </div>
        </div>

        <div className="w-full rounded-3xl bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
          <dl className="space-y-4">
            {mobileRows.map((row, i) => (
              <div key={row.label}>
                {i > 0 ? <div className="mb-4 h-px w-full bg-[#e2e8f0]" /> : null}
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[15px] font-medium text-[#64748b]">{row.label}</dt>
                  <dd className="text-right text-[15px] font-bold text-[#1e293b]">{row.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex w-full flex-col gap-6">
          <p className="text-center text-sm leading-relaxed text-[#64748b]">
            Результаты будут доступны после проверки приёмной комиссией школы.
          </p>
          <button
            type="button"
            onClick={onBackToList}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-500 text-[17px] font-semibold text-white transition hover:bg-brand-600"
          >
            Вернуться к списку тестов
          </button>
        </div>
      </div>

      {/* —— Desktop —— */}
      <div className="hidden min-h-[calc(100dvh-72px)] items-center justify-center py-10 lg:flex">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-navy-700 text-white">
              <Check className="size-6" strokeWidth={3} />
            </div>
            <h1 className="text-2xl font-bold text-navy-700">Тест завершён</h1>
          </div>

          <div className="mt-6 flex gap-3 rounded-xl bg-[#eff6ff] px-4 py-3">
            <Info className="mt-0.5 size-5 shrink-0 text-navy-600" strokeWidth={2} />
            <p className="text-sm leading-relaxed text-navy-800">
              Результаты публикуются только после проверки школой. Баллы и ответы пока недоступны.
            </p>
          </div>

          <dl className="mt-6">
            {desktopRows.map((row, i) => (
              <div key={row.label}>
                {i > 0 ? <div className="h-px w-full bg-slate-100" /> : null}
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <dt className="text-sm text-slate-500">{row.label}</dt>
                  <dd className="text-right text-sm font-semibold text-[#111827]">{row.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <button
            type="button"
            onClick={onBackToList}
            className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-navy-700 text-sm font-semibold text-white transition hover:bg-navy-800"
          >
            Вернуться к списку тестов
          </button>
        </div>
      </div>
    </EntranceShell>
  );
}
