import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Sparkles } from 'lucide-react';
import { QuestionCard } from '@/components/homework/QuestionCard';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, TextInput } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useCreateTestTemplateFromQuestions, useTestTemplate, useVersionTestTemplateFromQuestions } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import type { TestAiJob } from '@/lib/testTemplateApi';
import { GenerateWorkspaceTestModal } from './GenerateWorkspaceTestModal';
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
  const [baseVersion, setBaseVersion] = useState<number>();
  const [aiJobId, setAiJobId] = useState<number>();
  const [generating, setGenerating] = useState(false);
  const [replacement, setReplacement] = useState<TestAiJob | null>(null);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [initialized, setInitialized] = useState(mode === 'create');
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(false);
  const saveKey = useRef(crypto.randomUUID());

  useDocumentTitle(mode === 'create' ? 'Новый тест' : 'Редактировать тест');

  useEffect(() => {
    if (mode !== 'edit' || initialized || !template.data) return;
    setTitle(template.data.title ?? '');
    setBaseVersion(template.data.version);
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
        await create.mutateAsync({ body: { title: title.trim(), questions: payload, ...(aiJobId != null ? { aiJobId } : {}) }, key: saveKey.current });
        toast.success('Тест создан');
      } else {
        if (id == null || baseVersion == null) return;
        await version.mutateAsync({ body: { expectedVersion: baseVersion, title: title.trim(), questions: payload,
          ...(aiJobId != null ? { aiJobId } : {}),
        }, key: saveKey.current });
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
    if (latest.isError || !latest.data) {
      setSaveError('Не удалось загрузить данные');
      return;
    }
    setBaseVersion(latest.data.version);
    setAiJobId(undefined);
    setQuestions((latest.data.definition?.questions ?? []).map(toDraft));
    setTitle(latest.data.title ?? '');
    setDirty(false);
    setConflict(false);
    setSaveError('');
    setShowProblems(false);
    saveKey.current = crypto.randomUUID();
  }

  function useGenerated(job: TestAiJob) {
    if (job.id == null || !job.result?.questions?.length) return;
    changed(job.result.questions.map(toDraft));
    setAiJobId(job.id);
    if (!title.trim()) changeTitle(job.request?.topic ?? '');
    setReplacement(null);
    setShowProblems(false);
  }

  function leave() {
    if (dirty) setLeaving(returnTo);
    else navigate(returnTo);
  }

  if (mode === 'edit' && id == null) return <ErrorBlock message="Тест не найден" />;
  if (mode === 'edit' && template.isPending) return <LoadingBlock />;
  if (mode === 'edit' && template.isError) return <ErrorBlock message="Не удалось загрузить данные" onRetry={() => template.refetch()} />;

  return <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-6">
    <div onClickCapture={(event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (!link || (!dirty && !saving)) return;
      event.preventDefault();
      if (!saving) setLeaving(link.pathname + link.search);
    }}><Breadcrumbs items={[
      { label: 'Рабочее пространство', to: ROUTES.workspace },
      { label: 'Тесты', to: returnTo },
      { label: mode === 'create' ? 'Новый тест' : 'Редактирование' },
    ]} /></div>
    <header className="flex items-start gap-3">
      <Button variant="secondary" size="sm" onClick={leave} disabled={saving} aria-label="Назад к тестам" icon={<ArrowLeft className="size-4" />} />
      <div className="min-w-0 space-y-2">
        <h1 className="text-24 font-bold text-ink sm:text-28">{mode === 'create' ? 'Новый тест' : 'Редактирование теста'}</h1>
        <p className="text-sm leading-relaxed text-muted">Соберите вопросы один раз и используйте тест в разных домашних заданиях.</p>
      </div>
    </header>

    <section className="card space-y-3 p-4 sm:p-6" aria-label="Настройки теста">
      <Field label="Название теста" required error={showProblems && !title.trim() ? 'Введите название' : undefined}>
        <TextInput value={title} maxLength={300} disabled={saving} onChange={(event) => changeTitle(event.target.value)}
          placeholder="Например, Законы Ньютона — проверка знаний" />
      </Field>
      {mode === 'edit' && <p className="text-13 text-muted">Изменения сохранятся новой версией. Уже выданные домашние задания сохранят прежние вопросы.</p>}
    </section>

    <section className="min-w-0 space-y-4" aria-label="Вопросы теста">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-18 font-semibold text-ink">Вопросы <span className="ml-1 text-muted">{questions.length}</span></h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} disabled={saving || questions.length >= 50}
            onClick={() => changed([...questions, emptyQuestion()])}>Добавить вопрос</Button>
          <Button variant="navy" size="sm" icon={<Sparkles className="size-4" />} disabled={saving}
            onClick={() => setGenerating(true)}>Сгенерировать с ИИ</Button>
        </div>
      </div>
      {questions.length === 0 ? <div className="card px-4"><EmptyBlock title="Вопросов пока нет"
        description="Добавьте вопрос вручную или сгенерируйте вопросы с ИИ." /></div>
        : <div className="space-y-4">
          {questions.map((question, index) => <QuestionCard key={question.localId} question={question}
            index={index} total={questions.length} readOnly={saving}
            messages={showProblems ? problems.get(index) ?? [] : []}
            onChange={(next) => changed(questions.map((entry, i) => i === index ? next : entry))}
            onRemove={() => changed(questions.filter((_, i) => i !== index))}
            onMove={(delta) => changed(move(questions, index, delta))} />)}
        </div>}
      {questions.length >= 50 && <p className="text-13 text-muted">В одном тесте может быть до 50 вопросов.</p>}
    </section>

    <div className="sticky bottom-4 z-10 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      {showProblems && !valid && <p role="alert" className="text-sm text-danger-fg">
        {!title.trim() ? 'Укажите название теста.' : questions.length === 0 ? 'Добавьте хотя бы один вопрос.' : 'Проверьте отмеченные вопросы перед сохранением.'}
      </p>}
      {saveError && <div role="alert" className="space-y-2 text-sm text-danger-fg"><p>{saveError}</p>
        {conflict && <Button variant="secondary" size="sm" onClick={() => void reloadVersion()}>Загрузить актуальную версию</Button>}
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-13 text-muted">
          <p>Вопросов: {questions.length} · Баллов: {questions.reduce((sum, question) => sum + (Number.isFinite(question.maxScore) ? question.maxScore : 0), 0)}</p>
          {dirty && <p className="mt-1">Есть несохранённые изменения</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={saving} onClick={leave}>Отмена</Button>
          <Button onClick={() => void save()} loading={saving} disabled={saving || conflict || (mode === 'edit' && !dirty)}>Сохранить</Button>
        </div>
      </div>
    </div>
    {generating && <GenerateWorkspaceTestModal initialTopic={title} onClose={() => setGenerating(false)}
      onUse={(job) => { if (questions.length > 0) setReplacement(job); else useGenerated(job); }} />}
    <ConfirmDialog open={replacement != null} onClose={() => setReplacement(null)} onConfirm={() => { if (replacement) useGenerated(replacement); }}
      title="Заменить вопросы теста?" message="Текущие вопросы в редакторе будут заменены результатом генерации. Изменения вступят в силу после сохранения теста."
      confirmLabel="Заменить вопросы" />
    <ConfirmDialog open={leaving != null} onClose={() => setLeaving(null)} onConfirm={() => navigate(leaving ?? returnTo)}
      title="Уйти без сохранения?" message="Изменения теста не сохранены и будут потеряны."
      confirmLabel="Уйти" danger />
  </div>;
}
