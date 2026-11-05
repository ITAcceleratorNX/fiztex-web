import { useState, type FormEvent } from 'react';
import { Check, X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { ROUTES, landingRouteForRole } from '@/lib/routes';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { StaffAuthHeading, StaffAuthLayout } from '@/components/layout/StaffAuthLayout';
import { cx } from '@/lib/format';

/**
 * Обязательная смена пароля после входа временным (макет W4).
 *
 * Минимальная длина здесь 8 символов — так в макете; бэкенд принимает от 6
 * (`ChangePasswordRequest`). Клиент строже сервера осознанно: временный пароль выдают
 * в руки, и первый собственный пароль человека не должен быть короче восьми знаков.
 */
const MIN_LENGTH = 8;

/** Правило пароля под полем: выполнено — зелёным с галочкой (W4), нет — серым с крестиком. */
function Rule({ met, children }: { met: boolean; children: string }) {
  return (
    <p className={cx('mt-2 flex items-center gap-1 text-13 leading-4', met ? 'text-planning-success-fg' : 'text-planning-subtle')}>
      {met ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
      {children}
    </p>
  );
}

export function NewPasswordPage() {
  const { admin, temporarySecret, changePassword } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Экран живёт ровно одну ситуацию: вход по временному паролю. Для всех остальных это
  // чужой адрес, и держать его открытым незачем.
  if (!admin) return <Navigate to={ROUTES.staffLogin} replace />;
  if (!admin.mustChangePassword) return <Navigate to={landingRouteForRole(admin.role)} replace />;

  const longEnough = password.length >= MIN_LENGTH;
  const matches = repeat.length > 0 && password === repeat;
  const ready = longEnough && matches && (temporarySecret !== null || current.length > 0);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    setLoading(true);
    try {
      const result = await changePassword(temporarySecret ?? current, password);
      navigate(landingRouteForRole(result.role), { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Не удалось сменить пароль. Проверьте соединение и попробуйте ещё раз.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <StaffAuthLayout>
      <form onSubmit={onSubmit} noValidate>
        <StaffAuthHeading
          title="Новый пароль"
          subtitle={'Вы вошли по\u00a0временному паролю. Задайте свой, и\u00a0временный перестанет работать.'}
        />

        <div className="mt-7 space-y-5">
          {/* Временный пароль живёт в памяти вкладки и теряется при перезагрузке —
              тогда он спрашивается полем: без него сервер смену не примет. */}
          {temporarySecret === null && (
            <Field label="Временный пароль" size="lg">
              <PasswordInput
                appearance="filled"
                value={current}
                onChange={setCurrent}
                placeholder="Тот, что выдала школа"
                autoComplete="current-password"
                autoFocus
              />
            </Field>
          )}

          <div>
            <Field label="Новый пароль" size="lg">
              <PasswordInput
                appearance="filled"
                value={password}
                onChange={setPassword}
                placeholder="Придумайте пароль"
                autoComplete="new-password"
                autoFocus={temporarySecret !== null}
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
          Сохранить и войти
        </Button>
      </form>
    </StaffAuthLayout>
  );
}
