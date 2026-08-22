import { useNavigate } from 'react-router-dom';
import { HomeworkStatusChip } from '@/components/ui/HomeworkStatusChip';
import { cx } from '@/lib/format';
import type { Homework } from '@/lib/homeworkApi';
import { dueLabel } from './homeworkModel';

/**
 * Строки заданий урока — общая разметка для карточки урока и для экрана заданий урока.
 *
 * Компонент один потому, что список один и тот же: в расписании по уроку кликают, чтобы
 * узнать «что задано», и увидеть там задания в другом виде, чем на их собственном экране,
 * было бы двумя разными ответами на один вопрос.
 *
 * Контейнер задаёт вызывающий: на карточке урока это блок внутри секции, на экране
 * заданий — самостоятельная карточка.
 *
 * `canOpen` — не косметика: карточку задания бэкенд отдаёт только учителю урока
 * (`GET /api/homework/{id}` требует профиль учителя). Администратор видит, что задано,
 * но нажимать ему не на что, и строка не должна притворяться ссылкой в никуда.
 *
 * `lessonId` нужен для одной подписи: к уроку относятся и задания без привязки, срок
 * которых приходится на этот урок. Иначе учитель, выдавший задание из раздела «Домашние
 * задания», не понял бы, почему оно вдруг числится за уроком.
 */
export function LessonHomeworkRows({
  rows,
  lessonId,
  canOpen = true,
  className,
}: {
  rows: Homework[];
  lessonId?: number;
  canOpen?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className={cx('flex flex-col', className)}>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          disabled={!canOpen}
          onClick={() => navigate(`/homework/${row.id}`)}
          className={cx(
            'flex items-center justify-between gap-4 border-b border-line px-5 py-3 text-left last:border-b-0',
            canOpen
              ? 'transition hover:bg-neutral-bg/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/50'
              : 'cursor-default',
          )}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{row.title}</span>
            <span className="text-13 text-subtle">
              {dueLabel(row)}
              {lessonId != null && row.lesson?.id !== lessonId && ' · срок на этом уроке'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            {/* У черновика получателей ещё нет: «0 / 0» читалось бы как «никто не сдал». */}
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
  );
}
