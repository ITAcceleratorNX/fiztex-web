import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { QuestionCard } from '@/components/homework/QuestionCard';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, TextInput } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useCreateTestTemplateFromQuestions, useTestTemplate, useVersionTestTemplateFromQuestions } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import {
  emptyQuestion, move, toDraft, toRequest, validateQuestions, type QuestionDraft,
} from '@/pages/homework/homeworkQuestionsModel';

export function WorkspaceTestEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const { templateId } = useParams();
  const parsedId = Number(templateId);
  const id = mode === 'edit' && Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = typeof location.state?.returnTo === 'string' && location.state.returnTo.startsWith('/workspace')
    ? location.state.returnTo : ROUTES.workspaceSection('TESTS');
  const toast = useToast();
  const template = useTestTemplate(id);
  const create = useCreateTestTemplateFromQuestions();
  const version = useVersionTestTemplateFromQuestions(id ?? 0);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [initialized, setInitialized] = useState(mode === 'create');
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(false);
  const saveKey = useRef(crypto.randomUUID());

  useDocumentTitle(mode === 'create' ? 'Новый тест' : 'Редактировать тест');

  useEffect(() => {
    if (mode !== 'edit' || initialized || !template.data) return;
    setTitle(template.data.title ?? '');
    setQuestions((template.data.definition?.questions ?? []).map(toDraft));
    setInitialized(true);
  }, [mode, initialized, template.data]);

  const problems = useMemo(() => validateQuestions(questions), [questions]);
  const valid = title.trim().length > 0 && title.trim().length <= 300
    && questions.length > 0 && questions.length <= 50 && problems.size === 0;
  const saving = create.isPending || version.isPending;

  function changed(next: QuestionDraft[]) {
    setQuestions(next);
    setDirty(true);
    if (!conflict) setSaveError('');
    saveKey.current = crypto.randomUUID();
  }

  function changeTitle(next: string) {
    setTitle(next);
    setDirty(true);
    if (!conflict) setSaveError('');
    saveKey.current = crypto.randomUUID();
  }

  async function save() {
    setShowProblems(true);
    if (!valid || saving || conflict) return;
    const payload = toRequest(questions).questions;
    if (!payload) return;
    setSaveError('');
    try {
      if (mode === 'create') {
        await create.mutateAsync({ body: { title: title.trim(), questions: payload }, key: saveKey.current });
        toast.success('Тест создан');
      } else {
        if (id == null || template.data?.version == null) return;
        // Название меняется отдельно в карточке теста; новая версия хранит только вопросы.
        await version.mutateAsync({ body: { expectedVersion: template.data.version, questions: payload }, key: saveKey.current });
        toast.success('Новая версия теста сохранена');
      }
      setDirty(false);
      navigate(returnTo);
    } catch (caught) {
      setSaveError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить тест');
      if (caught instanceof ApiError && caught.status === 409) setConflict(true);
    }
  }

  async function reloadVersion() {
    const latest = await template.refetch();
    if (!latest.data) return;
    setQuestions((latest.data.definition?.questions ?? []).map(toDraft));
    setTitle(latest.data.title ?? '');
    setDirty(false);
    setConflict(false);
    setSaveError('');
    setShowProblems(false);
    saveKey.current = crypto.randomUUID();
  }

  function leave() {
    if (dirty) setLeaving(true);
    else navigate(returnTo);
  }

  if (mode === 'edit' && id == null) return <ErrorBlock message="Тест не найден" />;
  if (mode === 'edit' && template.isPending) return <LoadingBlock />;
  if (mode === 'edit' && template.isError) return <ErrorBlock message="Не удалось загрузить данные" onRetry={() => template.refetch()} />;

  return <div className="flex max-w-4xl flex-col gap-5">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={leave} aria-label="Назад к тестам" className="text-subtle transition hover:text-ink">
        <ArrowLeft className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-28 font-bold text-ink">{mode === 'create' ? 'Новый тест' : 'Редактировать вопросы теста'}</h1>
        <p className="text-13 text-muted">Тест можно использовать в нескольких домашних заданиях. Правки сохраняются новой версией.</p>
      </div>
      <Button onClick={() => void save()} loading={saving} disabled={saving || conflict || (mode === 'edit' && !dirty)}>Сохранить</Button>
    </div>

    <div className="card">
      <Field label="Название теста" required error={showProblems && !title.trim() ? 'Введите название' : undefined}>
        <TextInput value={title} maxLength={300} disabled={mode === 'edit'} onChange={(event) => changeTitle(event.target.value)}
          placeholder="Например, Законы Ньютона — проверка знаний" />
      </Field>
      {mode === 'edit' && <p className="mt-2 text-13 text-muted">Название можно изменить в карточке теста.</p>}
    </div>

    {questions.length === 0 ? <div className="card"><EmptyBlock title="Вопросов пока нет"
      description="Добавьте первый вопрос, чтобы создать тест."
      action={<Button size="sm" onClick={() => changed([emptyQuestion()])}>Добавить вопрос</Button>} /></div>
      : <div className="flex flex-col gap-4">
        {questions.map((question, index) => <QuestionCard key={question.localId} question={question}
          index={index} total={questions.length} readOnly={false}
          messages={showProblems ? problems.get(index) ?? [] : []}
          onChange={(next) => changed(questions.map((entry, i) => i === index ? next : entry))}
          onRemove={() => changed(questions.filter((_, i) => i !== index))}
          onMove={(delta) => changed(move(questions, index, delta))} />)}
      </div>}
    {questions.length > 0 && <Button variant="secondary" disabled={questions.length >= 50}
      onClick={() => changed([...questions, emptyQuestion()])}><Plus className="size-4" />Добавить вопрос</Button>}
    {showProblems && questions.length === 0 && <p role="alert" className="text-sm text-red-600">Добавьте хотя бы один вопрос.</p>}
    {saveError && <div role="alert" className="space-y-2 text-sm text-red-600"><p>{saveError}</p>
      {conflict && <Button variant="secondary" size="sm" onClick={() => void reloadVersion()}>Загрузить актуальную версию</Button>}
    </div>}
    <ConfirmDialog open={leaving} onClose={() => setLeaving(false)} onConfirm={() => navigate(returnTo)}
      title="Уйти без сохранения?" message="Изменения теста не сохранены и будут потеряны."
      confirmLabel="Уйти" danger />
  </div>;
}
