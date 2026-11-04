import { UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/lib/routes';
import { StaffAuthCard } from './StaffAuthCard';

/**
 * «Забыли пароль?» (макет W3) — экран без формы, и это не упрощение.
 *
 * Самостоятельного восстановления в системе нет вовсе: ни SMS, ни писем. Пароль
 * сбрасывает администратор школы временным паролем (AUTH-BE-001 §9), поэтому
 * единственное честное содержание экрана — сказать, к кому идти.
 */
export function ForgotPasswordPage() {
  return (
    <StaffAuthCard>
      <h1 className="text-center text-2xl font-bold text-slate-900">Забыли пароль?</h1>
      <p className="mt-1 text-center text-13 text-slate-500">Пароль восстанавливает школа</p>

      <div className="mt-8 flex gap-3 rounded-xl bg-slate-50 p-4">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">Обратитесь к администратору школы</p>
          <p className="mt-1 text-13 text-slate-500">
            Он задаст временный пароль. Зайдите с ним, и система попросит придумать новый.
          </p>
        </div>
      </div>

      <p className="mt-4 text-13 text-slate-400">Восстановление по SMS пока не работает.</p>

      <Link to={ROUTES.staffLogin} className="mt-6 block">
        <Button variant="secondary" className="w-full">
          Вернуться ко входу
        </Button>
      </Link>
    </StaffAuthCard>
  );
}
