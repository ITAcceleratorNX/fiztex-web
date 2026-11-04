import { useState, type FormEvent } from 'react';
import { Check, X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { ROUTES, landingRouteForRole } from '@/lib/routes';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { cx } from '@/lib/format';
import { StaffAuthCard } from './StaffAuthCard';
import { PasswordInput } from './PasswordInput';

/**
 * Обязательная смена пароля после входа временным (макет W4).
 *
 * Минимальная длина здесь 8 символов — так в макете; бэкенд принимает от 6
 * (`ChangePasswordRequest`). Клиент строже сервера осознанно: временный пароль выдают
 * в руки, и первый собственный пароль человека не должен быть короче восьми знаков.
 */
const MIN_LENGTH = 8;

function Rule({ met, children }: { met: boolean; children: string }) {
  return (
    <p className={cx('mt-1.5 flex items-center gap-1.5 text-13', met ? 'text-emerald-600' : 'text-slate-400')}>
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
    <StaffAuthCard>
      <form onSubmit={onSubmit} noValidate>
        <h1 className="text-center text-2xl font-bold text-slate-900">Новый пароль</h1>
        <p className="mt-1 text-center text-13 text-slate-500">
          Вы вошли по временному паролю. Задайте свой, и временный перестанет работать.
        </p>

        <div className="mt-8 space-y-4">
          {/* Временный пароль живёт в памяти вкладки и теряется при перезагрузке —
              тогда он спрашивается полем: без него сервер смену не примет. */}
          {temporarySecret === null && (
            <Field label="Временный пароль" required>
              <PasswordInput
                value={current}
                onChange={setCurrent}
                placeholder="Тот, что выдала школа"
                autoComplete="current-password"
                autoFocus
              />
            </Field>
          )}

          <div>
            <Field label="Новый пароль" required>
              <PasswordInput
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
            <Field label="Повторите пароль" required>
              <PasswordInput
                value={repeat}
                onChange={setRepeat}
                placeholder="Ещё раз"
                autoComplete="new-password"
                invalid={repeat.length > 0 && !matches}
              />
            </Field>
            <Rule met={matches}>Пароли совпадают</Rule>
          </div>

          {error && (
            <p role="alert" className="text-13 text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={loading} disabled={!ready}>
            Сохранить и войти
          </Button>
        </div>
      </form>
    </StaffAuthCard>
  );
}
