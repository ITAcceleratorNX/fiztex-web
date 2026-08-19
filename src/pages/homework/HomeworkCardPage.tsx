import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Paperclip } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { HomeworkStatusChip } from '@/components/ui/HomeworkStatusChip';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { cx, formatDateTime } from '@/lib/format';
import { homeworkApi, type Homework, type RosterEntry } from '@/lib/homeworkApi';
import {
  ROSTER_FILTERS,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_TONES,
  filterRoster,
  homeworkActions,
  rosterCount,
  type RosterFilter,
} from './homeworkModel';

/**
 * Карточка домашнего задания учителя (ТЗ FE-Teacher-002 §5–7, Figma 863:929…1483).
 *
 * Одна и та же карточка открывается из урока и из списка HOMEWORK-005.1 — это одно
 * задание и один экран (§5), поэтому маршрут адресует Homework, а не путь, которым сюда
 * пришли. Откуда пришёл пользователь, влияет только на кнопку «назад».
 *
 * Получатели живут здесь же, а не на отдельной вкладке: в макете это один экран, и для
 * учителя «задание» и «кто что сдал» — один вопрос, а не два.
 */
export function HomeworkCardPage() {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const id = Number(homeworkId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [filter, setFilter] = useState<RosterFilter>('ALL');
  const [confirm, setConfirm] = useState<null | 'complete' | 'reopen' | 'cancel' | 'delete'>(null);

  const cardQuery = useQuery({
    queryKey: ['homework', 'card', id],
    queryFn: ({ signal }) => homeworkApi.card(id, signal),
    enabled: Number.isFinite(id) && id > 0,
  });
  const homework = cardQuery.data;
  const actions = homeworkActions(homework);

  useDocumentTitle(homework?.title ?? 'Домашнее задание');

  const rosterQuery = useQuery({
    queryKey: ['homework', 'roster', id],
    queryFn: ({ signal }) => homeworkApi.roster(id, signal),
    // У черновика получателей ещё нет — запрашивать список бессмысленно (§4.2 из 005.1).
    enabled: Boolean(homework) && homework?.status !== 'DRAFT',
  });

  const materialsQuery = useQuery({
    queryKey: ['homework', 'materials', id],
    queryFn: ({ signal }) => homeworkApi.listMaterials(id, signal),
    enabled: Boolean(homework),
  });

  /**
   * Любое действие обновляет карточку и ростер (§10): статус меняет и то, что можно делать,
   * и то, что видно про учеников. Обновляем инвалидацией, а не подстановкой ответа, — так
   * экран не разойдётся с сервером, если тот поменял больше, чем мы ожидали.
   */
  const mutate = useMutation({
    mutationFn: async (action: 'complete' | 'reopen' | 'cancel' | 'delete' | 'publish') => {
      switch (action) {
        case 'publish': return homeworkApi.publish(id);
        case 'complete': return homeworkApi.complete(id);
        case 'reopen': return homeworkApi.reopen(id);
        case 'cancel': return homeworkApi.cancel(id);
        case 'delete': return homeworkApi.remove(id);
      }
    },
    onSuccess: (_data, action) => {
      setConfirm(null);
      if (action === 'delete') {
        toast.success('Черновик удалён');
        navigate('/homework', { replace: true });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['homework'] });
      toast.success(
        {
          publish: 'Задание опубликовано',
          complete: 'Задание завершено',
          reopen: 'Задание открыто повторно',
          cancel: 'Задание отменено',
        }[action],
      );
    },
    onError: (error) => {
      setConfirm(null);
      toast.error(error instanceof ApiError ? error.message : 'Не удалось выполнить действие');
    },
  });

  if (cardQuery.isPending) return <LoadingBlock label="Загрузка задания…" />;

  if (cardQuery.error instanceof ApiError && [403, 404].includes(cardQuery.error.status)) {
    // 404 на чужом задании — это «нет доступа»: знание id прав не даёт (§10, HOMEWORK-001 §6).
    return (
      <div className="card">
        <EmptyBlock
          title="Задание недоступно"
          description="Оно удалено или относится к урокам другого учителя."
          action={
            <Link to="/homework" className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
              К списку заданий
            </Link>
          }
        />
      </div>
    );
  }
  if (cardQuery.isError || !homework) {
    return (
      <div className="card">
        <ErrorBlock message="Не удалось загрузить задание" onRetry={() => void cardQuery.refetch()} />
      </div>
    );
  }

  const students = rosterQuery.data?.students ?? [];
  const visible = filterRoster(students, filter);
  const busy = mutate.isPending;

  return (
    <div className="flex flex-col gap-5">
      <HomeworkHeader
        homework={homework}
        materials={materialsQuery.data ?? []}
        busy={busy}
        onPublish={() => mutate.mutate('publish')}
        onEdit={() => navigate(`/homework/${id}/edit`)}
        onAsk={setConfirm}
      />

      {homework.status === 'DRAFT' ? (
        <div className="card">
          <EmptyBlock
            title="Задание ещё не опубликовано"
            description="Получатели фиксируются при публикации — до неё списка учеников нет."
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {ROSTER_FILTERS.map((option) => {
              const selected = option.value === filter;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(option.value)}
                  className={cx(
                    'rounded-full px-3.5 py-1.5 text-13 font-medium transition',
                    selected
                      ? 'bg-brand-500 text-white'
                      : 'bg-neutral-bg text-muted hover:text-ink',
                  )}
                >
                  {option.label}
                  <span className={cx('ml-1.5', selected ? 'text-white/70' : 'text-subtle')}>
                    {rosterCount(rosterQuery.data, option.value)}
                  </span>
                </button>
              );
            })}
          </div>

          <RosterTable
            students={visible}
            loading={rosterQuery.isPending}
            error={rosterQuery.isError}
            onRetry={() => void rosterQuery.refetch()}
            canOpen={actions.canReview}
            onOpen={(student) => navigate(`/homework/${id}/students/${student.studentProfileId}`)}
          />
        </>
      )}

      <ConfirmDialog
        open={confirm === 'complete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => mutate.mutate('complete')}
        loading={busy}
        title="Завершить задание?"
        confirmLabel="Завершить"
        message="Новые ответы приниматься не будут. Уже отправленные работы останутся доступными для проверки, а ученики без отправки получат «Не выполнено»."
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        onClose={() => setConfirm(null)}
        onConfirm={() => mutate.mutate('reopen')}
        loading={busy}
        title="Открыть задание повторно?"
        confirmLabel="Открыть"
        message="Задание вернётся в «Актуальные». Выполненные работы останутся выполненными, а ученики без ответа снова смогут отправить работу."
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        onConfirm={() => mutate.mutate('cancel')}
        loading={busy}
        danger
        title="Отменить задание?"
        confirmLabel="Отменить задание"
        message="Отправленные ответы сохранятся, но новые приниматься не будут и проверка станет недоступна. Вернуть задание из отменённых нельзя — вместо этого создают копию."
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => mutate.mutate('delete')}
        loading={busy}
        danger
        title="Удалить черновик?"
        confirmLabel="Удалить"
        message="Черновик будет удалён без возможности восстановления."
      />
    </div>
  );
}

