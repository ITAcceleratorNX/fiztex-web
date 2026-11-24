import { useState, type FormEvent } from 'react';
import { Check, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { ROUTES, landingRouteForRole } from '@/lib/routes';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { StaffAuthHeading, StaffAuthLayout } from '@/components/layout/StaffAuthLayout';
import { cx } from '@/lib/format';

/** Бэкенд принимает пароль от 8 символов (`ActivateByCodeRequest`). */
const MIN_LENGTH = 8;

function Rule({ met, children }: { met: boolean; children: string }) {
  return (
    <p className={cx('mt-2 flex items-center gap-1 text-13 leading-4', met ? 'text-planning-success-fg' : 'text-planning-subtle')}>
      {met ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
      {children}
    </p>
  );
}

/**
 * Первый вход по коду активации. Код выдаёт администратор («Сбросить доступ» или создание
 * сотрудника); человек вводит телефон, код и сам придумывает пароль — после этого он уже
 * вошёл, временного пароля и экрана смены нет.
 *
 * Отказ сервера один на все случаи («код неверный или уже использован»): уточнять, что
 * именно не подошло, он не должен, и экран этого не делает.
 */
export function ActivatePage() {
  const { activate } = useAuth();
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const longEnough = password.length >= MIN_LENGTH;
  const matches = repeat.length > 0 && password === repeat;
  const ready = login.trim().length > 0 && code.trim().length > 0 && longEnough && matches;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    setLoading(true);
    try {
      const result = await activate(login.trim(), code.trim(), password);
      navigate(landingRouteForRole(result.role), { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'MOBILE_ONLY_ROLE'
          ? err.message
          : err instanceof ApiError && err.status === 400
            ? 'Код неверный или уже использован. Проверьте телефон и код или попросите администратора выдать новый.'
            : err instanceof ApiError && err.status !== 0
              ? err.message
              : 'Не удалось активировать доступ. Проверьте соединение и попробуйте ещё раз.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <StaffAuthLayout>
      <form onSubmit={onSubmit} noValidate>
        <StaffAuthHeading
          title="Активация доступа"
          subtitle={'Введите код, который выдал администратор, и придумайте пароль'}
        />

        <div className="mt-7 space-y-5">
          <Field label="Телефон или email" size="lg">
            <TextInput
              appearance="filled"
              type="text"
              autoComplete="username"
              placeholder="+7 700 000 00 00"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoFocus
            />
          </Field>

          <Field label="Код активации" size="lg">
            <TextInput
              appearance="filled"
              type="text"
              autoComplete="one-time-code"
              placeholder="Код от администратора"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={Boolean(error)}
            />
          </Field>

          <div>
            <Field label="Новый пароль" size="lg">
              <PasswordInput
                appearance="filled"
                value={password}
                onChange={setPassword}
                placeholder="Придумайте пароль"
                autoComplete="new-password"
              />
            </Field>
            <Rule met={longEnough}>Не короче 8 символов</Rule>
          </div>

          <div>
            <Field label="Повторите пароль" size="lg">
              <PasswordInput
                appearance="filled"
                value={repeat}
                onChange={setRepeat}
                placeholder="Ещё раз"
                autoComplete="new-password"
                invalid={repeat.length > 0 && !matches}
              />
            </Field>
            <Rule met={matches}>Пароли совпадают</Rule>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-13 leading-snug text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-5 w-full" loading={loading} disabled={!ready}>
          Активировать и войти
        </Button>

        <Link to={ROUTES.staffLogin} className={buttonClassName({ variant: 'soft', size: 'lg', className: 'mt-3 w-full' })}>
          Вернуться ко входу
        </Link>
      </form>
    </StaffAuthLayout>
  );
}
