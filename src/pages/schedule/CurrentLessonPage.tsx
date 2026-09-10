import { Navigate } from 'react-router-dom';
import { CalendarOff, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useCurrentLesson } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { LessonCardSkeleton } from '@/platform/pages/schedule/LessonCardPage';

/**
 * Пункт «Текущий урок» (ТЗ Быстрый доступ §1, §4, §5).
 *
 * <p>Экрана у пункта нет — есть переход. Адрес `/current-lesson` спрашивает бэкенд, какой
 * урок сейчас актуален, и заменяет себя обычной карточкой этого урока. Промежуточного
 * расписания и списка предметов между нажатием и карточкой не появляется, а карточка —
 * та же самая, что открывается из расписания: второго экрана урока в системе нет.
 *
 * <p>`replace` обязателен: без него «назад» с карточки возвращало бы на этот адрес, тот
 * снова резолвил бы урок и снова уводил вперёд — кнопка «назад» перестала бы работать.
 *
 * <p>Урок определяется заново при каждом входе (`useCurrentLesson`), поэтому «висящей»
 * ссылки на закончившийся урок здесь не бывает. А вот уже открытую карточку никто не
 * переключает: она живёт своим запросом по id, и начавшийся следующий урок не выдёргивает
 * пользователя из незаконченной работы (ТЗ §4).
 */
export function CurrentLessonPage() {
  const query = useCurrentLesson();
  useDocumentTitle('Текущий урок');

  if (query.isPending) return <LessonCardSkeleton />;

  if (query.isError) {
    return (
      <div className="card">
        <ErrorBlock
          // Сбой связи — это не «занятий нет»: показать вместо ошибки пустое расписание
          // значит соврать про школу (ТЗ §5).
          message="Не удалось определить текущий урок"
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const result = query.data;
  const lessonId = result?.lesson?.id;
  if (result?.status === 'ok' && lessonId) {
    return <Navigate to={`/lesson-schedule/lessons/${lessonId}`} replace />;
  }

  const notPublished = result?.status === 'schedule_not_published';
  return (
    <div className="card">
      <EmptyBlock
        icon={
          notPublished ? (
            <CalendarClock className="h-7 w-7" />
          ) : (
            <CalendarOff className="h-7 w-7" />
          )
        }
        title={notPublished ? 'Расписание ещё не опубликовано' : 'Нет доступных ближайших уроков'}
        description={
          notPublished
            ? 'Как только школа опубликует расписание, пункт «Текущий урок» начнёт открывать нужное занятие.'
            : 'Идущих и будущих уроков в расписании не нашлось — вернитесь сюда, когда появятся ближайшие занятия.'
        }
        action={
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Проверить снова
          </Button>
        }
      />
    </div>
  );
}
