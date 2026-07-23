import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
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

/** Mobile success — Figma `Test Success` (105:2797). */
export function FinishedScreen({
  attempt,
  applicant: _applicant,
  onBackToList,
  onExit: _onExit,
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

  const rows: Array<{ label: string; value: ReactNode }> = [
    { label: 'Тест', value: attempt?.testTitle ?? '—' },
    {
      label: 'Отвечено',
      value:
        answered != null && total != null ? `${answered} из ${total}` : '—',
    },
    { label: 'Время', value: formatElapsed(attempt) },
    { label: 'Статус', value: 'На проверке' },
  ];

  return (
    <EntranceShell variant="session">
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-10 px-6 py-8">
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
            {rows.map((row, i) => (
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
    </EntranceShell>
  );
}
