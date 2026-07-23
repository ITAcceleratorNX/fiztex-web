import { Info } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import type { ApplicantView } from '@/lib/entranceTypes';

function formatGrade(grade: string): string {
  const trimmed = grade.trim();
  if (!trimmed) return '—';
  if (/класс/i.test(trimmed)) return trimmed;
  return `${trimmed} класс`;
}

/** Mobile confirm — Figma `mobile-Экран подтверждения данных` (105:4221). */
export function ConfirmScreen({
  applicant,
  personalCode,
  onConfirm,
  onBack,
  loading,
}: {
  applicant: ApplicantView;
  personalCode: string;
  onConfirm: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const rows = [
    { label: 'ФИО', value: applicant.fullName || '—' },
    { label: 'Класс', value: formatGrade(applicant.grade) },
    ...(applicant.parentFullName
      ? [{ label: 'Родитель', value: applicant.parentFullName }]
      : []),
    ...(personalCode ? [{ label: 'Персональный код', value: personalCode }] : []),
  ];

  return (
    <EntranceShell variant="plain">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[390px] flex-col bg-[#f8fafc]">
        <header className="flex h-14 shrink-0 items-center justify-center px-5">
          <h1 className="text-[17px] font-semibold text-[#1e293b]">Подтверждение данных</h1>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-5 pb-5 pt-1">
          <div className="rounded-3xl bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
            {rows.map((row, i) => (
              <div key={row.label}>
                {i > 0 ? <div className="h-px w-full bg-[#e2e8f0]" /> : null}
                <div className="flex flex-col gap-1 py-3">
                  <p className="text-[13px] font-medium text-[#64748b]">{row.label}</p>
                  <p className="text-[17px] font-semibold text-[#1e293b]">{row.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 px-2">
            <Info className="mt-0.5 size-5 shrink-0 text-[#64748b]" strokeWidth={2} />
            <p className="text-sm leading-relaxed text-[#64748b]">
              Если данные указаны неверно, обратитесь в приёмную комиссию для исправления.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 px-5 pb-8 pt-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-500 text-[17px] font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Загрузка…' : 'Подтвердить'}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-navy-700 bg-white text-[17px] font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
          >
            Это не мои данные
          </button>
        </div>
      </div>
    </EntranceShell>
  );
}
