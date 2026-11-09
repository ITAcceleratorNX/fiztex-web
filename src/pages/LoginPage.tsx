import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { MOBILE_ONLY_MESSAGE, ROUTES } from '@/lib/routes';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
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
      // Исключение — ученик и родитель (пилот, пункт 5.1): реквизиты у них верные, а вход
      // не тот. «Неверный пароль» отправил бы их его восстанавливать.
      setError(
        err instanceof ApiError && err.code === 'MOBILE_ONLY_ROLE'
          ? MOBILE_ONLY_MESSAGE
          : err instanceof ApiError
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
        {/* Пилот, пункт 1.2: вход один для учителей и администрации — подзаголовок говорит
            это прямо, чтобы учитель не решил, что форма только для администратора. */}
        <StaffAuthHeading title="Добро пожаловать!" subtitle="Вход для сотрудников школы: учителей и администрации" />

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

        {/* Пилот, пункт 1.3: ученик и родитель находили форму и пробовали войти. Веб-кабинета
            у них нет — подсказываем, где их вход, а не предлагаем несуществующий. */}
        <Callout
          className="mt-5"
          icon={<Smartphone className="size-5" />}
          title="Ученикам и родителям — в мобильное приложение"
        >
          {MOBILE_ONLY_MESSAGE}
        </Callout>

        <p className="mt-5 text-center text-sm text-planning-subtle">
          Доступ выдаёт администратор школы.
        </p>
      </form>
    </StaffAuthLayout>
  );
}