function HomeworkHeader({
  homework,
  materials,
  busy,
  onPublish,
  onEdit,
  onAsk,
}: {
  homework: Homework;
  materials: Array<{ id?: number; fileName?: string; url?: string }>;
  busy: boolean;
  onPublish: () => void;
  onEdit: () => void;
  onAsk: (action: 'complete' | 'reopen' | 'cancel' | 'delete') => void;
}) {
  const actions = homeworkActions(homework);

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/homework"
            aria-label="К списку заданий"
            className="text-subtle transition hover:text-ink"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="truncate text-2xl font-bold text-ink">{homework.title}</h1>
          <HomeworkStatusChip status={homework.status} overdue={homework.overdue} />
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {actions.canEdit && (
            <Button variant="secondary" size="sm" onClick={onEdit} disabled={busy}>
              Редактировать
            </Button>
          )}
          {actions.canPublish && (
            <Button size="sm" onClick={onPublish} loading={busy}>
              Опубликовать
            </Button>
          )}
          {actions.canCancel && (
            <Button variant="secondary" size="sm" onClick={() => onAsk('cancel')} disabled={busy}>
              Отменить
            </Button>
          )}
          {actions.canComplete && (
            <Button variant="secondary" size="sm" onClick={() => onAsk('complete')} disabled={busy}>
              Завершить
            </Button>
          )}
          {actions.canReopen && (
            <Button size="sm" onClick={() => onAsk('reopen')} disabled={busy}>
              Открыть повторно
            </Button>
          )}
          {actions.canDelete && (
            <Button variant="danger" size="sm" onClick={() => onAsk('delete')} disabled={busy}>
              Удалить
            </Button>
          )}
        </div>
      </div>

      <dl className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-13">
        <Meta label="Предмет" value={homework.subjectName} />
        <Meta
          label="Класс"
          value={homework.subgroupName ? `${homework.className} · ${homework.subgroupName}` : homework.className}
        />
        <Meta label="Срок" value={dueLabel(homework)} />
        {homework.lesson?.id ? (
          <div className="flex items-center gap-1.5">
            <dt className="text-subtle">Урок:</dt>
            <dd>
              <Link
                to={`/lesson-schedule/lessons/${homework.lesson.id}`}
                className="font-medium text-link hover:underline"
              >
                {homework.lesson.lessonDate
                  ? new Date(homework.lesson.lessonDate).toLocaleDateString('ru-RU', {
                      weekday: 'short', day: 'numeric', month: 'long',
                    })
                  : 'Открыть урок'}
              </Link>
            </dd>
          </div>
        ) : null}
        <Meta
          label="Прогресс"
          value={
            homework.status === 'DRAFT'
              ? '—'
              : `${homework.progress?.submitted ?? 0} / ${homework.progress?.total ?? 0}`
          }
        />
      </dl>

      {homework.description ? (
        <p className="whitespace-pre-wrap text-sm text-muted">{homework.description}</p>
      ) : null}

      {materials.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-13 text-subtle">Материалы:</span>
          {materials.map((material) => (
            <span
              key={material.id}
              className="inline-flex items-center gap-1.5 rounded bg-neutral-bg px-2 py-1 text-11 text-neutral-fg"
            >
              <Paperclip className="size-3" aria-hidden />
              {material.fileName ?? material.url}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5">
      <dt className="text-subtle">{label}:</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function dueLabel(homework: Homework): string {
  if (homework.dueType === 'NONE' || !homework.dueAt) return 'Без срока';
  return formatDateTime(homework.dueAt);
}

function RosterTable({
  students,
  loading,
  error,
  onRetry,
  canOpen,
  onOpen,
}: {
  students: RosterEntry[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  canOpen: boolean;
  onOpen: (student: RosterEntry) => void;
}) {
  if (loading) return <div className="card"><LoadingBlock label="Загрузка учеников…" /></div>;
  if (error) {
    return (
      <div className="card">
        <ErrorBlock message="Не удалось загрузить список учеников" onRetry={onRetry} />
      </div>
    );
  }
  if (students.length === 0) {
    return (
      <div className="card">
        <EmptyBlock title="Нет учеников" description="Под выбранный фильтр не подходит ни один ученик." />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full border-collapse">
        <thead className="border-b border-line bg-neutral-bg/40">
          <tr>
            <th scope="col" className="px-5 py-3 text-left text-10 font-medium uppercase tracking-wide text-subtle">Ученик</th>
            <th scope="col" className="w-40 px-5 py-3 text-left text-10 font-medium uppercase tracking-wide text-subtle">Статус</th>
            <th scope="col" className="w-48 px-5 py-3 text-left text-10 font-medium uppercase tracking-wide text-subtle">Время</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const status = student.status ?? 'NOT_SUBMITTED';
            const clickable = canOpen && status !== 'NOT_SUBMITTED';
            return (
              <tr
                key={student.studentProfileId}
                onClick={clickable ? () => onOpen(student) : undefined}
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onOpen(student);
                        }
                      }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? 'button' : undefined}
                aria-label={clickable ? `Открыть работу: ${student.fullName ?? ''}` : undefined}
                className={cx(
                  'border-b border-line last:border-b-0 transition',
                  clickable
                    ? 'cursor-pointer hover:bg-neutral-bg/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/50'
                    : 'cursor-default',
                )}
              >
                <td className="px-5 py-3 text-sm font-medium text-ink">
                  {student.fullName}
                  {/* Повторная отправка — факт, который меняет смысл «Отправлено» (§7). */}
                  {student.resubmitted && (
                    <span className="ml-2 rounded bg-neutral-bg px-1.5 py-0.5 text-10 text-neutral-fg">
                      повторно
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={cx('inline-flex items-center rounded px-2 py-0.5 text-11 font-medium', SUBMISSION_STATUS_TONES[status])}>
                    {SUBMISSION_STATUS_LABELS[status]}
                  </span>
                </td>
                <td className="px-5 py-3 text-13 text-muted">
                  {student.lastSubmittedAt ? formatDateTime(student.lastSubmittedAt) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
