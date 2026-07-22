import { EntranceShell } from './EntranceShell';
import type { ApplicantView } from '@/lib/entranceTypes';

function formatGrade(grade: string): string {
  const trimmed = grade.trim();
  if (!trimmed) return '—';
  if (/класс/i.test(trimmed)) return trimmed;
  return `${trimmed} класс`;
}

/** Section 5 — confirm applicant data before starting (Figma). */
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
  return (
    <EntranceShell variant="auth">
      <div className="flex flex-col gap-1 rounded-[32px] bg-white p-8 shadow-[0px_8px_24px_0px_rgba(39,65,133,0.13),0px_32px_64px_0px_rgba(0,0,0,0.13)] sm:p-16">
        <div className="flex flex-col gap-3">
          <h1 className="text-[28px] font-bold leading-tight text-[#1a1f36] sm:text-[32px]">
            Подтверждение данных
          </h1>
          <p className="text-[15px] leading-normal text-[#6b7280]">
            Проверьте данные перед началом тестирования.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-6 rounded-3xl border border-[#e8edf5] bg-[#f9fafb] p-6 sm:p-8">
          <DataRow label="ФИО" value={applicant.fullName} valueClass="text-lg" />
          <div className="h-px w-full bg-[#e8edf5]" />
          <DataRow label="Класс поступления" value={formatGrade(applicant.grade)} valueClass="text-lg" />
          <div className="h-px w-full bg-[#e8edf5]" />
          <DataRow
            label="Персональный код"
            value={personalCode || '—'}
            valueClass="text-[15px]"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-[rgba(39,65,133,0.06)] bg-[#f0f4ff] p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-[10px] bg-navy-700 text-xs font-extrabold text-white">
              i
            </span>
            <p className="text-[13px] font-semibold text-navy-700">Внимание</p>
          </div>
          <p className="text-[13px] leading-relaxed text-[#374151]">
            Если данные указаны неверно, обратитесь к сотруднику приёмной комиссии школы.
          </p>
        </div>

        <div className="mt-4 flex flex-col items-center gap-5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex h-16 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white shadow-[0px_8px_8px_rgba(251,146,60,0.19)] transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Загрузка…' : 'Подтвердить'}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="text-sm font-semibold text-navy-700 underline underline-offset-2 transition hover:text-navy-800 disabled:opacity-50"
          >
            Это не мои данные
          </button>
        </div>
      </div>
    </EntranceShell>
  );
}

function DataRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase text-[#6b7280]">{label}</p>
      <p className={`font-bold text-[#1a1f36] ${valueClass ?? 'text-lg'}`}>{value}</p>
    </div>
  );
}
