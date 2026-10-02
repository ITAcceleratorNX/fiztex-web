import { useState } from 'react';
import { BookOpen, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import {
  useAttachWorkspaceDocumentToHomework, useAttachWorkspaceDocumentToLesson,
  useCurrentLesson, useHomeworkList,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

type Destination = 'choose' | 'homework' | 'lesson';

export function ReuseMaterialModal({ item, onClose }: {
  item: WorkspaceSearchItem;
  onClose: () => void;
}) {
  const [destination, setDestination] = useState<Destination>('choose');
  const [page, setPage] = useState(0);
  const [homeworkId, setHomeworkId] = useState<number | null>(null);
  const [visibleToStudents, setVisibleToStudents] = useState(true);
  const homework = useHomeworkList({ scope: 'ACTUAL', page, size: 10 }, destination === 'homework');
  const currentLesson = useCurrentLesson(destination === 'lesson');
  const attachHomework = useAttachWorkspaceDocumentToHomework();
  const attachLesson = useAttachWorkspaceDocumentToLesson();
  const toast = useToast();
  const busy = attachHomework.isPending || attachLesson.isPending;
  const itemId = item.id;
  const lesson = currentLesson.data?.lesson;
  const lessonAvailable = lesson?.id != null && lesson.capabilities?.includes('EDIT_TEACHING_PART');
  const canHomework = item.supportedActions?.includes('ATTACH_DOCUMENT_TO_HOMEWORK') ?? false;
  const canLesson = item.supportedActions?.includes('ATTACH_DOCUMENT_TO_LESSON') ?? false;

  async function save() {
    if (itemId == null) return;
    try {
      if (destination === 'homework' && homeworkId != null) {
        await attachHomework.mutateAsync({ homeworkId, itemId });
      } else if (destination === 'lesson' && lessonAvailable && lesson.id != null) {
        await attachLesson.mutateAsync({ lessonId: lesson.id, itemId, visibleToStudents });
      } else return;
      toast.success('Материал добавлен');
      onClose();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Не удалось добавить материал');
    }
  }

  return <Modal
    open
    onClose={() => { if (!busy) onClose(); }}
    title={destination === 'choose' ? 'Куда добавить?' : destination === 'homework' ? 'Выберите домашнее задание' : 'Текущий урок'}
    size="md"
    footer={destination === 'choose' ? undefined : <>
      <Button variant="secondary" onClick={() => setDestination('choose')} disabled={busy}>Назад</Button>
      <Button onClick={() => void save()} loading={busy} disabled={destination === 'homework' ? homeworkId == null : !lessonAvailable}>Добавить</Button>
    </>}
  >
    {destination === 'choose' ? <div className="space-y-2">
      {canHomework && <ChoiceRow icon={<BookOpen className="size-5" />} title="Домашнее задание" onClick={() => { setPage(0); setHomeworkId(null); setDestination('homework'); }} />}
      {canLesson && <ChoiceRow icon={<NotebookPen className="size-5" />} title="Текущий урок" onClick={() => setDestination('lesson')} />}
    </div> : destination === 'homework' ? <>
      {homework.isPending ? <LoadingBlock /> : homework.isError ? (
        <ErrorBlock message="Не удалось загрузить данные" onRetry={() => homework.refetch()} />
      ) : (homework.data?.content ?? []).length === 0 ? (
        <EmptyBlock icon={<BookOpen className="size-7" />} title="Нет доступных домашних заданий" />
      ) : <div className="max-h-80 space-y-2 overflow-y-auto">
        {homework.data?.content?.map((target) => target.id != null && <ChoiceRow
          key={target.id}
          icon={<BookOpen className="size-5" />}
          title={target.title || `Домашнее задание №${target.id}`}
          description={[target.className, target.subjectName, target.status === 'DRAFT' ? 'Черновик' : 'Опубликовано'].filter(Boolean).join(' · ')}
          selected={homeworkId === target.id}
          onClick={() => setHomeworkId(target.id!)}
        />)}
      </div>}
      {(homework.data?.totalPages ?? 0) > 1 && <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => { setHomeworkId(null); setPage(page - 1); }}>Назад</Button>
        <Button variant="secondary" size="sm" disabled={page + 1 >= (homework.data?.totalPages ?? 0)} onClick={() => { setHomeworkId(null); setPage(page + 1); }}>Далее</Button>
      </div>}
    </> : currentLesson.isPending ? <LoadingBlock /> : currentLesson.isError ? (
      <ErrorBlock message="Не удалось загрузить данные" onRetry={() => currentLesson.refetch()} />
    ) : !lessonAvailable ? (
      <EmptyBlock icon={<NotebookPen className="size-7" />} title="Нет доступного урока" description={currentLesson.data?.message} />
    ) : <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-900">
        <p className="font-semibold">{lesson.subjectName || 'Урок'} · {lesson.className || 'Класс'}</p>
        <p className="mt-1 text-slate-500">{lesson.date ? new Intl.DateTimeFormat('ru-RU').format(new Date(`${lesson.date}T12:00:00`)) : ''}{lesson.lessonNumber ? ` · Урок ${lesson.lessonNumber}` : ''}</p>
      </div>
      <label className="flex items-center gap-3 text-sm text-slate-700">
        <input type="checkbox" checked={visibleToStudents} onChange={(event) => setVisibleToStudents(event.target.checked)} className="size-5 accent-navy-700" />
        Показывать ученикам
      </label>
    </div>}
  </Modal>;
}
