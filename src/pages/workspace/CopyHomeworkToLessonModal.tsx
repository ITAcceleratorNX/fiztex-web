import { useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useCopyHomeworkToLesson, useHomeworkCard } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import type { Lesson } from '@/lib/lessonsApi';
import { LessonDestinationPicker } from './LessonDestinationPicker';

type CopyRequest = Schema<'CopyHomeworkToLessonRequest'>;

export function CopyHomeworkToLessonModal({ sourceId, onClose, onCopied }: {
  sourceId: number;
  onClose: () => void;
  onCopied: (id: number) => void;
}) {
  const source = useHomeworkCard(Number.isSafeInteger(sourceId) && sourceId > 0 ? sourceId : null);
  const copy = useCopyHomeworkToLesson(sourceId);
  const toast = useToast();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [dueType, setDueType] = useState<CopyRequest['dueType'] | ''>('');
  const [dueAt, setDueAt] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<{ body: string; key: string }>();
  const originalLessonId = source.data?.lessonId ?? source.data?.lesson?.id;
  const available = lesson?.id != null && lesson.capabilities?.includes('EDIT_TEACHING_PART')
    && lesson.academicPeriodStatus === 'ACTIVE' && lesson.subjectId === source.data?.subjectId
    && lesson.id !== originalLessonId;
  const validDate = dueAt && Number.isFinite(new Date(dueAt).getTime());
  const canSave = !source.isPending && !source.isError && available && dueType && confirmed
    && (dueType !== 'EXACT' || validDate);

  async function save() {
    if (!canSave || copy.isPending || lesson?.id == null || !dueType) return;
    const body: CopyRequest = { lessonId: lesson.id, dueType, confirmRecipients: true,
      ...(dueType === 'EXACT' ? { dueAt: new Date(dueAt).toISOString() } : {}),
    };
    const serialized = JSON.stringify(body);
    if (attempt.current?.body !== serialized) attempt.current = { body: serialized, key: crypto.randomUUID() };
    setError('');
    try {
      const result = await copy.mutateAsync({ body, key: attempt.current.key });
      if (result.id == null) throw new Error('Missing copy id');
      toast.success('Копия ДЗ создана — проверьте черновик перед публикацией');
      onCopied(result.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось скопировать ДЗ. Повторите попытку.');
    }
  }

  return <Modal open onClose={() => { if (!copy.isPending) onClose(); }} title="Скопировать ДЗ в другой урок" size="lg"
    subtitle="Выберите урок по тому же предмету. Копия станет отдельным черновиком с собственными ответами и оценками."
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={copy.isPending}>Отмена</Button>
      <Button icon={<Copy className="size-4" />} onClick={() => void save()} loading={copy.isPending} disabled={!canSave}>Создать черновик</Button>
    </>}>
    {source.isPending ? <LoadingBlock /> : source.isError ? <ErrorBlock message="Не удалось загрузить данные" onRetry={() => void source.refetch()} /> : <div className="space-y-5">
      <div className="rounded-xl bg-neutral-bg p-4">
        <p className="text-13 text-muted">Исходное домашнее задание</p>
        <p className="mt-1 break-words font-semibold text-ink">{source.data?.title}</p>
        <p className="mt-1 text-sm text-muted">{source.data?.subjectName} · {source.data?.className}</p>
      </div>
      <fieldset disabled={copy.isPending} className="min-w-0 space-y-5">
        <LessonDestinationPicker selectedId={lesson?.id ?? null} subjectId={source.data?.subjectId} excludeLessonId={originalLessonId}
          onSelect={(next) => { setLesson(next); setConfirmed(false); setError(''); }} />
        {available && <>
          <NoticeBar tone="soft">Получатели нового ДЗ: {lesson.className}{lesson.subgroupName ? `, подгруппа «${lesson.subgroupName}»` : ', весь класс'}.</NoticeBar>
          <Field label="Срок сдачи копии" required>
            <Select value={dueType} disabled={copy.isPending} onChange={(event) => { setDueType(event.target.value as typeof dueType); setError(''); }}>
              <option value="" disabled>Выберите срок</option>
              <option value="EXACT">Дата и время</option>
              <option value="NEXT_LESSON">До следующего урока</option>
              <option value="NONE">Без срока</option>
            </Select>
          </Field>
          {dueType === 'EXACT' && <Field label="Дата и время сдачи" required>
            <TextInput type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </Field>}
          {dueType === 'NEXT_LESSON' && <p className="text-13 text-muted">Срок определится при публикации: до ближайшего следующего урока. Для будущего занятия — до следующего урока после него. Если такого урока нет, перед публикацией потребуется выбрать другой срок.</p>}
          <label className="flex items-start gap-3 text-sm leading-relaxed text-ink">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-navy-700" />
            Подтверждаю получателей выбранного урока. Прежний список учеников и срок переносить не нужно.
          </label>
        </>}
      </fieldset>
      <p className="text-13 text-muted">Скопируются текст, вопросы и материалы. Ученики увидят новое ДЗ только после публикации.</p>
      {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
    </div>}
  </Modal>;
}
