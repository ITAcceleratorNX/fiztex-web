import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Clock, HelpCircle, Info } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { cx } from '@/lib/format';
import type { ApplicantView, AssignmentItem } from '@/lib/entranceTypes';

/** Prep / instructions — mobile Figma + desktop two-column mockup. */
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

  const defaultRules = [
    'На каждый вопрос один правильный ответ',
    item.allowBackNavigation
      ? 'Можно вернуться к предыдущим вопросам'
      : 'Вернуться к предыдущему вопросу нельзя',
    'Используйте черновик для расчётов',
  ];

  const customRules = item.rules
    ?.split(/\n|•/)
    .map((s) => s.trim())
    .filter(Boolean);

  const rules = customRules && customRules.length > 0 ? customRules : defaultRules;

  const gradeLabel = (() => {
    const trimmed = applicant.grade.trim();
    if (!trimmed) return '—';
    if (/класс/i.test(trimmed)) return trimmed;
    return `${trimmed} класс`;
  })();

  const metaRows: Array<{ label: string; value: string }> = [
    { label: 'Предмет', value: item.subject },
    { label: 'Класс', value: gradeLabel },
    { label: 'Длительность', value: `${item.durationMinutes} минут` },
    { label: 'Количество попыток', value: String(item.maxAttempts) },
    {
      label: 'Возврат к вопросам',
      value: item.allowBackNavigation ? 'Разрешён' : 'Запрещён',
    },
  ];

  return (
    <EntranceShell variant="session" applicantName={applicant.fullName} onExit={onExit}>
      {/* —— Mobile —— */}
      <div className="flex min-h-[100dvh] flex-col lg:hidden">
        <header className="relative flex h-14 shrink-0 items-center justify-center px-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Назад"
            className="absolute left-5 flex size-6 items-center justify-center text-navy-700"
          >
            <ArrowLeft className="size-6" strokeWidth={2} />
          </button>
          <h1 className="text-[17px] font-semibold text-[#1e293b]">Инструкция</h1>
        </header>

        <div className="flex flex-1 flex-col gap-4 px-5 pb-4">
          <div className="rounded-3xl bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
            <h2 className="text-[22px] font-bold text-[#1e293b]">{item.testTitle}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm font-medium text-[#64748b]">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" strokeWidth={2} />
                {item.durationMinutes} минут
              </span>
              <span className="inline-flex items-center gap-1.5">
                <HelpCircle className="size-4" strokeWidth={2} />
                {item.subject}
              </span>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
            <h3 className="text-[17px] font-semibold text-[#1e293b]">Правила проведения</h3>
            <ul className="mt-3 space-y-2">
              {rules.map((rule) => (
                <li key={rule} className="flex gap-2.5 text-[15px] leading-[21px] text-[#1e293b]">
                  <span className="mt-0.5 font-bold text-navy-700">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-4 rounded-[20px] border border-brand-500/40 bg-brand-500/[0.06] p-5">
            <AlertTriangle className="size-6 shrink-0 text-brand-500" strokeWidth={2} />
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-brand-500">Важное предупреждение</p>
              <p className="mt-1 text-sm leading-relaxed text-[#1e293b]">
                Не покидайте окно теста и не переключайте вкладки. Все выходы фиксируются системой.
              </p>
            </div>
          </div>

          <AgreeCheckbox agreed={agreed} onChange={setAgreed} label="Я ознакомился с правилами" />
        </div>

        <div className="shrink-0 px-5 pb-8 pt-2">
          <button
            type="button"
            onClick={onBegin}
            disabled={!agreed || loading}
            className={cx(
              'flex h-14 w-full items-center justify-center rounded-2xl bg-brand-500 text-[17px] font-semibold text-white transition hover:bg-brand-600',
              (!agreed || loading) && 'cursor-not-allowed opacity-50',
            )}
          >
            {loading ? 'Загрузка…' : 'Начать тестирование'}
          </button>
        </div>
      </div>

      {/* —— Desktop —— */}
      <div className="hidden lg:block">
        <div className="rounded-3xl bg-white p-8 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
          <div className="border-b border-slate-200 pb-5">
            <h1 className="text-2xl font-bold text-[#111827]">{item.testTitle}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Подготовьтесь перед началом тестирования
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-8">
            <dl className="space-y-0">
              {metaRows.map((row, i) => (
                <div key={row.label}>
                  {i > 0 ? <div className="h-px w-full bg-slate-100" /> : null}
                  <div className="flex items-center justify-between gap-4 py-3.5">
                    <dt className="text-sm text-slate-500">{row.label}</dt>
                    <dd className="text-right text-sm font-semibold text-[#111827]">{row.value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-4">
              <div className="flex gap-3 rounded-2xl bg-[#eef2ff] p-4">
                <Info className="mt-0.5 size-5 shrink-0 text-navy-600" strokeWidth={2} />
                <p className="text-sm leading-relaxed text-navy-800">
                  После завершения тест будет отправлен на проверку школе. Результаты станут
                  доступны после проверки приёмной комиссией.
                </p>
              </div>
              <div className="flex gap-3 rounded-2xl bg-red-50 p-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" strokeWidth={2} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-red-600">Во время тестирования</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#1e293b]">
                    Не закрывайте страницу, не обновляйте браузер и не переключайте вкладки. Все
                    выходы фиксируются системой.
                  </p>
                </div>
              </div>
              {rules.length > 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-[#111827]">Правила</p>
                  <ul className="mt-2 space-y-1.5">
                    {rules.map((rule) => (
                      <li key={rule} className="flex gap-2 text-sm text-slate-600">
                        <span className="font-bold text-navy-700">•</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-6 border-t border-slate-200 pt-6">
            <AgreeCheckbox
              agreed={agreed}
              onChange={setAgreed}
              label="Я ознакомился(ась) с правилами прохождения тестирования"
            />
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-brand-500 px-5 text-sm font-semibold text-brand-500 transition hover:bg-brand-50"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={onBegin}
                disabled={!agreed || loading}
                className={cx(
                  'inline-flex h-11 items-center justify-center rounded-xl bg-brand-500 px-6 text-sm font-semibold text-white transition hover:bg-brand-600',
                  (!agreed || loading) && 'cursor-not-allowed opacity-50',
                )}
              >
                {loading ? 'Загрузка…' : 'Начать тест'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </EntranceShell>
  );
}

function AgreeCheckbox({
  agreed,
  onChange,
  label,
}: {
  agreed: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1">
      <span
        className={cx(
          'flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-navy-700 bg-white',
          agreed && 'bg-navy-700',
        )}
      >
        {agreed ? (
          <svg viewBox="0 0 12 12" className="size-3.5 text-white" fill="none" aria-hidden>
            <path
              d="M2.5 6.2L5 8.7L9.5 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={agreed}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="text-[15px] font-medium text-[#1e293b] lg:text-sm">{label}</span>
    </label>
  );
}
