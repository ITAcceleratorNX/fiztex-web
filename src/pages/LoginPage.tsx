import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  ClipboardList,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Logo, FiztexMark } from '@/components/layout/Logo';

const FEATURES: { icon: LucideIcon; label: string }[] = [
  { icon: Users, label: 'Ученики, родители и учителя' },
  { icon: Calendar, label: 'Расписание и дневник' },
  { icon: ClipboardList, label: 'Вступительные тесты' },
  { icon: Sparkles, label: 'AI-тесты и сервисы' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@fiztex.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy-700 p-12 lg:flex">
        <FiztexMark className="pointer-events-none absolute -right-16 top-1/2 h-[520px] w-[520px] -translate-y-1/2 text-white/[0.06]" />
        <Logo className="w-[17.5rem] max-w-full h-auto" />
        <div className="relative max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-300/90">
            Административная платформа
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-white">
            Всё управление школой — в одном месте
          </h2>
          <p className="mt-4 text-slate-300">
            Fiztex объединяет учебные процессы, приём, коммуникацию с семьями и внутренние сервисы
            Phystech для администраторов и сотрудников.
          </p>

          <ul className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-slate-200">{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-slate-400">Fiztex · Phystech</p>
      </div>

      <div className="flex w-full items-center justify-center bg-slate-50 p-6 lg:w-1/2">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo className="w-60 max-w-full h-auto" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Вход в Fiztex</h1>
          <p className="mt-1 text-sm text-slate-500">
            Войдите под учётной записью администратора школы.
          </p>

          <div className="mt-6 space-y-4">
            <Field label="Email" required>
              <TextInput
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fiztex.local"
                required
              />
            </Field>
            <Field label="Пароль" required>
              <TextInput
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              Войти
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Dev-доступ: admin@fiztex.local / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
