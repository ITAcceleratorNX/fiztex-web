import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, MapPin, Megaphone } from 'lucide-react';
import { usePublicAnnouncementGrades, usePublicAnnouncements } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PUBLIC_TITLE } from '@/lib/branding';
import { EntranceShell } from '@/pages/entrance/EntranceShell';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { buttonClassName } from '@/components/ui/Button';
import { cx, formatDateTime } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import type { PublicAnnouncementItem } from '@/lib/announcementsApi';

/**
 * Публичный раздел «Вступительные тесты» — главная страница сайта (ТЗ §4).
 *
 * <p>Открывается без входа и без персонального кода. Класс здесь — только фильтр
 * поиска: он ничего не решает о правах. После «Начать тест» поступающий вводит
 * код, а класс и назначенные тесты система берёт из его карточки.
 */
export function PublicAnnouncementsPage() {
  useDocumentTitle(PUBLIC_TITLE);
  const [grade, setGrade] = useState('');
  const grades = usePublicAnnouncementGrades();
  const announcements = usePublicAnnouncements(grade);

  return (
    <EntranceShell size="xl">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-navy-800 sm:text-4xl">
          Вступительные тесты
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Здесь школа заранее публикует, к каким предметам и темам готовиться, когда и как
          пройдёт тестирование и какие правила нужно соблюдать.
        </p>
        <div className="mt-6">
          <Link to={ROUTES.entrance} className={buttonClassName()}>
            У меня есть персональный код
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </header>

      {grades.data && grades.data.length > 0 && (
        <nav aria-label="Фильтр по классу" className="mt-10 flex flex-wrap justify-center gap-2">
          <GradeChip active={grade === ''} onClick={() => setGrade('')}>
            Все классы
          </GradeChip>
          {grades.data.map((item) => (
            <GradeChip key={item} active={grade === item} onClick={() => setGrade(item)}>
              {item}
            </GradeChip>
          ))}
        </nav>
      )}

      <div className="mt-8">
        {announcements.isPending && <LoadingBlock label="Загружаем анонсы…" />}

        {announcements.isError && (
          <ErrorBlock
            message="Не удалось загрузить анонсы. Проверьте соединение и попробуйте ещё раз."
            onRetry={() => announcements.refetch()}
          />
        )}

        {announcements.isSuccess && announcements.data.length === 0 && (
          <EmptyBlock
            icon={<Megaphone className="h-7 w-7" />}
            title={grade ? `Для «${grade}» пока нет анонсов` : 'Анонсов пока нет'}
            description={
              grade
                ? 'Выберите другой класс или зайдите позже — школа публикует анонсы заранее.'
                : 'Школа ещё не опубликовала информацию о вступительных тестах. Загляните позже.'
            }
          />
        )}

        {announcements.isSuccess && announcements.data.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {announcements.data.map((item) => (
              <AnnouncementCard key={item.id} announcement={item} />
            ))}
          </ul>
        )}
      </div>
    </EntranceShell>
  );
}

function GradeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'rounded-full px-4 py-2 text-sm font-semibold transition ring-1 ring-inset',
        active
          ? 'bg-navy-700 text-white ring-navy-700'
          : 'bg-white text-slate-600 ring-slate-200 hover:text-navy-800',
      )}
    >
      {children}
    </button>
  );
}

function AnnouncementCard({ announcement }: { announcement: PublicAnnouncementItem }) {
  return (
    <li>
      <Link
        to={ROUTES.publicAnnouncement(announcement.id as number)}
        className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70 transition hover:ring-brand-500/40"
      >
        <span className="inline-flex w-fit rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-600">
          {announcement.grade}
        </span>
        <h2 className="mt-3 text-lg font-bold leading-snug text-navy-800">{announcement.title}</h2>

        {/* Незаполненные администратором поля не приходят с бэкенда — пустых строк не будет. */}
        {announcement.summary && (
          <p className="mt-2 line-clamp-3 text-sm text-slate-600">{announcement.summary}</p>
        )}

        <dl className="mt-4 space-y-1.5 text-sm text-slate-500">
          {announcement.eventAt && (
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
              <dd>{formatDateTime(announcement.eventAt)}</dd>
            </div>
          )}
          {announcement.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              <dd>{announcement.location}</dd>
            </div>
          )}
        </dl>

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
          Подробнее
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </li>
  );
}
