import { ClipboardList, Loader2 } from 'lucide-react';
import { NavCard } from '@/components/ui/NavCard';
import { useKspContext } from '@/hooks/queries';
import { entryCaption } from '@/lib/kspModel';

/**
 * Вход в КСП с карточки урока (Figma К1–К4, компонент 2212:7454): над плитками, на месте
 * прежней карточки «Конспект урока». Вся карточка ведёт на страницу КСП этого урока.
 *
 * Состояние считает сервер (`entryState`): после ухода со страницы посреди генерации или до
 * сохранения карточка обязана это помнить (ТЗ «Точка входа»), а вывести «результат не
 * сохранён» из одной формы ответа клиент не может. Пока идёт генерация, контекст
 * перечитывается сам (`useKspContext`), и подпись меняется без перезагрузки.
 */
export function KspEntryCard({ lessonId }: { lessonId: number }) {
  const query = useKspContext(lessonId);
  const state = query.data?.entryState;
  const caption = query.isPending
    ? 'Загружаем состояние плана…'
    : query.isError
      ? 'Не удалось загрузить состояние плана — откройте, чтобы повторить'
      : entryCaption(state, query.data?.ksp);

  return (
    <NavCard
      to={`/lesson-schedule/lessons/${lessonId}/ksp`}
      icon={<ClipboardList className="size-6" />}
      title="Поурочный план (КСП)"
      caption={caption}
      captionIcon={state === 'GENERATING' ? <Loader2 className="size-4 shrink-0 animate-spin text-navy-700" aria-hidden="true" /> : undefined}
    />
  );
}
