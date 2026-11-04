import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { StaffAuthCard } from './auth/StaffAuthCard';
import { PasswordInput } from './auth/PasswordInput';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      // Сервер на все отказы отвечает одинаково (§9): какой именно реквизит не подошёл
      // и существует ли вообще такой человек в школе — не его дело сообщать.
      setError(
        err instanceof ApiError
          ? 'Неверный телефон или пароль. Проверьте данные или восстановите пароль.'
          : 'Не удалось войти. Проверьте соединение и попробуйте ещё раз.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <StaffAuthCard>
      <form onSubmit={onSubmit} noValidate>
        <h1 className="text-center text-2xl font-bold text-slate-900">Добро пожаловать!</h1>
        <p className="mt-1 text-center text-13 text-slate-500">Войдите в свою учётную запись</p>

        <div className="mt-8 space-y-4">
          <Field label="Телефон или email" required>
            <TextInput
              type="text"
              autoComplete="username"
              placeholder="+7 700 000 00 00"
              value={email}
              error={Boolean(error)}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <div>
            <Field label="Пароль" required>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Введите пароль"
                autoComplete="current-password"
                invalid={Boolean(error)}
              />
            </Field>
            {error && (
              <p role="alert" className="mt-1.5 text-13 text-red-600">
                {error}
              </p>
            )}
            <div className="mt-1.5 text-right">
              <Link
                to={ROUTES.staffForgotPassword}
                className="text-13 font-medium text-brand-500 hover:text-brand-600"
              >
                Забыли пароль?
              </Link>
            </div>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Войти
          </Button>
        </div>

        <p className="mt-6 text-center text-13 text-slate-400">
          Доступ выдаёт администратор школы.
        </p>
      </form>
    </StaffAuthCard>
  );
}
