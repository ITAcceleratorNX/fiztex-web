import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NotebookPen, Plus } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { EntryCard } from '@/components/ui/EntryCard';
import { useToast } from '@/context/ToastContext';
import { useLessonHomework, useSetHomeworkNotAssigned } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import type { Lesson } from '@/lib/lessonsApi';
import {
  homeworkCountLabel,
  homeworkNeedsTeacherAction,
  homeworkStateLabel,
  homeworkStateTone,
} from '@/lib/lessonHomeworkState';
import { LessonHomeworkRows } from '@/pages/homework/LessonHomeworkRows';
import { CopyHomeworkToLessonModal } from '@/pages/workspace/CopyHomeworkToLessonModal';

/**
 * Раздел «Домашнее задание» в «Материалах урока» — после учебника, в том же виде, что
 * «Конспект урока». Раньше это был отдельный блок на карточке урока; там он дублировал плитку
 * «Домашнее задание» (пояснение дизайнера 2212:9597), а здесь стоит рядом с остальным, что
 * видят ученики. Плитка на карточке осталась и по-прежнему ведёт к заданиям урока.
 *
 * Раздел отвечает на два вопроса: что задано и **закрыт ли вопрос**. Второй ответ —
 * `LessonView.homeworkState`, посчитанный сервером: пустой список одинаков у урока, до которого
 * не дошли руки, и у урока, на который решили не задавать. Отсюда «ДЗ не задано» рядом с
 * состоянием; при выданном задании кнопки нет — сервер ответил бы 409.
 *
 * Права не вычисляются: `VIEW_STUDENTS` отличает администратора и учителей урока от ученика
 * с родителем, `EDIT_TEACHING_PART` — того, кто ведёт урок.
 */
export function LessonHomeworkSection({ lesson, locked }: { lesson: Lesson; locked: boolean }) {
  const lessonId = lesson.id ?? null;
  const canRead = lesson.capabilities?.includes('VIEW_STUDENTS') ?? false;
  const canManage = lesson.capabilities?.includes('EDIT_TEACHING_PART') ?? false;
  const canCreate = canManage && !locked;
  const query = useLessonHomework(lessonId, canRead);
  const decide = useSetHomeworkNotAssigned(lessonId ?? 0);
  const toast = useToast();
  const navigate = useNavigate();
  const [reuseId, setReuseId] = useState<number | null>(null);
  const rows = query.data ?? [];
  const state = lesson.homeworkState;
  const lessonPath = `/lesson-schedule/lessons/${lessonId}`;

  const setNotAssigned = (notAssigned: boolean) =>
    decide.mutate(notAssigned, {
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Не удалось изменить состояние ДЗ'),
    });

  const description = !canRead
    ? 'Задания урока видны его учителю и администратору'
    : query.isPending
      ? 'Загружаем задания…'
      : query.isError
        ? (
          <span className="flex items-center gap-3">
            Не удалось загрузить задания урока
            <button type="button" onClick={() => void query.refetch()}
              className="font-semibold text-navy-700 underline hover:text-navy-800">
              Повторить
            </button>
          </span>
        )
        : rows.length > 0
          ? homeworkCountLabel(rows)
          // Пустой список при «ДЗ не задано» — не «заданий нет», а решение учителя.
          : state === 'NOT_ASSIGNED' ? 'Заданий по этому уроку не будет' : 'К этому уроку заданий нет';

  return (
    <EntryCard
      icon={<NotebookPen className="size-5" />}
      title="Домашнее задание"
      meta="видят ученики после публикации"
      badge={state && (
        <span className={cx('inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-11 font-semibold leading-4',
          homeworkStateTone(state))}>
          {homeworkStateLabel(state)}
        </span>
      )}
      description={(
        <span className="flex flex-wrap items-center gap-x-2">
          {description}
          {canCreate && homeworkNeedsTeacherAction(state) && (
            <span className="text-13 text-slate-400">· действие по ДЗ не завершено</span>
          )}
        </span>
      )}
      actions={(
        <>
          {/* «ДЗ не задано» отвечает на тот же вопрос, что и плашка состояния, поэтому стоит рядом. */}
          {canCreate && state && state !== 'ASSIGNED' && (
            <Button variant="ghost" disabled={decide.isPending} onClick={() => setNotAssigned(state !== 'NOT_ASSIGNED')}>
              {state === 'NOT_ASSIGNED' ? 'Отменить отметку' : 'ДЗ не задано'}
            </Button>
          )}
          {canCreate && rows.length === 0 && !query.isPending && (
            <Link to={`/homework/new?lessonId=${lessonId}`} className={buttonClassName({ variant: 'secondary', className: 'gap-2' })}>
              <Plus className="size-4" aria-hidden="true" />
              Создать задание
            </Link>
          )}
          {canRead && (rows.length > 0 || !canCreate) && (
            <Link to={`${lessonPath}/homework`} className={buttonClassName({ variant: 'secondary' })}>
              {canCreate ? 'Все задания и создание' : 'Все задания'}
            </Link>
          )}
        </>
      )}
    >
      {canRead && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line">
          <LessonHomeworkRows rows={rows} lessonId={lessonId ?? undefined} canOpen={canManage}
            onReuse={canManage ? (row) => setReuseId(row.id ?? null) : undefined} />
        </div>
      )}

      {/* «Использовать повторно» у ДЗ и теста: копия-черновик в другой урок сразу
          открывается в обычной форме задания — там её правят и публикуют. */}
      {reuseId != null && (
        <CopyHomeworkToLessonModal
          sourceId={reuseId}
          onClose={() => setReuseId(null)}
          onCopied={(copyId) => {
            setReuseId(null);
            navigate(`/homework/${copyId}/edit`);
          }}
        />
      )}
    </EntryCard>
  );
}
