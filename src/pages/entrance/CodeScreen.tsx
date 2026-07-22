import { useRef, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { entranceApi } from '@/lib/entranceApi';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import { EntranceShell } from './EntranceShell';
import type { ApplicantView } from '@/lib/entranceTypes';

/** Section 4.1 — personal code entry (Figma: idle / loading / error). */
export function CodeScreen({
  onVerified,
}: {
  onVerified: (applicant: ApplicantView, code: string) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      const trimmed = code.trim().replace(/^#/, '');
      const res = await entranceApi.verifyCode(trimmed);
      onVerified(res.applicant, trimmed);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Код неактивен. Обратитесь к сотруднику школы.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <EntranceShell variant="auth">
      <div className="rounded-[32px] bg-white p-8 shadow-[0px_8px_24px_0px_rgba(39,65,133,0.13),0px_32px_64px_0px_rgba(0,0,0,0.13)] sm:p-16">
        <div className="flex flex-col gap-4 text-center">
          <h1 className="text-[28px] font-bold leading-tight text-[#1a1f36] sm:text-[32px]">
            Вступительный тест
          </h1>
          <p className="text-sm leading-relaxed text-[#6b7280]">
            Введите персональный код, который вы получили после регистрации на вступительные
            испытания.
          </p>
        </div>

        <form onSubmit={submit} className="mt-12 flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <label htmlFor="personal-code" className="text-[13px] font-semibold text-[#374151]">
              Персональный код
            </label>
            <input
              id="personal-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              placeholder="#PT-4E82"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={loading}
              className={cx(
                'h-14 w-full rounded-xl border-[1.5px] bg-[#f9fafb] px-4 text-base font-semibold text-[#374151] outline-none transition placeholder:font-normal placeholder:text-navy-700/40',
                error
                  ? 'border-[#ef4444] focus:border-[#ef4444]'
                  : 'border-[#e8edf5] focus:border-navy-700',
              )}
            />
            {!error && (
              <p className="text-xs leading-relaxed text-[#6b7280]">
                Персональный код указан в приглашении на вступительные испытания.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded-[20px] border border-[rgba(239,68,68,0.13)] bg-[#fef2f2] px-6 py-5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-[10px] bg-[#ef4444] text-xs font-extrabold text-white">
                !
              </span>
              <p className="text-[13px] font-semibold text-[#ef4444]">{error}</p>
            </div>
          )}

          <div className="flex flex-col items-center gap-5">
            <button
              type="submit"
              disabled={!code.trim() || loading}
              className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-base font-semibold text-white shadow-[0px_8px_8px_rgba(251,146,60,0.19)] transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Проверка кода...
                </>
              ) : (
                'Продолжить'
              )}
            </button>
            <button
              type="button"
              onClick={() => helpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
              className="text-sm font-semibold text-navy-700 underline underline-offset-2 transition hover:text-navy-800"
            >
              Не получается войти?
            </button>
          </div>

          <div
            ref={helpRef}
            className="flex flex-col gap-3 rounded-[20px] border border-[rgba(39,65,133,0.06)] bg-[#f0f4ff] p-6"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-[10px] bg-navy-700 text-xs font-extrabold text-white">
                i
              </span>
              <p className="text-[13px] font-semibold text-navy-700">Нет персонального кода?</p>
            </div>
            <p className="text-[13px] leading-relaxed text-[#374151]">
              Если вы потеряли персональный код, обратитесь в приёмную комиссию вашей школы.
            </p>
          </div>
        </form>
      </div>
    </EntranceShell>
  );
}
