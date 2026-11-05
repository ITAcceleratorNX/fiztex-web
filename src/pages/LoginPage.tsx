import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { StaffAuthHeading, StaffAuthLayout } from '@/components/layout/StaffAuthLayout';

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
    <StaffAuthLayout>
      <form onSubmit={onSubmit} noValidate>
        <StaffAuthHeading title="Добро пожаловать!" subtitle="Войдите в свою учётную запись" />

        <div className="mt-7 space-y-5">
          <Field label="Телефон или email" size="lg">
            <TextInput
              appearance="filled"
              type="text"
              autoComplete="username"
              placeholder="+7 700 000 00 00"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <div>
            {/* Красной рамкой — только пароль, как в W2: сервер не говорит, какой из двух
                реквизитов не подошёл, а логин человек обычно набрал верно. */}
            <Field label="Пароль" size="lg">
              <PasswordInput
                appearance="filled"
                value={password}
                onChange={setPassword}
                placeholder="Введите пароль"
                autoComplete="current-password"
                invalid={Boolean(error)}
              />
            </Field>
            {error && (
              <p role="alert" className="mt-2 text-13 leading-snug text-red-600">
                {error}
              </p>
            )}
            <div className="mt-3 text-right">
              <Link
                to={ROUTES.staffForgotPassword}
                className="text-sm font-medium text-brand-500 transition hover:text-brand-600"
              >
                Забыли пароль?
              </Link>
            </div>
          </div>
        </div>

        <Button type="submit" size="lg" className="mt-5 w-full" loading={loading}>
          Войти
        </Button>

        <p className="mt-5 text-center text-sm text-planning-subtle">
          Доступ выдаёт администратор школы.
        </p>
      </form>
    </StaffAuthLayout>
  );
}
