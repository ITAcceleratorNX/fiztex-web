import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight, X } from 'lucide-react';
import {
  useMarkCenterAllRead,
  useMarkCenterRead,
  useNotificationCenter,
  useNotificationUnread,
} from '@/hooks/queries';
import { Spinner } from '@/components/ui/StateBlock';
import { cx, formatDateTime } from '@/lib/format';
import type { CenterItem } from '@/lib/notificationCenterApi';
import {
  PENDING_ACTIONS_KIND,
  centerLink,
  pendingActions,
  pendingTotal,
} from '@/lib/notificationCenterModel';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy-700';

/**
 * Колокольчик ленты учителя (ТЗ «Внутренние уведомления — Teacher»).
 *
 * Живёт в подвале меню, а не над страницей: у страниц панели свои кнопки в правом верхнем углу, и плавающий значок
 * поверх них закрывал бы «Сохранить». Лента открывается рядом с меню, порталом — панель меню режет всё, что из неё
 * выступает.
 *
 * Карточки ленты не копятся: «урок через 10 минут» пропадает со звонком, «работы на проверку» — после проверки.
 * Решает это сервер; экран только перечитывает ленту, пока она открыта. «Незавершённые действия» не уводят со
 * страницы, а разворачиваются списком: каждое действие ведёт к своему уроку, заданию, исправлению или листу отзывов.
 */
export function NotificationCenterButton({ wide }: { wide: boolean }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const navigate = useNavigate();

  const unread = useNotificationUnread(true);
  const feed = useNotificationCenter(open);
  const markRead = useMarkCenterRead();
  const markAllRead = useMarkCenterAllRead();

  const count = open ? (feed.data?.unreadCount ?? unread.data?.count ?? 0) : (unread.data?.count ?? 0);
  const items = feed.data?.items ?? [];

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const aside = buttonRef.current!.closest('aside')?.getBoundingClientRect();
      setAnchor({
        left: (aside?.right ?? rect.right) + 12,
        bottom: Math.max(16, window.innerHeight - rect.bottom),
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, wide]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function go(item: CenterItem, href: string | null) {
    if (!item.read && item.id) markRead.mutate(item.id);
    if (!href) return;
    setOpen(false);
    navigate(href);
  }

  const label = count > 0 ? `Уведомления, непрочитанных: ${count}` : 'Уведомления';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cx(
          'relative flex size-8 items-center justify-center rounded-xl bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white',
          open && 'bg-white/20 text-white',
          FOCUS_RING,
        )}
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-10 font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && anchor && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Уведомления"
          style={{ left: anchor.left, bottom: anchor.bottom }}
          className="fixed z-50 flex max-h-[min(640px,calc(100vh-32px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl bg-surface shadow-pop ring-1 ring-slate-200/80 animate-scale-in"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-15 font-semibold text-ink">Уведомления</p>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate(items[0]?.createdAt)}
                  disabled={markAllRead.isPending}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-13 font-medium text-brand-600 transition hover:bg-brand-50 disabled:opacity-50"
                >
                  <CheckCheck className="size-3.5" />
                  Прочитать все
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="rounded-lg p-1 text-muted transition hover:bg-slate-100 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {feed.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner className="size-6 text-brand-500" />
              </div>
            ) : feed.isError ? (
              <p className="px-4 py-8 text-center text-13 text-muted">
                Не удалось загрузить уведомления. Попробуйте открыть ещё раз.
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-13 text-muted">
                Здесь появятся изменения по урокам и дела, которые ждут завершения.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.kind === PENDING_ACTIONS_KIND ? (
                      <PendingActionsCard item={item} onGo={(href) => go(item, href)} />
                    ) : (
                      <FeedRow item={item} onGo={() => go(item, centerLink(item.route, item.params))} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function UnreadDot({ read }: { read?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx('mt-1.5 size-2 shrink-0 rounded-full', read ? 'bg-transparent' : 'bg-brand-500')}
    />
  );
}

function FeedRow({ item, onGo }: { item: CenterItem; onGo: () => void }) {
  const href = centerLink(item.route, item.params);
  return (
    <button
      type="button"
      onClick={onGo}
      className={cx(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50',
        !item.read && 'bg-info-bg',
        !href && 'cursor-default',
      )}
    >
      <UnreadDot read={item.read} />
      <span className="min-w-0 flex-1">
        <span className="block text-13 font-semibold text-ink">{item.title}</span>
        {item.body && <span className="mt-0.5 block text-13 text-muted">{item.body}</span>}
        <span className="mt-1 block text-11 text-muted">{formatDateTime(item.createdAt)}</span>
      </span>
      {href && <ChevronRight className="mt-1 size-4 shrink-0 text-muted" aria-hidden />}
    </button>
  );
}

/**
 * «Незавершённые действия» — одна карточка на всё. Строка не ведёт никуда сама: дел несколько, и выбирает учитель.
 * Прочтение дело не закрывает (ТЗ §2): карточка снимется, когда закроется последнее.
 */
function PendingActionsCard({ item, onGo }: { item: CenterItem; onGo: (href: string | null) => void }) {
  const actions = pendingActions(item);
  const hidden = Math.max(0, pendingTotal(item) - actions.length);
  return (
    <div className={cx('px-4 py-3', !item.read && 'bg-info-bg')}>
      <div className="flex items-start gap-3">
        <UnreadDot read={item.read} />
        <div className="min-w-0 flex-1">
          <p className="text-13 font-semibold text-ink">{item.title}</p>
          {item.body && <p className="mt-0.5 text-13 text-muted">{item.body}</p>}
          {actions.length > 0 && (
            <ul className="mt-2 space-y-1">
              {actions.map((action, index) => (
                <li key={`${action.type}-${index}`}>
                  <button
                    type="button"
                    disabled={!action.href}
                    onClick={() => onGo(action.href)}
                    className="flex w-full items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-left text-13 text-ink ring-1 ring-line transition hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-surface"
                  >
                    <span className="min-w-0 flex-1 truncate" title={action.label}>{action.label}</span>
                    {action.href && <ChevronRight className="size-3.5 shrink-0 text-muted" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hidden > 0 && (
            <p className="mt-1.5 text-11 text-muted">И ещё {hidden} — в разделах панели.</p>
          )}
          <p className="mt-1.5 text-11 text-muted">Обновлено {formatDateTime(item.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}
