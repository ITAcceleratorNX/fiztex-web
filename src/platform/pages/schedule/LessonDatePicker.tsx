import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { useLessonOccurrences } from '@/hooks/queries';
import { formatWeekdayDayMonth } from '@/lib/format';
import type { Lesson } from '@/lib/lessonsApi';

/** Пометка даты в списке: отмена важнее времени — «прошёл» на отменённом уроке врало бы. */
function occurrenceHint(lesson: Lesson): string {
  if (lesson.status === 'CANCELLED') return 'отменён';
  switch (lesson.temporalStatus) {
    case 'ONGOING':
      return 'идёт сейчас';
    case 'FINISHED':
      return 'прошёл';
    case 'UPCOMING':
      return 'предстоит';
    default:
      return '';
  }
}

/**
 * Переключатель дат одного занятия (стрелки + список).
 *
 * <b>Зачем.</b> Посещаемость смотрят не только у текущего урока: «а что было на
 * прошлой неделе» — обычный вопрос, и уходить ради него в расписание, листать неделю
 * и снова проваливаться в урок значит терять контекст на каждом шаге.
 *
 * <b>Что считается «тем же занятием».</b> Слот расписания — класс, подгруппа, день
 * недели и время, а не строка таблицы: у каждой ревизии расписания свои строки, слот
 * у них общий. Разбирается это на бэкенде (`?scheduleLessonId=`), здесь только
 * ссылка из карточки.
 *
 * <b>Открывается на том уроке, с которого пришли</b> — он же выбран в списке. Урок,
 * заведённый не из расписания, соседей не имеет: переключателя нет, остаётся дата.
 */
export function LessonDatePicker({
  lesson,
  onPick,
}: {
  lesson: Lesson;
  onPick: (lessonId: number) => void;
}) {
  const occurrencesQuery = useLessonOccurrences(lesson.scheduleLessonId);

  const dates = useMemo(() => {
    const content = occurrencesQuery.data?.content ?? [];
    return [...content]
      .filter((item): item is Lesson & { id: number } => typeof item.id === 'number')
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  }, [occurrencesQuery.data]);

  const currentIndex = dates.findIndex((item) => item.id === lesson.id);
  const label = formatWeekdayDayMonth(lesson.date);

  // Пока список не пришёл — и когда переключать нечего — на месте переключателя
  // остаётся та же дата, что была на карточке. Пустая рамка со стрелками в никуда
  // обещала бы больше, чем есть.
  if (dates.length < 2 || currentIndex < 0) {
    return <span className="text-sm font-medium text-slate-600">{label}</span>;
  }

  const previous = dates[currentIndex - 1];
  const next = dates[currentIndex + 1];

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        title={previous ? `Предыдущее занятие: ${formatWeekdayDayMonth(previous.date)}` : undefined}
        aria-label="Предыдущее занятие"
        disabled={!previous}
        onClick={() => previous && onPick(previous.id)}
        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronLeft className="size-4" />
      </button>

      <Select
        value={String(lesson.id)}
        onChange={(event) => onPick(Number(event.target.value))}
        className="h-9 w-auto min-w-[13rem] rounded-lg py-0 text-sm font-medium"
      >
        {dates.map((item) => {
          const hint = occurrenceHint(item);
          return (
            <option key={item.id} value={String(item.id)}>
              {hint ? `${formatWeekdayDayMonth(item.date)} · ${hint}` : formatWeekdayDayMonth(item.date)}
            </option>
          );
        })}
      </Select>

      <button
        type="button"
        title={next ? `Следующее занятие: ${formatWeekdayDayMonth(next.date)}` : undefined}
        aria-label="Следующее занятие"
        disabled={!next}
        onClick={() => next && onPick(next.id)}
        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronRight className="size-4" />
      </button>
    </span>
  );
}
