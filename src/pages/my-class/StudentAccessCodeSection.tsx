import { useState } from 'react';
import { Copy, EyeOff, KeyRound, RefreshCw } from 'lucide-react';
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
  // Выданный код помнится вместе с учеником, которому выдан. Шторка листает учеников, не
  // пересоздавая карточку, и код первого иначе остался бы на экране под именем второго —
  // учитель продиктовал бы чужой код.
  const [issued, setIssued] = useState<{ studentProfileId: number; value: string } | null>(null);
  const code = issued?.studentProfileId === studentProfileId ? issued.value : null;
  const [confirming, setConfirming] = useState(false);

  const row = access.data?.find((item) => item.studentProfileId === studentProfileId);
  const issuedBefore = Boolean(row?.codeIssuedAt);

  async function send(confirmReissue: boolean) {
    try {
      const result = await issue.mutateAsync({ studentProfileId, confirmReissue });
      setConfirming(false);
      setIssued(result.issuedCode ? { studentProfileId, value: result.issuedCode } : null);
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
      // Подпись кнопки не меняется (T2): что код в буфере, говорит всплывающее «Код скопирован».
      toast.success('Код скопирован');
    } catch {
      toast.error('Не удалось скопировать — перепишите код вручную.');
    }
  }

  if (access.isPending || access.isError) return null;

  // Карточка по макету T1–T3 (2460:3543): слева подпись, код или маска и что с учеником, справа
  // действия 38 со значками. Строкой, пока хватает ширины шторки; на узкой — кнопки под текстом.
  return (
    <section className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-drawer-card border border-planning-line bg-surface px-5 py-4">
      <div className="min-w-0 flex-1">
        <h3 className="text-11 font-bold uppercase leading-tight tracking-filter text-planning-muted">
          Персональный код
        </h3>

        {!row ? (
          <p className="mt-1.5 text-13 leading-4 text-planning-muted">
            Администратор не открыл вам выдачу кода этому ученику.
          </p>
        ) : (
          <>
            {code ? (
              <p className="mt-1.5 select-all text-xl font-bold leading-6 tracking-code text-navy-700">{code}</p>
            ) : (
              <p aria-label="Код скрыт" className="mt-1.5 text-xl font-bold leading-6 tracking-code-mask text-planning-subtle">
                •••• ••••
              </p>
            )}

            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-13 leading-4 text-planning-muted">
              {row.pinSet ? (
                <span className="inline-flex items-center gap-1.5 text-planning-success-fg">
                  <span className="size-1.5 rounded-full bg-planning-success-fg" aria-hidden="true" />
                  Уже входил в приложение
                </span>
              ) : (
                <span>Ученик ещё не входил в приложение</span>
              )}
              {issuedBefore && !code && <span>· код выдан {formatDate(row.codeIssuedAt)}</span>}
            </p>

            {row.grantExpiresAt && (
              <p className="mt-1 text-xs text-planning-subtle">
                Ваше разрешение действует до {formatDate(row.grantExpiresAt)}
              </p>
            )}
            {row.canIssueCode === false && (
              <p className="mt-1 text-xs text-amber-700">
                Аккаунт ученика выключен — код сейчас не выдать.
              </p>
            )}
          </>
        )}
      </div>

      {row && (
        <div className="flex shrink-0 gap-2">
          {code ? (
            <>
              <Button size="action" icon={<Copy className="size-4" />} onClick={() => void copy()}>
                Скопировать
              </Button>
              <Button
                size="action"
                variant="secondary"
                className="text-planning-ink"
                icon={<EyeOff className="size-4" />}
                onClick={() => setIssued(null)}
              >
                Скрыть
              </Button>
            </>
          ) : (
            <Button
              size="action"
              variant="secondary"
              className="text-planning-ink"
              icon={issuedBefore ? <RefreshCw className="size-4" /> : <KeyRound className="size-4" />}
              disabled={row.canIssueCode === false}
              loading={issue.isPending}
              onClick={() => (issuedBefore ? setConfirming(true) : void send(false))}
            >
              {issuedBefore ? 'Выдать новый код' : 'Выдать код'}
            </Button>
          )}
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
