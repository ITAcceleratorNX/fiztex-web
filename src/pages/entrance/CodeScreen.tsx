import { useRef, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { entranceApi } from '@/lib/entranceApi';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import { PhysTechMark } from '@/components/layout/Logo';
import { APP_NAME } from '@/lib/branding';
import { EntranceShell } from './EntranceShell';
import type { ApplicantView } from '@/lib/entranceTypes';

/** Mobile login — Figma `phystech-mobile-login` (105:2828 / 105:2875). */
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
      <div className="mx-auto flex w-full max-w-[390px] flex-col items-center gap-8 px-1">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-2.5 text-white">
            <PhysTechMark className="h-8 w-8" />
            <span className="text-[28px] font-bold tracking-tight">{APP_NAME}</span>
          </div>
          <h1 className="text-[28px] font-bold leading-[1.3] text-white">Вступительный тест</h1>
        </div>

        <form
          onSubmit={submit}
          className="w-full rounded-3xl bg-white p-6 shadow-[0px_8px_24px_0px_rgba(39,65,133,0.13),0px_32px_64px_0px_rgba(0,0,0,0.13)]"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="personal-code" className="text-[13px] font-semibold text-[#1a1f36]">
              Персональный код
            </label>
            <div
              className={cx(
                'flex h-14 items-center gap-3 rounded-xl border-[1.5px] bg-[#f9fafb] px-4',
                error ? 'border-[#ef4444]' : 'border-[#e8edf5] focus-within:border-navy-700',
              )}
            >
              <span className="text-base font-semibold text-navy-700">#</span>
              <input
                id="personal-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/^#/, ''));
                  if (error) setError(null);
                }}
                placeholder="PT-4E82"
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={loading}
                className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold text-[#374151] outline-none placeholder:font-normal placeholder:text-[#9ca3af]"
              />
            </div>
            {error ? (
              <p className="text-center text-xs leading-relaxed text-[#6b7280]">{error}</p>
            ) : (
              <p className="text-xs leading-relaxed text-[#6b7280]">
                Персональный код указан в приглашении на вступительные испытания.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center gap-5">
            <button
              type="submit"
              disabled={!code.trim() || loading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-base font-semibold text-white shadow-[0px_8px_16px_rgba(251,146,60,0.19)] transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Проверка кода...
                </>
              ) : (
                'Войти в систему'
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
            className="mt-6 flex flex-col gap-2 rounded-[20px] border border-[rgba(39,65,133,0.06)] bg-[#f0f4ff] p-4"
          >
            <p className="text-[13px] font-semibold text-navy-700">Нет персонального кода?</p>
            <p className="text-[13px] leading-relaxed text-[#374151]">
              Если вы потеряли персональный код, обратитесь в приёмную комиссию вашей школы.
            </p>
          </div>
        </form>
      </div>
    </EntranceShell>
  );
}
