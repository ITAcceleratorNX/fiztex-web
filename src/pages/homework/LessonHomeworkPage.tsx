import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useLesson, useLessonHomework } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatWeekdayDayMonth } from '@/lib/format';
import { LessonHomeworkRows } from './LessonHomeworkRows';

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
  // Обе вкладки сразу: у урока показываем все задания, включая завершённые и отменённые.
  // Тот же запрос стоит на карточке урока — список один, и хранится он в одном месте.
  const listQuery = useLessonHomework(Number.isFinite(id) && id > 0 ? id : null, true);

  const rows = listQuery.data ?? [];
  const lesson = lessonQuery.data;
  // Создание и карточка задания — права учителя урока. Администратор сюда тоже заходит
  // (из карточки урока), но у него это чтение: `POST /api/homework` и
  // `GET /api/homework/{id}` без профиля учителя ответят 403.
  const canManage = lesson?.capabilities?.includes('EDIT_TEACHING_PART') ?? false;

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

      {listQuery.isPending ? (
        <div className="card"><LoadingBlock label="Загрузка заданий…" /></div>
      ) : listQuery.isError ? (
        <div className="card">
          <ErrorBlock
            message="Не удалось загрузить задания урока"
            onRetry={() => void listQuery.refetch()}
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyBlock
            title="К этому уроку заданий нет"
            description={
              canManage
                ? 'Создайте задание — предмет, класс и дата подставятся из урока.'
                : 'Задание к уроку выдаёт учитель.'
            }
            action={
              canManage ? (
                <Link
                  to={`/homework/new?lessonId=${id}`}
                  className={buttonClassName({ variant: 'primary', size: 'sm' })}
                >
                  Создать задание
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <LessonHomeworkRows rows={rows} lessonId={id} canOpen={canManage} />
          </div>

          {canManage && (
            <div>
              <Button onClick={() => navigate(`/homework/new?lessonId=${id}`)}>Создать задание</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
