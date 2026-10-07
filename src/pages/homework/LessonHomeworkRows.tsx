import { useNavigate } from 'react-router-dom';
import { Copy } from 'lucide-react';
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
 *
 * `onReuse` — «Использовать повторно» у строки: копия задания или теста в другой урок.
 * Кнопка стоит рядом со строкой, а не внутри неё: строка сама кнопка, и вложенная кнопка
 * в ней была бы недопустимой разметкой и ловила бы нажатие вместе с переходом.
 */
export function LessonHomeworkRows({
  rows,
  lessonId,
  canOpen = true,
  onReuse,
  className,
}: {
  rows: Homework[];
  lessonId?: number;
  canOpen?: boolean;
  onReuse?: (row: Homework) => void;
  className?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className={cx('flex flex-col', className)}>
      {rows.map((row) => (
        <div key={row.id} className="flex items-stretch border-b border-line last:border-b-0">
        <button
          type="button"
          disabled={!canOpen}
          onClick={() => navigate(`/homework/${row.id}`)}
          className={cx(
            'flex min-w-0 flex-1 items-center justify-between gap-4 px-5 py-3 text-left',
            canOpen
              ? 'transition hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/50'
              : 'cursor-default',
          )}
        >
          <span className="min-w-0">
            <span className="block break-words text-sm font-medium leading-relaxed text-ink">{row.title}</span>
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
        {onReuse && (
          <button
            type="button"
            onClick={() => onReuse(row)}
            title="Использовать повторно"
            aria-label={`Использовать повторно: ${row.title}`}
            className="shrink-0 px-3 text-muted transition hover:bg-neutral-bg hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/50"
          >
            <Copy className="size-4" />
          </button>
        )}
        </div>
      ))}
    </div>
  );
}
