import { PageHeader } from '@/components/ui/PageHeader';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { QuestionCard } from '@/components/homework/QuestionCard';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useCreateTestTemplateFromQuestions, useTestTemplate, useVersionTestTemplateFromQuestions, useTestSubjectContext, useUploadHomeworkQuestionImage } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import type { TestAiJob } from '@/lib/testTemplateApi';
import { GenerateWorkspaceTestModal } from './GenerateWorkspaceTestModal';
import { WorkspaceAiApplyModal } from './WorkspaceAiApplyModal';
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
  const subjectContext = useTestSubjectContext();
  const [subjectId, setSubjectId] = useState<number>();
  const subjects = subjectContext.data?.subjects ?? [];
  const create = useCreateTestTemplateFromQuestions();
  const imageUpload = useUploadHomeworkQuestionImage();
  const [uploadingImages, setUploadingImages] = useState(0);
  const version = useVersionTestTemplateFromQuestions(id ?? 0);
  const [title, setTitle] = useState('');
  const [baseVersion, setBaseVersion] = useState<number>();
  const [aiJobId, setAiJobId] = useState<number>();
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<TestAiJob | null>(null);
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
    setSubjectId(template.data.subjectId);
    setQuestions((template.data.definition?.questions ?? []).map(toDraft));
    setInitialized(true);
  }, [mode, initialized, template.data]);

  useEffect(() => {
    if (initialized && subjectId == null && subjectContext.data?.defaultSubjectId != null) {
      setSubjectId(subjectContext.data.defaultSubjectId);
    }
  }, [initialized, subjectId, subjectContext.data?.defaultSubjectId]);

  const problems = useMemo(() => validateQuestions(questions), [questions]);
  const valid = title.trim().length > 0 && title.trim().length <= 300
    && questions.length > 0 && questions.length <= 50 && problems.size === 0
    && !subjectContext.isPending && !subjectContext.isError && subjects.some(s => s.id === subjectId);
  const saving = create.isPending || version.isPending || uploadingImages > 0;

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
        await create.mutateAsync({ body: { title: title.trim(), subjectId, questions: payload, ...(aiJobId != null ? { aiJobId } : {}) }, key: saveKey.current });
        toast.success('Тест создан');
      } else {
        if (id == null || baseVersion == null) return;
        await version.mutateAsync({ body: { expectedVersion: baseVersion, title: title.trim(), subjectId, questions: payload,
          ...(aiJobId != null ? { aiJobId } : {}),
        }, key: saveKey.current });
        toast.success('Новая версия теста сохранена');
      }
      setDirty(false);
      navigate(returnTo);
    } catch (caught) {
      setSaveError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить тест');
      if (mode === 'edit' && caught instanceof ApiError && caught.status === 409
        && caught.code === 'HOMEWORK_TEST_VERSION_CHANGED') setConflict(true);
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
    setSubjectId(latest.data.subjectId);
    setDirty(false);
    setConflict(false);
    setSaveError('');
    setShowProblems(false);
    saveKey.current = crypto.randomUUID();
  }

  function useGenerated(job: TestAiJob, mode: 'REPLACE' | 'APPEND' = 'REPLACE') {
    if (saving || job.id == null || !job.result?.questions?.length) return;
    if (job.subjectId !== subjectId) {
      toast.error('Предмет генерации изменился. Запустите генерацию для выбранного предмета.');
      return;
    }
    const incoming = job.result.questions.map(toDraft);
    const next = mode === 'APPEND' ? [...questions, ...incoming] : incoming;
    if (next.length > 50) {
      toast.error('В одном тесте может быть до 50 вопросов. Уменьшите число вопросов или замените текущие.');
      return;
    }
    changed(next);
    setAiJobId(job.id);
    if (!title.trim()) changeTitle(job.request?.topic ?? '');
    setGeneratedResult(null);
    setShowProblems(false);
  }

  function leave() {
    if (dirty) setLeaving(returnTo);
    else navigate(returnTo);
  }

  if (mode === 'edit' && id == null) return <ErrorBlock message="Тест не найден" />;
  if (mode === 'edit' && template.isPending) return <div className="page-stack max-w-4xl">
    <PageHeader title="Редактирование теста" back={{ onClick: leave, label: 'Назад к тестам' }} /><LoadingBlock />
  </div>;
  if (mode === 'edit' && template.isError) return <div className="page-stack max-w-4xl">
    <PageHeader title="Редактирование теста" back={{ onClick: leave, label: 'Назад к тестам' }} />
    <ErrorBlock message="Не удалось загрузить данные" onRetry={() => template.refetch()} />
  </div>;

  return <div className="page-stack max-w-4xl">
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
    <PageHeader title={mode === 'create' ? 'Новый тест' : 'Редактирование теста'}
      back={{ onClick: leave, disabled: saving, label: 'Назад к тестам' }}
      description="Соберите вопросы один раз и используйте тест в разных домашних заданиях." />

    <section className="card space-y-3 p-4 sm:p-6" aria-label="Настройки теста">
      {subjectContext.isPending && <LoadingBlock label="Загружаем предметы…" />}
      {subjectContext.isError && <ErrorBlock message="Не удалось загрузить предметы" onRetry={() => void subjectContext.refetch()} />}
      {!subjectContext.isPending && !subjectContext.isError && subjects.length === 0 &&
        <p role="status" className="text-sm text-muted">Нет доступных предметов. Для создания теста нужно действующее назначение учителя в текущем учебном году.</p>}
      {subjects.length > 0 && <Field label="Предмет теста" required>
        <Select value={subjectId ?? ''} disabled={saving || generating} onChange={(event) => {
          setSubjectId(Number(event.target.value) || undefined);
          setAiJobId(undefined); setGeneratedResult(null); setDirty(true);
          saveKey.current = crypto.randomUUID();
          if (questions.length) toast.info('Предмет изменён. Проверьте существующие вопросы перед сохранением.');
        }}>
          <option value="">Выберите предмет</option>
          {subjectId != null && !subjects.some(s => s.id === subjectId) && <option value={subjectId}>Предмет больше недоступен</option>}
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>}
      {mode === 'edit' && template.data?.subjectId == null && <p className="text-13 text-muted">У старой версии нет предмета. Выберите предмет для новой версии.</p>}
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
          <Button variant="navy" size="sm" icon={<Sparkles className="size-4" />} disabled={saving || !subjects.some(s => s.id === subjectId)}
            onClick={() => setGenerating(true)}>Сгенерировать с ИИ</Button>
        </div>
      </div>
      {questions.length === 0 ? <div className="card px-4"><EmptyBlock title="Вопросов пока нет"
        description="Добавьте вопрос вручную или сгенерируйте вопросы с ИИ." /></div>
        : <div className="space-y-4">
          {questions.map((question, index) => <QuestionCard key={question.localId} question={question}
            profile={subjects.find(s => s.id === subjectId)?.formulaProfile ?? template.data?.formulaProfile ?? 'GENERAL'}
            index={index} total={questions.length} readOnly={saving}
            onUploadImage={file => imageUpload.mutateAsync(file)}
            onImageBusyChange={busy => setUploadingImages(count => Math.max(0, count + (busy ? 1 : -1)))}
            messages={showProblems ? problems.get(index) ?? [] : []}
            onChange={(next) => changed(questions.map((entry, i) => i === index ? next : entry))}
            onRemove={() => changed(questions.filter((_, i) => i !== index))}
            onMove={(delta) => changed(move(questions, index, delta))} />)}
        </div>}
      {questions.length >= 50 && <p className="text-13 text-muted">В одном тесте может быть до 50 вопросов.</p>}
    </section>

    <div className="sm:sticky sm:bottom-4 sm:z-10 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      {showProblems && !valid && <p role="alert" className="text-sm text-danger-fg">
        {!subjectId ? 'Выберите предмет теста.' : !title.trim() ? 'Укажите название теста.' : questions.length === 0 ? 'Добавьте хотя бы один вопрос.' : 'Проверьте отмеченные вопросы перед сохранением.'}
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
          <Button onClick={() => void save()} loading={saving} disabled={saving || conflict || subjectContext.isPending || subjectContext.isError || subjects.length === 0 || (mode === 'edit' && !dirty)}>Сохранить</Button>
        </div>
      </div>
    </div>
    {generating && subjectId != null && <GenerateWorkspaceTestModal initialTopic={title} subjectId={subjectId} onClose={() => setGenerating(false)}
      onUse={(job) => { if (questions.length > 0) setGeneratedResult(job); else useGenerated(job); }} />}
    <WorkspaceAiApplyModal job={generatedResult} currentQuestionCount={questions.length} busy={saving}
      onClose={() => setGeneratedResult(null)}
      onApply={(mode) => { if (generatedResult) useGenerated(generatedResult, mode); }} />
    <ConfirmDialog open={leaving != null} onClose={() => setLeaving(null)} onConfirm={() => navigate(leaving ?? returnTo)}
      title="Уйти без сохранения?" message="Изменения теста не сохранены и будут потеряны."
      confirmLabel="Уйти" danger />
  </div>;
}
