import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Backpack,
  Info,
  MapPin,
  ShieldAlert,
  Timer,
} from 'lucide-react';
import { usePublicAnnouncement } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PUBLIC_TITLE } from '@/lib/branding';
import { EntranceShell } from '@/pages/entrance/EntranceShell';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { buttonClassName } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { ROUTES } from '@/lib/routes';

/**
 * Подробная публичная карточка анонса (ТЗ §4).
 *
 * <p>Показывает только то, что заполнил администратор: незаполненные поля не
 * приходят с бэкенда, поэтому пустых блоков здесь не бывает by construction.
 * Предупреждение об античите (§5) приходит тем же ответом и выводится всегда.
 *
 * <p>«Начать тест» ведёт на ввод персонального кода. Класс отсюда не передаётся:
 * после ввода кода класс и назначенные тесты система берёт из карточки
 * поступающего (§4, «Правило доступа»).
 */
export function PublicAnnouncementPage() {
  useDocumentTitle(PUBLIC_TITLE);
  const { announcementId } = useParams();
  const id = Number(announcementId);
  const announcement = usePublicAnnouncement(Number.isFinite(id) && id > 0 ? id : null);

  const isMissing = announcement.error instanceof ApiError && announcement.error.status === 404;

  return (
    <EntranceShell size="lg">
      <Link
        to={ROUTES.publicAnnouncements}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-navy-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Все анонсы
      </Link>

      {announcement.isPending && <LoadingBlock label="Загружаем анонс…" />}

      {/* §7: анонс скрыли или его нет — это не сбой, а понятное состояние. */}
      {isMissing && (
        <EmptyBlock
          title="Анонс недоступен"
          description="Он был снят с публикации или никогда не публиковался. Посмотрите другие анонсы в разделе."
          action={
            <Link to={ROUTES.publicAnnouncements} className={buttonClassName({ variant: 'secondary' })}>
              К списку анонсов
            </Link>
          }
        />
      )}

      {announcement.isError && !isMissing && (
        <ErrorBlock
          message="Не удалось загрузить анонс. Проверьте соединение и попробуйте ещё раз."
          onRetry={() => announcement.refetch()}
        />
      )}

      {announcement.isSuccess && (
        <article className="mt-6">
          <span className="inline-flex rounded-full bg-brand-500/10 px-3 py-1 text-sm font-semibold text-brand-600">
            {announcement.data.grade}
          </span>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-navy-800">
            {announcement.data.title}
          </h1>
          {announcement.data.summary && (
            <p className="mt-3 text-lg leading-relaxed text-slate-600">{announcement.data.summary}</p>
          )}

          {(announcement.data.eventAt || announcement.data.location) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {announcement.data.eventAt && (
                <Fact icon={<CalendarDays className="h-4 w-4" />} label="Когда">
                  {formatDateTime(announcement.data.eventAt)}
                </Fact>
              )}
              {announcement.data.location && (
                <Fact icon={<MapPin className="h-4 w-4" />} label="Где">
                  {announcement.data.location}
                </Fact>
              )}
            </div>
          )}

          <div className="mt-8 space-y-5">
            <Section
              icon={<BookOpen className="h-5 w-5" />}
              title="Предметы и темы для подготовки"
              body={announcement.data.preparation}
            />
            <Section
              icon={<Timer className="h-5 w-5" />}
              title="Формат и продолжительность"
              body={announcement.data.formatInfo}
            />
            <Section
              icon={<Backpack className="h-5 w-5" />}
              title="Что взять с собой"
              body={announcement.data.bringWithYou}
            />
            <Section
              icon={<Info className="h-5 w-5" />}
              title="Рекомендации школы"
              body={announcement.data.recommendations}
            />
          </div>

          {/* §5: текст добавляет система, администратор его не заполняет. */}
          <aside className="mt-8 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
            <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              Правила прохождения тестирования
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
              {announcement.data.antiCheatNotice}
            </p>
          </aside>

          <div className="mt-8 flex flex-col items-center gap-2 border-t border-slate-200 pt-8">
            <Link to={ROUTES.entrance} className={buttonClassName()}>
              Начать тест
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <p className="text-sm text-slate-500">
              Понадобится персональный код, который выдала школа.
            </p>
          </div>
        </article>
      )}
    </EntranceShell>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-card ring-1 ring-slate-200/70">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-700/5 text-navy-700">
        {icon}
      </span>
      <div className="leading-tight">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-navy-800">{children}</p>
      </div>
    </div>
  );
}

/**
 * Блок раздела. Незаполненное поле не приходит с бэкенда — тогда блок просто не
 * рисуется (§4: «отображается только заполненная Администратором информация»).
 */
function Section({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string | undefined;
}) {
  if (!body) return null;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70">
      <h2 className="flex items-center gap-2.5 text-base font-bold text-navy-800">
        <span className="text-brand-500">{icon}</span>
        {title}
      </h2>
      {/* Переносы строк администратор ставит осмысленно — сохраняем их. */}
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{body}</p>
    </section>
  );
}
