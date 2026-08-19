import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { HomeworkStatusChip } from '@/components/ui/HomeworkStatusChip';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useLesson } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cx, formatDateTime, formatWeekdayDayMonth } from '@/lib/format';
import { homeworkApi, type Homework } from '@/lib/homeworkApi';

/**
 * Домашние задания одного урока (Figma 862:165/257/311) — точка входа из карточки урока
 * (ТЗ FE-Teacher-002 §2.1).
 *
 * Отдельный экран, а не фильтр общего списка: сюда приходят из урока и ждут увидеть только
 * его задания, а вкладки «Актуальные / История» и глобальные фильтры здесь были бы лишним
 * шумом — они принадлежат разделу HOMEWORK-005.1.
 *
 * Заданий у урока может быть несколько: связь «урок → ДЗ» не единичная.
 */
export function LessonHomeworkPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const id = Number(lessonId);
  const navigate = useNavigate();

  useDocumentTitle('Домашние задания урока');

  const lessonQuery = useLesson(Number.isFinite(id) && id > 0 ? id : null);
  const listQuery = useQuery({
    queryKey: ['homework', 'lesson', id],
    // Вкладку не задаём: у урока показываем все задания, включая завершённые и отменённые.
    queryFn: ({ signal }) => homeworkApi.list({ scope: 'ACTUAL', lessonId: id, size: 100 }, signal),
    enabled: Number.isFinite(id) && id > 0,
  });
  const historyQuery = useQuery({
    queryKey: ['homework', 'lesson', id, 'history'],
    queryFn: ({ signal }) => homeworkApi.list({ scope: 'HISTORY', lessonId: id, size: 100 }, signal),
    enabled: Number.isFinite(id) && id > 0,
  });

  const rows: Homework[] = [
    ...(listQuery.data?.content ?? []),
    ...(historyQuery.data?.content ?? []),
  ];
  const lesson = lessonQuery.data;
  const pending = listQuery.isPending || historyQuery.isPending;

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          to={`/lesson-schedule/lessons/${id}`}
          aria-label="К уроку"
          className="text-subtle transition hover:text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-28 font-bold text-ink">Домашние задания</h1>
          {lesson && (
            <p className="text-13 text-muted">
              {[
                lesson.subjectName,
                lesson.subgroupName ? `${lesson.className} · ${lesson.subgroupName}` : lesson.className,
                lesson.date ? formatWeekdayDayMonth(lesson.date) : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>

      {pending ? (
        <div className="card"><LoadingBlock label="Загрузка заданий…" /></div>
      ) : listQuery.isError || historyQuery.isError ? (
        <div className="card">
          <ErrorBlock
            message="Не удалось загрузить задания урока"
            onRetry={() => {
              void listQuery.refetch();
              void historyQuery.refetch();
            }}
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyBlock
            title="К этому уроку заданий нет"
            description="Создайте задание — предмет, класс и дата подставятся из урока."
            action={
              <Link
                to={`/homework/new?lessonId=${id}`}
                className={buttonClassName({ variant: 'primary', size: 'sm' })}
              >
                Создать задание
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="card flex flex-col gap-0 overflow-hidden p-0">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => navigate(`/homework/${row.id}`)}
                className={cx(
                  'flex items-center justify-between gap-4 border-b border-line px-5 py-3 text-left last:border-b-0',
                  'transition hover:bg-neutral-bg/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/50',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{row.title}</span>
                  <span className="text-13 text-subtle">
                    {row.dueType === 'NONE' || !row.dueAt ? 'Без срока' : formatDateTime(row.dueAt)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-13 text-muted">
                    {row.status === 'DRAFT'
                      ? '—'
                      : `${row.progress?.submitted ?? 0} / ${row.progress?.total ?? 0}`}
                  </span>
                  <HomeworkStatusChip status={row.status} overdue={row.overdue} />
                </span>
              </button>
            ))}
          </div>

          <div>
            <Button onClick={() => navigate(`/homework/new?lessonId=${id}`)}>Создать задание</Button>
          </div>
        </>
      )}
    </div>
  );
}
