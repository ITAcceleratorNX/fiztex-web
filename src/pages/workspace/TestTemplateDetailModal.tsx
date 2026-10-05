import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, TextInput } from '@/components/ui/Field';
import { MathText } from '@/components/ui/MathText';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useDeleteTestTemplate, useRenameTestTemplate, useTestTemplate, useTestTemplateDependencies } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { homeworkCardFromWorkspace } from '@/lib/homeworkListNavigation';
import { ROUTES } from '@/lib/routes';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

export function TestTemplateDetailModal({ item, origin, onClose, onReuse }: {
  item: WorkspaceSearchItem;
  origin: { pathname: string; search: string };
  onClose: () => void;
  onReuse: () => void;
}) {
  const sourceId = Number(item.sourceId);
  const id = Number.isSafeInteger(sourceId) && sourceId > 0 ? sourceId : null;
  const template = useTestTemplate(id);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const dependencies = useTestTemplateDependencies(deleting ? id : null);
  const rename = useRenameTestTemplate();
  const remove = useDeleteTestTemplate();
  const toast = useToast();
  const navigate = useNavigate();

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (id == null || !title.trim()) return;
    setActionError('');
    try {
      await rename.mutateAsync({ id, title: title.trim() });
      toast.success('Тест переименован');
      setRenaming(false);
      onClose();
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось переименовать тест');
    }
  }

  async function confirmDelete() {
    if (id == null || !dependencies.data) return;
    setActionError('');
    try {
      await remove.mutateAsync({ id, dependencies: dependencies.data });
      toast.success('Тест удалён');
      setDeleting(false);
      onClose();
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось удалить тест');
      await dependencies.refetch();
    }
  }

  return <>
    <Modal open onClose={onClose} title={template.data?.title ?? item.title ?? 'Сохранённый тест'} size="lg" footer={<>
      <Button variant="secondary" onClick={onClose}>Закрыть</Button>
      <Button onClick={onReuse} disabled={template.isPending || template.isError}>Использовать повторно</Button>
    </>}>
      {template.isPending ? <LoadingBlock /> : template.isError ?
        <ErrorBlock message="Не удалось загрузить данные" onRetry={() => template.refetch()} /> : <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">Версия {template.data?.version} · {template.data?.definition?.questions?.length ?? 0} вопросов</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setTitle(template.data?.title ?? ''); setActionError(''); setRenaming(true); }}>Переименовать</Button>
              <Button size="sm" variant="secondary" onClick={() => {
                onClose();
                navigate(ROUTES.workspaceTestEdit(id!), { state: { returnTo: origin.pathname + origin.search } });
              }}>Редактировать вопросы</Button>
              <Button size="sm" variant="danger" onClick={() => { setActionError(''); setDeleting(true); }}>Удалить</Button>
            </div>
          </div>
          {(template.data?.definition?.questions ?? []).map((question, index) => <div key={index} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Вопрос {index + 1}</span>
              <Badge tone="gray">{question.maxScore ?? 1} б.</Badge>
            </div>
            <MathText text={question.text ?? ''} />
            {(question.options ?? []).length > 0 && <ol className="mt-3 space-y-2 pl-5 text-sm text-slate-700">
              {(question.options ?? []).map((option, optionIndex) => <li key={optionIndex} className="list-decimal">
                <MathText text={option.text ?? ''} /> {option.correct && <Badge tone="green">Правильный</Badge>}
              </li>)}
            </ol>}
            {question.referenceAnswer && <p className="mt-3 text-sm text-slate-700">Эталонный ответ: <MathText text={question.referenceAnswer} /></p>}
            {question.gradingCriteria && <p className="mt-2 text-sm text-slate-700">Критерии оценки: <MathText text={question.gradingCriteria} /></p>}
          </div>)}
          {template.data?.sourceHomeworkId != null && <Link className="text-sm font-semibold text-navy-700 hover:underline"
            to={homeworkCardFromWorkspace(template.data.sourceHomeworkId, origin)} onClick={onClose}>Открыть исходное ДЗ</Link>}
        </div>}
    </Modal>
    {renaming && <Modal open onClose={() => setRenaming(false)} title="Переименовать тест" size="sm" footer={<>
      <Button variant="secondary" onClick={() => setRenaming(false)} disabled={rename.isPending}>Отмена</Button>
      <Button type="submit" form="rename-workspace-test" loading={rename.isPending} disabled={!title.trim()}>Сохранить</Button>
    </>}>
      <form id="rename-workspace-test" onSubmit={(event) => void saveName(event)}>
        <Field label="Название теста" required><TextInput autoFocus value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} /></Field>
        {actionError && <p role="alert" className="mt-2 text-sm text-red-600">{actionError}</p>}
      </form>
    </Modal>}
    {deleting && <>
      {dependencies.isPending ? <Modal open onClose={() => setDeleting(false)} title="Удалить тест?" size="sm"><LoadingBlock /></Modal>
        : dependencies.isError ? <Modal open onClose={() => setDeleting(false)} title="Удалить тест?" size="sm">
          <ErrorBlock message="Не удалось загрузить данные" onRetry={() => dependencies.refetch()} />
        </Modal> : <ConfirmDialog open onClose={() => setDeleting(false)} onConfirm={() => void confirmDelete()}
          title="Удалить тест?" danger confirmLabel="Удалить тест" loading={remove.isPending}
          message={<>{(dependencies.data?.activeApplications ?? 0) > 0
            ? `Тест используется в ${dependencies.data?.activeApplications} ДЗ. Связь с ними будет удалена, но уже скопированные вопросы останутся.`
            : 'Тест будет удалён из рабочего пространства.'}
            {actionError && <p role="alert" className="mt-2 text-red-600">{actionError}</p>}</>} />}
    </>}
  </>;
}
