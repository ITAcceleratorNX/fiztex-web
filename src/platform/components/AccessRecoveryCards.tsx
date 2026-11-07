import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { ProfileCard, ProfileCardTitle, ProfileInfoField, SoftBadge } from './ProfileChrome';
import { IssuedSecretModal } from './IssuedSecretModal';
import { issueTemporaryPassword, reissueCode, resetAccess, resetPin } from '../services';
import type { AccountStatus } from '../types';
import { platformErrorMessage } from '../platformErrorMessage';

/**
 * Блок «Вход и восстановление» карточек ученика и родителя (макет D5 и D5-P).
 *
 * Отдельная карточка, а не поля в «Основной информации»: здесь не сведения о человеке, а
 * действия с его доступом, и у каждого есть последствие, которое нужно прочитать до
 * нажатия. Выданное значение показывается один раз в `IssuedSecretModal`.
 *
 * **Состояние доступа читается из того, что отдаёт карточка.** Ни `loginMethods`, ни даты
 * выдачи кода админские вьюхи профиля не возвращают, поэтому блок говорит только то, что
 * знает: есть ли PIN у ученика и активирован ли аккаунт родителя.
 */

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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1a1f36]">{title}</p>
        <p className="mt-0.5 max-w-xl text-13 text-slate-500">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-slate-100" />;
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
    <ProfileCard className="flex flex-col gap-5">
      <div>
        <ProfileCardTitle>Вход и восстановление</ProfileCardTitle>
        <p className="mt-1 max-w-2xl text-13 text-slate-500">
          Текущий PIN не показывается. Если ученик забыл PIN, сбросьте его — новый он придумает сам.
        </p>
      </div>
      <Divider />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <ProfileInfoField label="Способ входа" value="Код и PIN" />
        <ProfileInfoField
          label="Персональный код"
          value={<span className="text-slate-500">Скрыт</span>}
        />
        <ProfileInfoField
          label="Статус PIN-кода"
          value={pinSet ? <SoftBadge tone="green">Создан</SoftBadge> : <SoftBadge tone="gray">Не создан</SoftBadge>}
        />
      </div>
      <Divider />

      <ActionRow
        title="Перевыпустить персональный код"
        description="Если код потерян. Старый перестанет работать, новый передаст классный руководитель."
        action={
          <Button variant="secondary" onClick={() => setPending('reissue')}>
            Перевыпустить
          </Button>
        }
      />
      <ActionRow
        title="Сбросить PIN"
        description="Ученик придумает новый PIN при следующем входе по коду. Код при этом не меняется."
        action={
          <Button variant="secondary" disabled={!pinSet} onClick={() => setPending('resetPin')}>
            Сбросить PIN
          </Button>
        }
      />

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
    </ProfileCard>
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
    <ProfileCard className="flex flex-col gap-5">
      <div>
        <ProfileCardTitle>Вход и восстановление</ProfileCardTitle>
        <p className="mt-1 max-w-2xl text-13 text-slate-500">
          Текущий пароль не показывается. Выданный код или пароль покажется один раз.
        </p>
      </div>
      <Divider />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <ProfileInfoField label="Способ входа" value="Телефон и пароль" />
        <ProfileInfoField
          label="Пароль"
          value={passwordSet ? <SoftBadge tone="green">Задан</SoftBadge> : <SoftBadge tone="gray">Не задан</SoftBadge>}
        />
      </div>
      <Divider />

      <ActionRow
        title="Одноразовый код восстановления"
        description="Родитель войдёт по нему и задаст новый пароль. Текущие сессии завершатся."
        action={
          <Button variant="secondary" onClick={() => setPending('code')}>
            Выдать код
          </Button>
        }
      />
      <ActionRow
        title="Временный пароль"
        description="Родитель войдёт с ним по телефону, и система сразу попросит сменить пароль."
        action={
          <Button variant="secondary" onClick={() => setPending('password')}>
            Выдать пароль
          </Button>
        }
      />

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
    </ProfileCard>
  );
}
