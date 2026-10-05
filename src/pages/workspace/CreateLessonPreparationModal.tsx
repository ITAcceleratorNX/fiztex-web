import { useState, type FormEvent } from 'react';
import { Sparkles, X } from 'lucide-react';
import { WorkspaceMaterialPickerModal } from '@/components/workspace/WorkspaceMaterialPickerModal';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { SummaryDocument } from '@/components/ui/SummaryDocument';
import { useToast } from '@/context/ToastContext';
import { useCreateLessonPreparation } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { SummaryContent } from '@/lib/lessonSummaryApi';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';
import { GenerateLessonPreparationModal } from './GenerateLessonPreparationModal';

export function CreateLessonPreparationModal({ onClose, onCreated, initialGenerate = false }: {
  onClose: () => void; onCreated?: () => void; initialGenerate?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [companionText, setCompanionText] = useState('');
  const [companionKind, setCompanionKind] = useState<NonNullable<SummaryContent['companionKind']>>('PLAN');
  const [documents, setDocuments] = useState<WorkspaceSearchItem[]>([]);
  const [textbook, setTextbook] = useState<WorkspaceSearchItem | null>(null);
  const [picker, setPicker] = useState<'documents' | 'textbook' | null>(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(initialGenerate);
  const [pendingGenerated, setPendingGenerated] = useState<{ content: SummaryContent; source: WorkspaceSearchItem | null } | null>(null);
  const create = useCreateLessonPreparation();
  const toast = useToast();
  const canSave = Boolean(title.trim() && topic.trim() && (summaryText.trim() || companionText.trim()));
  const hasChanges = Boolean(title || topic || summaryText || companionText || documents.length || textbook);

  function applyGenerated(content: SummaryContent, source: WorkspaceSearchItem | null) {
    const generatedTitle = content.title?.trim() ?? '';
    setTitle(generatedTitle);
    setTopic(generatedTitle);
    setSummaryText(content.summaryText ?? '');
    setCompanionText(content.companionText ?? '');
    setCompanionKind(content.companionKind ?? 'PLAN');
    if (source?.id != null && source.type === 'DOCUMENT') {
      setDocuments((current) => current.some((item) => item.id === source.id) ? current : [...current, source]);
    }
    if (source?.id != null && source.type === 'TEXTBOOK') setTextbook(source);
    setPreview(false);
  }

  function useGenerated(content: SummaryContent, source: WorkspaceSearchItem | null) {
    if (title.trim() || topic.trim() || summaryText.trim() || companionText.trim()) {
      setPendingGenerated({ content, source });
    } else applyGenerated(content, source);
  }

  function requestClose() {
    if (create.isPending) return;
    if (hasChanges) setDiscardOpen(true);
    else onClose();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || create.isPending) return;
    setError('');
    try {
      await create.mutateAsync({
        title: title.trim(), topic: topic.trim(),
        summary: { title: topic.trim(), summaryText: summaryText.trim(), companionText: companionText.trim(), companionKind },
        documentWorkspaceItemIds: documents.flatMap((item) => item.id == null ? [] : [item.id]),
        ...(textbook?.id != null ? { textbook: { workspaceItemId: textbook.id } } : {}),
      });
      toast.success('Заготовка сохранена. Её можно применить к нескольким урокам');
      onCreated?.();
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить заготовку');
    }
  }

  return <>
    <Modal open onClose={requestClose} title="Новая заготовка урока" size="xl" footer={<>
      <Button variant="secondary" onClick={requestClose} disabled={create.isPending}>Отмена</Button>
      <Button type="submit" form="create-lesson-preparation" loading={create.isPending} disabled={!canSave}>Сохранить заготовку</Button>
    </>}>
      <form id="create-lesson-preparation" onSubmit={(event) => void save(event)} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Создайте конспект один раз, затем выбирайте эту заготовку в нужных уроках.</p>
          <Button type="button" size="sm" variant="secondary" icon={<Sparkles className="size-4" />} onClick={() => setAiOpen(true)}>
            Создать с ИИ
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Название заготовки" required>
            <TextInput autoFocus value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Тема урока" required>
            <TextInput value={topic} maxLength={300} onChange={(event) => setTopic(event.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={() => setPreview((value) => !value)}
            disabled={!topic.trim() || !(summaryText.trim() || companionText.trim())}>
            {preview ? 'Вернуться к редактированию' : 'Предпросмотр конспекта'}
          </Button>
        </div>
        {preview ? <div className="rounded-xl border border-slate-200 p-4">
          <SummaryDocument content={{ title: topic.trim(), summaryText, companionText, companionKind }} />
        </div> : <div className="space-y-4">
          <Field label="Краткий конспект" hint="Основные мысли, определения и формулы. До 20 000 знаков.">
            <TextArea rows={7} maxLength={20000} value={summaryText} onChange={(event) => setSummaryText(event.target.value)} />
          </Field>
          <Field label="Второй блок">
            <Select value={companionKind} onChange={(event) => setCompanionKind(event.target.value as NonNullable<SummaryContent['companionKind']>)}>
              <option value="PLAN">План урока</option>
              <option value="RETELLING">Краткий пересказ</option>
            </Select>
          </Field>
          <Field label={companionKind === 'PLAN' ? 'План урока' : 'Краткий пересказ'}>
            <TextArea rows={5} maxLength={20000} value={companionText} onChange={(event) => setCompanionText(event.target.value)} />
          </Field>
          <p className="text-xs text-slate-500">Заполните хотя бы один блок. Формулы можно записывать между $…$.</p>
        </div>}
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Материалы</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => setPicker('documents')}>
              Добавить из рабочего пространства
            </Button>
          </div>
          {documents.length === 0 ? <p className="text-sm text-slate-500">Материалы не добавлены</p>
            : <ul className="space-y-2">{documents.map((item) => <li key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="min-w-0 truncate">{item.title}</span>
              <button type="button" aria-label={`Убрать ${item.title}`} onClick={() => setDocuments((current) => current.filter((entry) => entry.id !== item.id))}
                className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-200"><X className="size-4" /></button>
            </li>)}</ul>}
        </div>
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-900">Учебник</p>
          <p className="text-xs text-slate-500">Необязательно. При применении учебник должен быть назначен классу выбранного урока.</p>
          {textbook && <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="min-w-0 truncate">{textbook.title}</span>
            <button type="button" aria-label="Убрать учебник" onClick={() => setTextbook(null)}
              className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-200"><X className="size-4" /></button>
          </div>}
          <Button type="button" variant="secondary" size="sm" onClick={() => setPicker('textbook')}>
            {textbook ? 'Заменить учебник' : 'Выбрать учебник'}
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
    {picker === 'documents' && <WorkspaceMaterialPickerModal usage="ATTACH_DOCUMENT_TO_LESSON"
      onClose={() => setPicker(null)} onConfirm={(items) => setDocuments((current) => {
        const selected = new Set(current.map((entry) => entry.id));
        return [...current, ...items.filter((item) => !selected.has(item.id))];
      })} />}
    {picker === 'textbook' && <WorkspaceMaterialPickerModal usage="SELECT_TEXTBOOK_FOR_LESSON" type="TEXTBOOK" singleSelect
      onClose={() => setPicker(null)} onConfirm={(items) => setTextbook(items[0] ?? null)} />}
    {aiOpen && <GenerateLessonPreparationModal onClose={() => setAiOpen(false)} onUse={useGenerated} />}
    <ConfirmDialog open={pendingGenerated != null} onClose={() => setPendingGenerated(null)}
      onConfirm={() => { if (pendingGenerated) applyGenerated(pendingGenerated.content, pendingGenerated.source); setPendingGenerated(null); }}
      title="Заменить текст заготовки?" message="Название, тема и текст будут заменены результатом ИИ. Прикреплённые материалы сохранятся."
      confirmLabel="Заменить" />
    <ConfirmDialog open={discardOpen} onClose={() => setDiscardOpen(false)} onConfirm={onClose}
      title="Закрыть без сохранения?" message="Изменения в заготовке будут потеряны."
      confirmLabel="Не сохранять" danger />
  </>;
}
