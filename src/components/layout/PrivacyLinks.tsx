import { Link } from 'react-router-dom';
import { cx } from '@/lib/format';
import { ROUTES } from '@/lib/routes';

/**
 * Ссылки на политику конфиденциальности, обе языковые версии.
 *
 * <p>Отдельный компонент, потому что стоят они в трёх местах (страница входа,
 * подвал публичного раздела, экран ввода кода) и обязаны вести в одно и то же.
 * Разъехавшиеся ссылки на юридический документ — ровно та ошибка, которую
 * дешевле предотвратить, чем заметить.
 *
 * <p>{@code tone} — не украшение: экран ввода кода тёмный, публичные страницы
 * светлые, и без переключения ссылка на одном из них была бы нечитаемой.
 */
export function PrivacyLinks({
  tone = 'light',
  className,
}: {
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const link = cx(
    'underline underline-offset-2 transition',
    tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-slate-600',
  );

  return (
    <p className={cx('text-xs', className)}>
      <Link to={ROUTES.privacyIn('ru')} className={link}>
        Политика конфиденциальности
      </Link>
      <span className={cx('mx-1.5', tone === 'dark' ? 'text-white/30' : 'text-slate-300')}>·</span>
      <Link to={ROUTES.privacyIn('en')} lang="en" className={link}>
        Privacy Policy
      </Link>
    </p>
  );
}
