import { useState } from 'react';
import { Check, Copy, EyeOff } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useIssueStudentAccessCode, useTeacherStudentAccess } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { formatDate } from '@/lib/format';

/**
 * Персональный код ученика в панели классного руководителя (макет T1–T3).
 *
 * **«Показать код» из макета физически невозможен.** Действующий код лежит в базе
 * хэшем, и показать его нельзя ни учителю, ни администратору (AUTH-BE-001 §10) —
 * единственное, что умеет сервер, это выпустить новый. Поэтому кнопка называет то, что
 * произойдёт: «Выдать код», а когда код уже есть — «Выдать новый код» с предупреждением,
 * что прежний перестанет работать. Выданное значение показывается здесь один раз.
 *
 * **Список приходит по разрешениям, а не по классу.** Право выдавать коды администратор
 * открывает ученик за учеником, поэтому классный руководитель видит блок не у всех: у
 * остальных он честно говорит, что разрешения нет, вместо неработающей кнопки.
 */
export function StudentAccessCodeSection({ studentProfileId }: { studentProfileId: number }) {
  const toast = useToast();
  const access = useTeacherStudentAccess();
  const issue = useIssueStudentAccessCode();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const row = access.data?.find((item) => item.studentProfileId === studentProfileId);
  const issuedBefore = Boolean(row?.codeIssuedAt);

  async function send(confirmReissue: boolean) {
    try {
      const result = await issue.mutateAsync({ studentProfileId, confirmReissue });
      setConfirming(false);
      setCopied(false);
      setCode(result.issuedCode ?? null);
    } catch (error) {
      // Код мог появиться у ученика, пока панель была открыта, — тогда сервер просит
      // подтвердить перевыпуск. Это не ошибка ввода, а вопрос к человеку.
      if (error instanceof ApiError && error.code === 'STUDENT_CODE_REISSUE_CONFIRM') {
        setConfirming(true);
        return;
      }
      toast.error(error instanceof ApiError ? error.message : 'Не удалось выдать код. Попробуйте ещё раз.');
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Код скопирован');
    } catch {
      toast.error('Не удалось скопировать — перепишите код вручную.');
    }
  }

  if (access.isPending || access.isError) return null;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-line">
      <h3 className="text-10 font-semibold uppercase tracking-filter text-slate-400">
        Персональный код
      </h3>

      {!row ? (
        <p className="mt-2 text-13 text-slate-500">
          Администратор не открыл вам выдачу кода этому ученику.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {code ? (
              <p className="select-all font-mono text-xl font-bold tracking-widest text-brand-600">
                {code}
              </p>
            ) : (
              <p aria-label="Код скрыт" className="text-xl font-bold tracking-widest text-slate-300">
                ••••••••
              </p>
            )}

            <p className="mt-1 text-13 text-slate-500">
              {row.pinSet ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                  <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  Уже входил в приложение
                </span>
              ) : (
                'Ученик ещё не заходил в приложение'
              )}
              {issuedBefore && !code && ` · код выдан ${formatDate(row.codeIssuedAt)}`}
            </p>

            {row.grantExpiresAt && (
              <p className="mt-0.5 text-11 text-slate-400">
                Ваше разрешение действует до {formatDate(row.grantExpiresAt)}
              </p>
            )}
            {row.canIssueCode === false && (
              <p className="mt-0.5 text-11 text-amber-700">
                Аккаунт ученика выключен — код сейчас не выдать.
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-2">
            {code ? (
              <>
                <Button
                  size="sm"
                  icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  onClick={() => void copy()}
                >
                  {copied ? 'Скопировано' : 'Скопировать'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<EyeOff className="size-4" />}
                  onClick={() => { setCode(null); setCopied(false); }}
                >
                  Скрыть
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant={issuedBefore ? 'secondary' : 'primary'}
                disabled={row.canIssueCode === false}
                loading={issue.isPending}
                onClick={() => (issuedBefore ? setConfirming(true) : void send(false))}
              >
                {issuedBefore ? 'Выдать новый код' : 'Выдать код'}
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        loading={issue.isPending}
        onConfirm={() => void send(true)}
        title="Выдать новый код?"
        message="Прежний код перестанет работать сразу. PIN ученика не сбрасывается — он войдёт новым кодом и прежним PIN."
        confirmLabel="Выдать новый код"
      />
    </section>
  );
}
