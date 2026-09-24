import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ErrorBlock } from '@/components/ui/StateBlock';
import { useLessonSummary } from '@/hooks/queries';
import type { Lesson } from '@/lib/lessonsApi';
import { summaryRunning } from '@/lib/lessonSummaryApi';

export function LessonSummaryEntry({ lesson }: { lesson: Lesson }) {
  const query = useLessonSummary(lesson.id ?? null);
  const learner = lesson.viewerRole === 'STUDENT' || lesson.viewerRole === 'PARENT';
  if (query.isError) return <ErrorBlock message="Не удалось загрузить конспект" onRetry={() => void query.refetch()} />;
  if (learner && !query.data?.content) return null;
  const data = query.data;
  return (
    <Link to={'/lesson-schedule/lessons/' + lesson.id + '/summary'}
      className="card flex items-center gap-4 p-5 transition hover:border-brand-300 focus-visible:ring-2 focus-visible:ring-brand-400">
      <BookOpen className="size-6 shrink-0 text-navy-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-ink">Конспект урока</p>
        <p className="mt-1 text-sm text-muted">{summaryRunning(data?.latestJob) ? 'ИИ готовит черновик…' :
          data?.content?.title || (data?.canEdit ? 'Создайте из учебника или своего материала' : 'Конспект пока не создан')}</p>
      </div>
      {data?.publishedAt ? <Badge tone="green">Опубликован</Badge> : data?.content ? <Badge tone="gray">Черновик</Badge> : null}
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
