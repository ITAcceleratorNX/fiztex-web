import { Link } from 'react-router-dom';
import { BookOpen, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { buttonClassName } from '@/components/ui/Button';
import { EntryCard } from '@/components/ui/EntryCard';
import { useLessonSummary } from '@/hooks/queries';
import { summaryRunning } from '@/lib/lessonSummaryApi';

/**
 * Раздел «Конспект урока» в «Материалах урока» (Figma 2212:9448 / 2212:9521). Раньше — карточка
 * на карточке урока; переехал, чтобы КСП и конспект не стояли рядом и их не путали.
 *
 * Здесь только вход: «Создать с ИИ» и «Открыть» ведут на прежнюю страницу конспекта, где его
 * создают, правят и публикуют. Генерацию и публикацию эта задача не трогает.
 */
export function LessonSummarySection({ lessonId }: { lessonId: number }) {
  const query = useLessonSummary(lessonId);
  const data = query.data;
  const path = `/lesson-schedule/lessons/${lessonId}/summary`;
  const running = summaryRunning(data?.latestJob);

  const description = query.isPending
    ? 'Загружаем конспект…'
    : query.isError
      ? (
        <span className="flex items-center gap-3">
          Не удалось загрузить конспект
          <button type="button" onClick={() => void query.refetch()}
            className="font-semibold text-navy-700 underline hover:text-navy-800">
            Повторить
          </button>
        </span>
      )
      : running
        ? 'ИИ готовит черновик…'
        : data?.content?.title
          || (data?.canEdit ? 'Конспект пока не создан. ИИ составит его из учебника или файла урока' : 'Конспект пока не создан');

  return (
    <EntryCard
      icon={<BookOpen className="size-5" />}
      title="Конспект урока"
      meta="видят ученики после публикации"
      badge={data?.publishedAt
        ? <Badge appearance="label" size="xs" tone="green">Опубликован</Badge>
        : data?.content ? <Badge appearance="label" size="xs" tone="gray">Черновик</Badge> : null}
      description={description}
      actions={data && (data.content || running
        ? <Link to={path} className={buttonClassName({ variant: 'secondary' })}>Открыть</Link>
        : data.canEdit
          ? (
            <Link to={path} className={buttonClassName({ variant: 'secondary', className: 'gap-2' })}>
              <Sparkles className="size-4" aria-hidden="true" />
              Создать с ИИ
            </Link>
          )
          : null)}
    />
  );
}
