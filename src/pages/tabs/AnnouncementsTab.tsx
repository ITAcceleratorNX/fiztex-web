import { useState, type ReactNode } from 'react';
import { Eye, EyeOff, Megaphone, Pencil, Plus, Send } from 'lucide-react';
import {
  useAnnouncements,
  useHideAnnouncement,
  usePublishAnnouncement,
} from '@/hooks/queries';
import { announcementsApi } from '@/lib/announcementsApi';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { AnnouncementStatusBadge } from '@/components/ui/AnnouncementStatusBadge';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { AnnouncementFormModal } from '@/pages/modals/AnnouncementFormModal';
import { applicantGradeOptions } from '@/pages/modals/applicantFormHelpers';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { formatDate, formatDateTime, pluralRu } from '@/lib/format';
import type { Announcement, AnnouncementStatus } from '@/lib/announcementsApi';

const PAGE_SIZE = 20;

/**
 * Вкладка «Анонсы» раздела «Вступительные тесты» (ТЗ §3).
 *
 * <p>Один список на все статусы — это и есть «история» из §3.1: черновики и
 * скрытые анонсы никуда не исчезают, а фильтруются.
 *
 * <p>Фильтрация и пагинация серверные: анонсов со временем накапливается больше,
 * чем разумно тянуть на клиент, и `useMemo` по всему массиву тут не годится.
 */
export function AnnouncementsTab() {
  const [status, setStatus] = useState<AnnouncementStatus | ''>('');
  const [grade, setGrade] = useState('');
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const toast = useToast();
  const announcements = useAnnouncements({ status, grade, page, size: PAGE_SIZE });
  const publish = usePublishAnnouncement();
  const hide = useHideAnnouncement();

  const items = announcements.data?.content ?? [];
  const total = announcements.data?.totalElements ?? 0;
  const totalPages = announcements.data?.totalPages ?? 0;
  const busy = publish.isPending || hide.isPending;

  /** Смена фильтра сбрасывает страницу: третьей страницы у нового результата может не быть. */
  function changeStatus(value: AnnouncementStatus | '') {
    setStatus(value);
    setPage(0);
  }

  function changeGrade(value: string) {
    setGrade(value);
    setPage(0);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  /**
   * Список не содержит длинных текстов, поэтому перед правкой карточка
   * дочитывается целиком — иначе форма молча затёрла бы то, чего не показала.
   */
  async function openEdit(id: number) {
    try {
      setEditing(await announcementsApi.get(id));
      setFormOpen(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось открыть анонс');
    }
  }

  async function runTransition(action: 'publish' | 'hide', id: number) {
    try {
      if (action === 'publish') {
        await publish.mutateAsync(id);
        toast.success('Анонс опубликован');
      } else {
        await hide.mutateAsync(id);
        toast.success('Анонс скрыт');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить статус');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onChange={(e) => changeStatus(e.target.value as AnnouncementStatus | '')}
          className="h-11 w-auto"
        >
          <option value="">Статус: Все</option>
          <option value="DRAFT">Черновик</option>
          <option value="PUBLISHED">Опубликован</option>
          <option value="HIDDEN">Скрыт</option>
        </Select>
        <Select
          value={grade}
          onChange={(e) => changeGrade(e.target.value)}
          className="h-11 w-auto"
        >
          <option value="">Класс: Все</option>
          {applicantGradeOptions().map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
        <div className="ml-auto">
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Создать анонс
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {announcements.isPending ? (
          <LoadingBlock label="Загрузка анонсов…" />
        ) : announcements.isError ? (
          <ErrorBlock
            message={
              announcements.error instanceof ApiError
                ? announcements.error.message
                : 'Не удалось загрузить анонсы'
            }
            onRetry={() => announcements.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyBlock
            icon={<Megaphone className="h-7 w-7" />}
            title={status || grade ? 'Ничего не найдено' : 'Анонсов пока нет'}
            description={
              status || grade
                ? 'Измените фильтры статуса или класса.'
                : 'Создайте анонс, чтобы поступающие заранее узнали о тестировании.'
            }
            action={
              !status && !grade ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Создать анонс
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3.5">Название</th>
                  <th className="px-6 py-3.5">Класс</th>
                  <th className="px-6 py-3.5">Статус</th>
                  <th className="px-6 py-3.5">Проведение</th>
                  <th className="px-6 py-3.5">Создан</th>
                  <th className="px-6 py-3.5">Изменён</th>
                  <th className="px-6 py-3.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => void openEdit(item.id as number)}
                    className="cursor-pointer transition hover:bg-slate-50/70"
                  >
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{item.title}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{item.grade}</td>
                    <td className="px-6 py-3.5">
                      <AnnouncementStatusBadge status={item.status as AnnouncementStatus} />
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">
                      {item.eventAt ? (
                        formatDateTime(item.eventAt)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">{formatDate(item.createdAt)}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">{formatDate(item.updatedAt)}</td>
                    <td className="px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <IconAction
                          title="Редактировать"
                          onClick={() => void openEdit(item.id as number)}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconAction>
                        {item.status !== 'PUBLISHED' ? (
                          <IconAction
                            title={item.status === 'HIDDEN' ? 'Опубликовать снова' : 'Опубликовать'}
                            disabled={busy}
                            onClick={() => void runTransition('publish', item.id as number)}
                          >
                            {item.status === 'HIDDEN' ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </IconAction>
                        ) : (
                          <IconAction
                            title="Скрыть"
                            disabled={busy}
                            onClick={() => void runTransition('hide', item.id as number)}
                          >
                            <EyeOff className="h-4 w-4" />
                          </IconAction>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-sm text-slate-400">
            <span>
              {total} {pluralRu(total, ['анонс', 'анонса', 'анонсов'])}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Назад
                </Button>
                <span className="text-slate-500">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Вперёд
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <AnnouncementFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        announcement={editing}
      />
    </div>
  );
}

function IconAction({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
