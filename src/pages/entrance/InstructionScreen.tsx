import { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  GraduationCap,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { cx } from '@/lib/format';
import type { ApplicantView, AssignmentItem } from '@/lib/entranceTypes';

function formatGrade(grade: string): string {
  const trimmed = grade.trim();
  if (!trimmed) return '—';
  if (/класс/i.test(trimmed)) return trimmed;
  return `${trimmed} класс`;
}

/** Section 7 — instruction / rules before the attempt (Figma). */
export function InstructionScreen({
  item,
  applicant,
  onBegin,
  onBack,
  onExit,
  loading,
}: {
  item: AssignmentItem;
  applicant: ApplicantView;
  onBegin: () => void;
  onBack: () => void;
  onExit: () => void;
  loading: boolean;
}) {
  const [agreed, setAgreed] = useState(false);

  const rows = [
    { icon: BookOpen, label: 'Предмет', value: item.subject },
    { icon: GraduationCap, label: 'Класс', value: formatGrade(applicant.grade) },
    { icon: Clock, label: 'Длительность', value: `${item.durationMinutes} минут` },
    {
      icon: RotateCcw,
      label: 'Возврат к вопросам',
      value: item.allowBackNavigation ? 'Разрешён' : 'Запрещён',
    },
    { icon: HelpCircle, label: 'Количество попыток', value: String(item.maxAttempts) },
  ];

  return (
    <EntranceShell
      variant="session"
      size="lg"
      applicantName={applicant.fullName}
      onExit={onExit}
    >
      <div className="rounded-[28px] bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.12)] sm:p-10">
        <div className="border-b border-slate-100 pb-6">
          <h1 className="text-[28px] font-bold tracking-tight text-[#1a1f36]">{item.testTitle}</h1>
          <p className="mt-2 text-sm text-[#6b7280]">Подготовьтесь перед началом тестирования</p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <ul className="space-y-4">
            {rows.map((row) => (
              <li key={row.label} className="flex items-center gap-3 text-sm">
                <row.icon className="size-4 shrink-0 text-slate-400" />
                <span className="min-w-[150px] text-[#6b7280]">{row.label}</span>
                <span className="font-semibold text-[#1a1f36]">{row.value}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[rgba(39,65,133,0.08)] bg-[#f0f4ff] p-5">
              <div className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-[10px] bg-navy-700 text-[11px] font-extrabold text-white">
                  i
                </span>
                <p className="text-[13px] leading-relaxed text-[#374151]">
                  После завершения тест будет отправлен на проверку школы. Результат будет доступен
                  позже после подтверждения.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-red-200/60 bg-red-50 p-5">
              <div className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-[10px] bg-red-500 text-[11px] font-extrabold text-white">
                  !
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-red-600">Во время тестирования</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-red-600/90">
                    Не закрывайте страницу, не обновляйте браузер и не переключайте вкладки — каждое
                    такое действие фиксируется.
                  </p>
                </div>
              </div>
            </div>
            {item.rules ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Правила
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{item.rules}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-[#374151]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-300 accent-navy-700"
            />
            <span>Я ознакомился(ась) с правилами прохождения тестирования</span>
          </label>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-brand-500 px-4 text-sm font-semibold text-brand-500 transition hover:bg-brand-50 disabled:opacity-50"
            >
              <ArrowLeft className="size-4" />
              Назад
            </button>
            <button
              type="button"
              onClick={onBegin}
              disabled={!agreed || loading}
              className={cx(
                'inline-flex h-11 items-center rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-[0_8px_8px_rgba(251,146,60,0.19)] transition hover:bg-brand-600',
                (!agreed || loading) && 'cursor-not-allowed opacity-50',
              )}
            >
              {loading ? 'Загрузка…' : 'Начать тест'}
            </button>
          </div>
        </div>
      </div>
    </EntranceShell>
  );
}
