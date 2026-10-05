import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { WorkspaceMaterialPickerModal } from '@/components/workspace/WorkspaceMaterialPickerModal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useApplyLessonPreparation, useCreateLessonPreparation, useLessonPreparation, useLessonPreparationTarget } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { SummaryContent } from '@/lib/lessonSummaryApi';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

export function LessonPreparationActions({ lessonId, lessonTopic, summary, onApplied }: {
  lessonId: number;
  lessonTopic?: string;
  summary?: SummaryContent;
  onApplied: () => void;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [documents, setDocuments] = useState<WorkspaceSearchItem[]>([]);
  const [documentPickerOpen, setDocumentPickerOpen] = useState(false);
  const [preparationPickerOpen, setPreparationPickerOpen] = useState(false);
  const [selected, setSelected] = useState<WorkspaceSearchItem | null>(null);
  const [error, setError] = useState('');
  const create = useCreateLessonPreparation();
  const apply = useApplyLessonPreparation(lessonId);
  const preparationId = selected?.sourceKind === 'lesson-preparation' ? Number(selected.sourceId) : null;
  const preparation = useLessonPreparation(preparationId && Number.isSafeInteger(preparationId) && preparationId > 0 ? preparationId : null);
  const target = useLessonPreparationTarget(selected ? lessonId : null);
  const toast = useToast();
  const canSave = Boolean(summary && (summary.summaryText?.trim() || summary.companionText?.trim()));

  function openSave() {
    setTitle(lessonTopic?.trim() || summary?.title?.trim() || '');
    setTopic(lessonTopic?.trim() || summary?.title?.trim() || '');
    setDocuments([]);
    setError('');
    setSaveOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!summary || !canSave || !title.trim() || !topic.trim()) return;
    setError('');
    try {
      await create.mutateAsync({ title: title.trim(), topic: topic.trim(), summary,
        documentWorkspaceItemIds: documents.flatMap((item) => item.id == null ? [] : [item.id]) });
      setSaveOpen(false);
      toast.success('Заготовка урока сохранена');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить заготовку');
    }
  }

  async function confirmApply() {
    if (!selected?.id || !preparation.data?.version || !target.data?.targetRevision) return;
    setError('');
    try {
      await apply.mutateAsync({ workspaceItemId: selected.id, version: preparation.data.version,
        expectedTargetRevision: target.data.targetRevision,
        confirmReplace: Boolean(target.data.topic?.trim() || target.data.draftSummary?.summaryText?.trim() || target.data.selectedTextbookId) });
      setSelected(null);
      onApplied();
      toast.success('Заготовка применена к уроку');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось применить заготовку');
      await target.refetch();
    }
  }

  const replacing = Boolean(target.data?.topic?.trim() || target.data?.draftSummary?.summaryText?.trim()
    || target.data?.draftSummary?.companionText?.trim() || target.data?.selectedTextbookId);

  return <>
    {canSave && <Button variant="secondary" size="sm" onClick={openSave}>Сохранить как заготовку</Button>}
    <Button variant="secondary" size="sm" onClick={() => setPreparationPickerOpen(true)}>Выбрать заготовку урока</Button>
    <Modal open={saveOpen} onClose={() => { if (!create.isPending) setSaveOpen(false); }} title="Сохранить заготовку урока" size="md" footer={<>
      <Button variant="secondary" onClick={() => setSaveOpen(false)} disabled={create.isPending}>Отмена</Button>
      <Button type="submit" form="save-lesson-preparation" loading={create.isPending} disabled={!title.trim() || !topic.trim() || !summary}>Сохранить</Button>
    </>}>
      <form id="save-lesson-preparation" onSubmit={(event) => void save(event)} className="space-y-4">
        <p className="text-sm text-slate-600">Тема, сохранённый конспект и выбранные материалы станут заготовкой для других уроков.</p>
        <Field label="Название" required><TextInput value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} required /></Field>
        <Field label="Тема урока" required><TextInput value={topic} maxLength={300} onChange={(event) => setTopic(event.target.value)} /></Field>
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Материалы</p>
          {documents.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span>{item.title}</span><button type="button" aria-label={`Убрать ${item.title}`} onClick={() => setDocuments((current) => current.filter((entry) => entry.id !== item.id))}><X className="size-4" /></button>
          </div>)}
          <Button variant="secondary" size="sm" type="button" onClick={() => setDocumentPickerOpen(true)}>Выбрать из рабочего пространства</Button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
    {documentPickerOpen && <WorkspaceMaterialPickerModal usage="ATTACH_DOCUMENT_TO_LESSON"
      onClose={() => setDocumentPickerOpen(false)} onConfirm={(items) => {
        setDocuments((current) => {
          const ids = new Set(current.map((item) => item.id));
          return [...current, ...items.filter((item) => !ids.has(item.id))];
        });
      }} />}
    {preparationPickerOpen && <WorkspaceMaterialPickerModal usage="APPLY_PREPARATION_TO_LESSON" type="PREPARED_LESSON" singleSelect
      onClose={() => setPreparationPickerOpen(false)} onConfirm={(items) => { setSelected(items[0] ?? null); setError(''); setPreparationPickerOpen(false); }} />}
    <Modal open={selected != null} onClose={() => { if (!apply.isPending) setSelected(null); }} title="Применить заготовку урока" size="md" footer={<>
      <Button variant="secondary" onClick={() => setSelected(null)} disabled={apply.isPending}>Отмена</Button>
      <Button onClick={() => void confirmApply()} loading={apply.isPending}
        disabled={preparation.isPending || preparation.isError || target.isPending || target.isError || !target.data?.canApply || !target.data?.targetRevision}>
        {replacing ? 'Заменить тему и конспект' : 'Применить'}
      </Button>
    </>}>
      <div className="space-y-4">
        {preparation.isPending || target.isPending ? <LoadingBlock /> : preparation.isError || target.isError ?
          <ErrorBlock message="Не удалось загрузить данные" onRetry={() => { void preparation.refetch(); void target.refetch(); }} /> : <>
            <p className="text-sm font-semibold text-slate-900">{preparation.data?.title ?? selected?.title}</p>
            <p className="text-sm text-slate-600">Версия {preparation.data?.version} · Тема: {preparation.data?.topic || 'не указана'} · Материалов: {preparation.data?.documents?.length ?? 0}</p>
            {replacing && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Тема или конспект урока уже заполнены. Применение заготовки заменит их сохранённой версией.</p>}
            {target.data?.canApply === false && <p className="text-sm text-slate-600">Этот урок сейчас нельзя изменить.</p>}
          </>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  </>;
}
