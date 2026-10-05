import { useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Field, TextInput } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useWorkspaceLessonTargets } from '@/hooks/queries';
import type { Lesson } from '@/lib/lessonsApi';

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDays(value: string, count: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + count);
  return localDate(date);
}

function startOfWeek(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return shiftDays(value, -(date.getDay() + 6) % 7);
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`));
}

export function LessonDestinationPicker({ selectedId, onSelect }: {
  selectedId: number | null;
  onSelect: (lesson: Lesson | null) => void;
}) {
  const [date, setDate] = useState(() => localDate(new Date()));
  const [page, setPage] = useState(0);
  const week = startOfWeek(date);
  const weekEnd = shiftDays(week, 6);
  const lessons = useWorkspaceLessonTargets(week, weekEnd, page);

  function chooseDate(next: string) {
    if (!next) return;
    setDate(next);
    setPage(0);
    onSelect(null);
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Дата урока" className="min-w-48 flex-1">
        <TextInput type="date" value={date} onChange={(event) => chooseDate(event.target.value)} />
      </Field>
      <Button variant="secondary" size="sm" onClick={() => chooseDate(shiftDays(date, -7))}>Раньше</Button>
      <Button variant="secondary" size="sm" onClick={() => chooseDate(shiftDays(date, 7))}>Позже</Button>
    </div>
    <p className="text-sm text-slate-500">{readableDate(week)} — {readableDate(weekEnd)}</p>
    {lessons.isPending ? <LoadingBlock /> : lessons.isError ?
      <ErrorBlock message="Не удалось загрузить данные" onRetry={() => lessons.refetch()} /> :
      (lessons.data?.content ?? []).length === 0 ?
        <EmptyBlock icon={<NotebookPen className="size-7" />} title="Нет доступного урока" /> :
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {lessons.data?.content?.map((lesson) => lesson.id != null && <ChoiceRow
            key={lesson.id}
            icon={<NotebookPen className="size-5" />}
            title={`${lesson.subjectName || 'Урок'} · ${lesson.className || 'Класс'}`}
            description={[lesson.date && readableDate(lesson.date), lesson.startTime?.slice(0, 5),
              lesson.subgroupName, lesson.topic,
              (!lesson.capabilities?.includes('EDIT_TEACHING_PART') || lesson.academicPeriodStatus !== 'ACTIVE')
                && 'Недоступен для изменения'].filter(Boolean).join(' · ')}
            selected={selectedId === lesson.id}
            disabled={!lesson.capabilities?.includes('EDIT_TEACHING_PART') || lesson.academicPeriodStatus !== 'ACTIVE'}
            onClick={() => onSelect(lesson)}
          />)}
        </div>}
    {(lessons.data?.totalPages ?? 0) > 1 && <div className="flex justify-end gap-2">
      <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => { setPage(page - 1); onSelect(null); }}>Назад</Button>
      <Button variant="secondary" size="sm" disabled={page + 1 >= (lessons.data?.totalPages ?? 0)} onClick={() => { setPage(page + 1); onSelect(null); }}>Далее</Button>
    </div>}
  </div>;
}
