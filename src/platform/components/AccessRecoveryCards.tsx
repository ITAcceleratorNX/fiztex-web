import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { ProfileCard, ProfileCardTitle } from './ProfileChrome';
import { IssuedSecretModal } from './IssuedSecretModal';
import { issueTemporaryPassword, reissueCode, resetAccess, resetPin } from '../services';
import type { AccountStatus } from '../types';
import { platformErrorMessage } from '../platformErrorMessage';

/**
 * Блок «Вход и восстановление» карточек ученика и родителя (макет D5 и D5-P; с 26.11 —
 * правая колонка новых карточек, Figma `phyztex` 2243:30309 и 2243:30581).
 *
 * Отдельная карточка, а не поля в «Основной информации»: здесь не сведения о человеке, а
 * действия с его доступом, и у каждого есть последствие, которое нужно прочитать до
 * нажатия. Выданное значение показывается один раз в `IssuedSecretModal`.
 *
 * **Состояние доступа читается из того, что отдаёт карточка.** Ни `loginMethods`, ни даты
 * выдачи кода админские вьюхи профиля не возвращают, поэтому блок говорит только то, что
 * знает: есть ли PIN у ученика и активирован ли аккаунт родителя.
 */

/** Узкая карточка правой колонки: сведения строками, ниже действия и примечание. */
function AccessCard({
  facts,
  actions,
  note,
  children,
}: {
  facts: Array<{ label: string; value: ReactNode }>;
  actions: ReactNode;
  note: string;
  children: ReactNode;
}) {
  return (
    <ProfileCard className="flex h-fit flex-col gap-4">
      <ProfileCardTitle>Вход и восстановление</ProfileCardTitle>
      <dl>
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-center justify-between gap-3 border-b border-neutral-bg py-2.5 text-sm last:border-b-0">
            <dt className="text-muted">{fact.label}</dt>
            <dd className="text-right font-semibold text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-3 border-t border-neutral-bg pt-4">
        {actions}
        <p className="text-xs text-subtle">{note}</p>
      </div>
      {children}
    </ProfileCard>
  );
}

function ActionRow({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div>
        <p className="text-13 font-semibold leading-normal text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-normal text-subtle">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function StudentAccessCard({
  accountId,
  pinSet,
  onChanged,
}: {
  accountId: number;
  pinSet: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [pending, setPending] = useState<'reissue' | 'resetPin' | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending === 'reissue') {
        const res = await reissueCode(String(accountId));
        setPending(null);
        setIssuedCode(res.issuedCode ?? null);
      } else {
        await resetPin(String(accountId));
        setPending(null);
        toast.success('PIN сброшен. Ученик придумает новый при следующем входе.');
      }
      onChanged();
    } catch (error) {
      toast.error(platformErrorMessage(error, 'Не удалось изменить доступ. Попробуйте ещё раз.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessCard
      facts={[
        { label: 'Способ входа', value: 'Код и PIN' },
        { label: 'Персональный код', value: 'Скрыт' },
        { label: 'PIN', value: pinSet ? <Badge tone="green">Создан</Badge> : <Badge tone="gray">Не создан</Badge> },
      ]}
      note="Текущий PIN не показывается."
      actions={
        <>
          <ActionRow
            title="Перевыпустить персональный код"
            description="Старый перестанет работать, новый передаст классный руководитель."
            action={<Button variant="secondary" size="sm" onClick={() => setPending('reissue')}>Перевыпустить</Button>}
          />
          <ActionRow
            title="Сбросить PIN"
            description="Новый PIN ученик придумает при следующем входе."
            action={(
              <Button variant="secondary" size="sm" disabled={!pinSet} onClick={() => setPending('resetPin')}>
                Сбросить PIN
              </Button>
            )}
          />
        </>
      }
    >
      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        loading={busy}
        onConfirm={() => void confirm()}
        title={pending === 'resetPin' ? 'Сбросить PIN?' : 'Перевыпустить персональный код?'}
        message={
          pending === 'resetPin'
            ? 'Ученик войдёт по прежнему коду и придумает новый PIN.'
            : 'Прежний код перестанет работать сразу. Новый код показывается один раз — передайте его ученику.'
        }
        confirmLabel={pending === 'resetPin' ? 'Сбросить PIN' : 'Перевыпустить'}
      />

      <IssuedSecretModal
        open={issuedCode !== null}
        title="Персональный код выдан"
        value={issuedCode}
        note="Прежний код больше не работает. PIN у ученика остался прежним."
        onClose={() => setIssuedCode(null)}
      />
    </AccessCard>
  );
}

export function ParentAccessCard({
  accountId,
  accountStatus,
  onChanged,
}: {
  accountId: number;
  accountStatus: AccountStatus;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [issued, setIssued] = useState<{ title: string; value: string; note: string } | null>(null);
  const [pending, setPending] = useState<'code' | 'password' | null>(null);
  const [busy, setBusy] = useState(false);

  // Пароль родителя появляется при активации, и отдельного поля «пароль задан» админские
  // вьюхи не отдают: состояние аккаунта — единственное, что об этом известно.
  const passwordSet = accountStatus !== 'NOT_ACTIVATED';

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending === 'code') {
        const res = await resetAccess(String(accountId), 'PARENT');
        setPending(null);
        if (res.issuedCode) {
          setIssued({
            title: 'Код восстановления выдан',
            value: res.issuedCode,
            note: 'Родитель войдёт по нему и задаст новый пароль. Прежние сессии завершены.',
          });
        }
      } else {
        const password = await issueTemporaryPassword(String(accountId));
        setPending(null);
        if (password) {
          setIssued({
            title: 'Временный пароль выдан',
            value: password,
            note: 'Родитель войдёт с ним по телефону, и система сразу попросит придумать новый пароль.',
          });
        }
      }
      onChanged();
    } catch (error) {
      toast.error(platformErrorMessage(error, 'Не удалось изменить доступ. Попробуйте ещё раз.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessCard
      facts={[
        { label: 'Способ входа', value: 'Телефон и пароль' },
        { label: 'Пароль', value: passwordSet ? <Badge tone="green">Задан</Badge> : <Badge tone="gray">Не задан</Badge> },
      ]}
      note="Текущий пароль не показывается. Выданный код или пароль покажется один раз."
      actions={
        <>
          <ActionRow
            title="Одноразовый код восстановления"
            description="Родитель войдёт по нему и задаст новый пароль. Текущие сессии завершатся."
            action={<Button variant="secondary" size="sm" onClick={() => setPending('code')}>Выдать код</Button>}
          />
          <ActionRow
            title="Временный пароль"
            description="Система попросит сменить его при входе."
            action={<Button variant="secondary" size="sm" onClick={() => setPending('password')}>Выдать пароль</Button>}
          />
        </>
      }
    >
      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        loading={busy}
        onConfirm={() => void confirm()}
        title={pending === 'password' ? 'Выдать временный пароль?' : 'Выдать код восстановления?'}
        message={
          pending === 'password'
            ? 'Прежний пароль перестанет работать, а открытые сессии завершатся. Пароль показывается один раз.'
            : 'Пароль родителя сбросится, статус станет «не активирован», открытые сессии завершатся.'
        }
        confirmLabel={pending === 'password' ? 'Выдать пароль' : 'Выдать код'}
        danger
      />

      <IssuedSecretModal
        open={issued !== null}
        title={issued?.title ?? ''}
        value={issued?.value ?? null}
        note={issued?.note ?? ''}
        onClose={() => setIssued(null)}
      />
    </AccessCard>
  );
}
