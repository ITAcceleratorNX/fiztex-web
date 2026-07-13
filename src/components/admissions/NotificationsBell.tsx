import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import {
  useAdmissionsNotifications,
  useAdmissionsUnreadCount,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/StateBlock';
import { cx, formatDateTime } from '@/lib/format';
import { eventLabel } from '@/lib/admissionEvents';
import type { NotificationItem } from '@/lib/types';

export function NotificationsBell({ onOpenAttempt }: { onOpenAttempt: (attemptId: number) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const unreadCount = useAdmissionsUnreadCount();
  const notifications = useAdmissionsNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const count = unreadCount.data?.count ?? 0;
  const items = notifications.data?.content ?? [];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function handleOpen(item: NotificationItem) {
    if (!item.read) {
      markRead.mutate(item.id);
    }
    setOpen(false);
    onOpenAttempt(item.attemptId);
  }

  function handleMarkAll() {
    markAllRead.mutate();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Уведомления о попытках"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cx(
          'relative flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-card ring-1 ring-slate-200/70 transition',
          'hover:bg-slate-50',
          open && 'ring-brand-300',
        )}
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cx(
            'absolute right-0 z-40 mt-2 w-[min(100vw-2rem,380px)] overflow-hidden rounded-2xl bg-white shadow-pop ring-1 ring-slate-200/80 animate-scale-in',
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Уведомления</p>
            {count > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markAllRead.isPending}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Прочитать все
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner className="h-6 w-6 text-brand-500" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Нет уведомлений</p>
            ) : (
              <ul className="divide-y divide-slate-50">
                {items.map((item) => (
                  <li key={item.id}>
                    <div
                      className={cx(
                        'px-4 py-3',
                        !item.read && 'bg-brand-50/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-400">{eventLabel(item.type)}</p>
                          <p className="mt-0.5 text-sm font-semibold text-slate-800">{item.applicantName}</p>
                          <p className="truncate text-xs text-slate-500">{item.testTitle}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.message}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(item.createdAt)}</p>
                        </div>
                        {!item.read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2"
                        onClick={() => handleOpen(item)}
                      >
                        Открыть
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
