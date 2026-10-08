import { useState, type FormEvent } from 'react';
import { WorkspaceMaterialPickerModal } from '@/components/workspace/WorkspaceMaterialPickerModal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useApplyTestTemplate, useCreateTestTemplate, useTestTemplate, useTestTemplateTarget } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

export function TestTemplateActions({ homeworkId, homeworkTitle, subjectId, questionCount, canApply, onApplied }: {
  homeworkId: number;
  homeworkTitle: string;
  subjectId?: number;
  questionCount: number;
  canApply: boolean;
  onApplied: () => void;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saveKey, setSaveKey] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<WorkspaceSearchItem | null>(null);
  const [applyKey, setApplyKey] = useState('');
  const [error, setError] = useState('');
  const create = useCreateTestTemplate();
  const apply = useApplyTestTemplate(homeworkId);
  const templateId = selected?.sourceKind === 'homework-test-template' ? Number(selected.sourceId) : null;
  const template = useTestTemplate(templateId && Number.isSafeInteger(templateId) && templateId > 0 ? templateId : null);
  const target = useTestTemplateTarget(selected ? homeworkId : null);
  const toast = useToast();

  function openSave() {
    setTitle(homeworkTitle);
    setSaveKey(crypto.randomUUID());
    setError('');
    setSaveOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setError('');
    try {
      await create.mutateAsync({ body: { sourceHomeworkId: homeworkId, title: title.trim() }, key: saveKey });
      setSaveOpen(false);
      toast.success('Тест сохранён в рабочем пространстве');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить тест');
    }
  }

  async function confirmApply() {
    if (!selected?.id || !template.data?.version || !target.data?.questionRevision) return;
    setError('');
    try {
      await apply.mutateAsync({ body: {
        workspaceItemId: selected.id,
        version: template.data.version,
        expectedQuestionRevision: target.data.questionRevision,
        confirmReplace: (target.data.questionCount ?? 0) > 0,
      }, key: applyKey });
      setSelected(null);
      onApplied();
      toast.success('Вопросы теста добавлены');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось применить тест');
      await target.refetch();
      if (caught instanceof ApiError && caught.status === 409) setApplyKey(crypto.randomUUID());
    }
  }

  return <>
    {questionCount > 0 && <Button variant="secondary" size="sm" onClick={openSave}>Сохранить тест в рабочем пространстве</Button>}
    {canApply && <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>Выбрать готовый тест</Button>}
    <Modal open={saveOpen} onClose={() => { if (!create.isPending) setSaveOpen(false); }} title="Сохранить тест" size="sm" footer={<>
      <Button variant="secondary" onClick={() => setSaveOpen(false)} disabled={create.isPending}>Отмена</Button>
      <Button type="submit" form="save-test-template" loading={create.isPending} disabled={!title.trim()}>Сохранить</Button>
    </>}>
      <form id="save-test-template" onSubmit={(event) => void save(event)} className="space-y-4">
        <p className="text-sm text-slate-600">{questionCount} вопросов будут сохранены как отдельная заготовка. Изменения в ДЗ не изменят её автоматически.</p>
        <Field label="Название теста" required><TextInput value={title} maxLength={300} onChange={(event) => { setTitle(event.target.value); setSaveKey(crypto.randomUUID()); }} required /></Field>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
    {pickerOpen && <WorkspaceMaterialPickerModal usage="APPLY_TEST_TO_HOMEWORK" type="TEST" subjectId={subjectId} singleSelect
      onClose={() => setPickerOpen(false)} onConfirm={(items) => {
        setSelected(items[0] ?? null);
        setApplyKey(crypto.randomUUID());
        setError('');
        setPickerOpen(false);
      }} />}
    <Modal open={selected != null} onClose={() => { if (!apply.isPending) setSelected(null); }} title="Применить готовый тест" size="md" footer={<>
      <Button variant="secondary" onClick={() => setSelected(null)} disabled={apply.isPending}>Отмена</Button>
      <Button onClick={() => void confirmApply()} loading={apply.isPending}
        disabled={template.isPending || target.isPending || template.isError || target.isError || !target.data?.questionRevision || (subjectId != null && template.data?.subjectId !== subjectId)}>
        {(target.data?.questionCount ?? 0) > 0 ? 'Заменить вопросы' : 'Добавить вопросы'}
      </Button>
    </>}>
      <div className="space-y-4">
        {template.isPending || target.isPending ? <LoadingBlock /> : template.isError || target.isError ?
          <ErrorBlock message="Не удалось загрузить данные" onRetry={() => { void template.refetch(); void target.refetch(); }} /> : <>
            <p className="text-sm font-semibold text-slate-900">{template.data?.title ?? selected?.title}</p>
            {subjectId != null && template.data?.subjectId !== subjectId && <p role="alert" className="text-sm text-danger-fg">Предмет этой версии не совпадает с предметом ДЗ. Выберите другую версию.</p>}
            <p className="text-sm text-slate-600">Версия {template.data?.version} · {template.data?.definition?.questions?.length ?? 0} вопросов</p>
            {(target.data?.questionCount ?? 0) > 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              В этом ДЗ уже есть вопросы. Применение заготовки заменит их. Ответы учеников не затрагиваются: после первого ответа сервер не разрешит замену.
            </p>}
          </>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  </>;
}
