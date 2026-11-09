import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/layout/Logo';
import { useAuth } from '@/context/AuthContext';
import { MOBILE_ONLY_MESSAGE } from '@/lib/routes';

/**
 * Экран для ученика или родителя, оказавшегося в панели (пилот, пункт 5.1).
 *
 * <p>Новый вход их уже не пускает, но сессия могла остаться с прежней версии, а адрес —
 * прийти ссылкой. Вместо меню администратора и отказов сервера — одно объяснение и выход.
 * Каркас панели здесь не монтируется намеренно: он сам ходит в административные адреса.
 */
export function MobileOnlyNotice() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-line bg-surface p-8 text-center">
        <Logo className="h-12 w-auto self-center" />
        <span className="flex size-12 items-center justify-center rounded-2xl bg-info-bg text-navy-700">
          <Smartphone className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold text-ink">Откройте мобильное приложение</h1>
          <p className="text-13 text-muted">{MOBILE_ONLY_MESSAGE}</p>
        </div>
        <Button variant="secondary" onClick={logout}>
          Выйти
        </Button>
      </div>
    </div>
  );
}
