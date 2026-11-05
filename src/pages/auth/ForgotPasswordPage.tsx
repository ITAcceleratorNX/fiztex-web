import { UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonClassName } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { StaffAuthHeading, StaffAuthLayout } from '@/components/layout/StaffAuthLayout';
import { ROUTES } from '@/lib/routes';

/**
 * «Забыли пароль?» (макет W3) — экран без формы, и это не упрощение.
 *
 * Самостоятельного восстановления в системе нет вовсе: ни SMS, ни писем. Пароль
 * сбрасывает администратор школы временным паролем (AUTH-BE-001 §9), поэтому
 * единственное честное содержание экрана — сказать, к кому идти.
 */
export function ForgotPasswordPage() {
  return (
    <StaffAuthLayout>
      <StaffAuthHeading title="Забыли пароль?" subtitle="Пароль восстанавливает школа" />

      <Callout
        className="mt-7"
        icon={<UserRound className="size-5" />}
        title="Обратитесь к администратору школы"
      >
        Он задаст временный пароль. Войдите с{'\u00a0'}ним, и{'\u00a0'}система попросит придумать новый.
      </Callout>

      <p className="mt-5 text-center text-sm text-planning-subtle">Восстановление по SMS пока не работает.</p>

      <Link to={ROUTES.staffLogin} className={buttonClassName({ variant: 'soft', size: 'lg', className: 'mt-5 w-full' })}>
        Вернуться ко входу
      </Link>
    </StaffAuthLayout>
  );
}
