import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, LockKeyhole, Pencil, RefreshCw, X } from 'lucide-react';
import { AiProgressPanel } from '@/components/ui/AiProgressPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { useToast } from '@/context/ToastContext';
import { keys, useKspCommands, useKspContext, useKspDocument, useKspJob, useLesson } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { kspJobRunning, type KspExportFormat, type KspGenerateRequest, type KspJob, type KspSaveRequest } from '@/lib/kspApi';
import {
  EXPORT_LABEL,
  buildGenerateRequest,
  dateLabel,
  emptyPrepForm,
  exportFileName,
  fromEditor,
  prepFormFromSource,
  regenerateRequest,
  requestFromSource,
  sameDocument,
  serverFieldErrors,
  toEditor,
  validateEditor,
  validatePrep,
  type EditorDocument,
  type EditorErrors,
  type PrepForm,
} from '@/lib/kspModel';
import { cx } from '@/lib/format';
import { KspDocumentView, KspSavedBar } from './KspDocumentView';
import { KspEditor } from './KspEditor';
import { KspPreparation } from './KspPreparation';
import { KspSourceCard } from './KspProgress';

/**
 * Где сейчас учитель на странице КСП. Начальное состояние выбирает сервер: идущая или
 * непросмотренная задача (`pendingJobId`) — её экран, иначе сохранённый КСП или подготовка.
 *
 * * `prepare` — П1–П4;
 * * `job` — задача генерации: идёт (Г1, Н2), упала (Г2, Н4) или готова (Р1–Р4, Н3);
 * * `saved` — С1, С2; `editSaved` — правка сохранённого (С3).
 */
type Phase =
  | { kind: 'loading' }
  | { kind: 'prepare'; form?: PrepForm }
  | { kind: 'job'; jobId: number }
  | { kind: 'saved' }
  | { kind: 'editSaved' };

interface EditorState {
  /** Что правим: результат задачи или сохранённый документ — по нему понятно, когда пересоздать. */
  origin: string;
  base: EditorDocument;
  value: EditorDocument;
}

interface Conflict {
  message: string;
  /** Актуальная ревизия из `details.ksp`: с ней можно осознанно сохранить поверх. */
  revision: number | null;
}

const NETWORK_SAVE_ERROR = 'Не удалось сохранить КСП: нет связи с сервером. Ваши правки остались на странице. Повторите попытку.';

/**
 * Страница КСП урока (KSP-FE-001, Figma «КСП», 2212:8116…9164). Вход — карточка «Поурочный
 * план (КСП)» на карточке урока, «К уроку» возвращает в неё.
 *
 * Генерация, сохранение, ревизии, права и Word/PDF — бэкенд (`docs/ksp-contract.md`); экран
 * хранит только ручные правки до «Сохранить». Результат генерации живёт на сервере, поэтому
 * уход со страницы теряет лишь ручные правки, а сам вариант дождётся учителя (карточка К3).
 */
export function KspPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const id = Number(lessonId);
  const valid = Number.isFinite(id) && id > 0;
  useDocumentTitle('КСП урока');

  const qc = useQueryClient();
  const toast = useToast();
  const contextQuery = useKspContext(valid ? id : null);
  const documentQuery = useKspDocument(valid ? id : null);
  const lessonQuery = useLesson(valid ? id : null);
  const commands = useKspCommands(id);

  const context = contextQuery.data;
  const saved = documentQuery.data;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const jobQuery = useKspJob(id, phase.kind === 'job' ? phase.jobId : null);
  const job = phase.kind === 'job' ? jobQuery.data : undefined;
  // Пожелания прошлой генерации — для «Сгенерировать заново» поверх сохранённого (Н1).
  const lastJobQuery = useKspJob(id, phase.kind === 'saved' ? context?.latestJobId ?? null : null);

  const [form, setForm] = useState<PrepForm | null>(null);
  const [prepSubmitted, setPrepSubmitted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorErrors, setEditorErrors] = useState<EditorErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const saveAttempt = useRef<{ key: string; body: string } | null>(null);
  const [exporting, setExporting] = useState<KspExportFormat | null>(null);
  const [exportError, setExportError] = useState<KspExportFormat | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  // Начальное состояние — по серверу, один раз: дальше экран ведёт учитель.
  useEffect(() => {
    if (phase.kind !== 'loading' || !context || !saved) return;
    if (context.pendingJobId != null) setPhase({ kind: 'job', jobId: context.pendingJobId });
    else if (saved.exists) setPhase({ kind: 'saved' });
    else setPhase({ kind: 'prepare' });
  }, [phase.kind, context, saved]);

  // Форма подготовки создаётся из контекста; после «Изменить данные» — из задачи.
  useEffect(() => {
    if (phase.kind !== 'prepare' || !context) return;
    if (phase.form) {
      setForm(phase.form);
      setPhase({ kind: 'prepare' });
    } else if (!form) {
      setForm(emptyPrepForm(context));
    }
  }, [phase, context, form]);

  // Готовый результат открывается в редакторе; исход, поставленный в другой вкладке, уводит дальше.
  useEffect(() => {
    if (phase.kind !== 'job' || !job) return;
    if (job.resolution === 'SAVED') {
      setPhase({ kind: 'saved' });
    } else if (job.resolution === 'DISMISSED') {
      setPhase(saved?.exists ? { kind: 'saved' } : { kind: 'prepare', form: context ? prepFormFromSource(context, job.source) : undefined });
    } else if (job.status === 'DONE' && editor?.origin !== `job:${job.id}`) {
      const document = toEditor(job.result, context?.defaultLanguage);
      setEditor({ origin: `job:${job.id}`, base: document, value: document });
      setEditorErrors({});
      setSaveError(null);
      setConflict(null);
    }
  }, [phase.kind, job, editor?.origin, saved?.exists, context]);

  // Задача закончилась — карточка урока должна узнать об этом без перезагрузки.
  const jobStatus = job?.status;
  useEffect(() => {
    if (jobStatus === 'DONE' || jobStatus === 'FAILED') void qc.invalidateQueries({ queryKey: keys.kspContext(id) });
  }, [jobStatus, id, qc]);

  const editing = (phase.kind === 'job' && job?.status === 'DONE' && editor?.origin === `job:${job.id}`)
    || (phase.kind === 'editSaved' && editor?.origin === 'saved');
  const dirty = editing && editor != null && !sameDocument(editor.base, editor.value);

  // Уход со страницы с ручными правками (Р3): результат генерации остаётся в уроке, пропадают только правки.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  if (!valid) return <PageFrame><ErrorBlock message="Урок не найден" /></PageFrame>;

  if (contextQuery.isError || documentQuery.isError) {
    const error = contextQuery.error ?? documentQuery.error;
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <PageFrame lessonId={id}>
        {status === 404 || status === 403 ? (
          <EmptyBlock icon={<LockKeyhole className="size-6" />} title="КСП недоступен"
            description={status === 404
              ? 'Этот урок относится к другому классу или закреплён за другим преподавателем.'
              : 'Поурочный план составляет и видит учитель урока.'} />
        ) : (
          <ErrorBlock message="Не удалось загрузить КСП" onRetry={() => {
            void contextQuery.refetch();
            void documentQuery.refetch();
          }} />
        )}
      </PageFrame>
    );
  }
  if (!context || !saved || phase.kind === 'loading') {
    return <PageFrame lessonId={id}><LoadingBlock label="Загружаем КСП…" /></PageFrame>;
  }

  const canEdit = Boolean(context.canEdit);
  const lessonMinutes = context.durationMinutes ?? 0;
  const subtitle = [context.subjectName, context.className, dateLabel(context.lessonDate),
    phase.kind === 'saved' ? saved.document?.topic : undefined].filter(Boolean).join(' · ');
  const generationBlocked = !canEdit
    ? 'Учебный период урока закрыт — КСП только для просмотра'
    : !context.generationEnabled ? 'Генерация КСП сейчас выключена' : null;

  // ---- команды ----

  async function startGeneration(body: KspGenerateRequest, onError: (message: string) => void) {
    try {
      const started = await commands.start.mutateAsync({ key: crypto.randomUUID(), body });
      setStartError(null);
      setEditor(null);
      if (started.id != null) setPhase({ kind: 'job', jobId: started.id });
    } catch (error) {
      onError(error instanceof ApiError ? error.message : 'Не удалось запустить генерацию');
    }
  }

  function submitPreparation() {
    if (!form || !context) return;
    setPrepSubmitted(true);
    setStartError(null);
    // Неполный запрос не уходит (П3): поля подсвечены, подсказка у кнопки считается при отрисовке.
    if (Object.keys(validatePrep(context, form)).length > 0) return;
    void startGeneration(buildGenerateRequest(context, form), setStartError);
  }

  async function dismiss(jobToDismiss: KspJob, next: Phase) {
    try {
      if (jobToDismiss.id != null) await commands.dismiss.mutateAsync(jobToDismiss.id);
      setEditor(null);
      setPhase(next);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось закрыть вариант');
    }
  }

  async function save(overwriteRevision?: number) {
    if (!editor || !saved) return;
    const errors = validateEditor(editor.value);
    setEditorErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveError('Проверьте выделенные поля.');
      return;
    }
    const fromJob = phase.kind === 'job' && job?.id != null;
    const body: KspSaveRequest = {
      document: fromEditor(editor.value),
      expectedRevision: overwriteRevision ?? (saved.exists ? saved.revision : undefined),
      generationId: fromJob ? job?.id : undefined,
      replace: fromJob && (saved.exists || overwriteRevision != null),
    };
    // Повтор той же отправки — тот же ключ: если первый ответ потерялся, второй КСП не появится.
    const json = JSON.stringify(body);
    const key = saveAttempt.current?.body === json ? saveAttempt.current.key : crypto.randomUUID();
    saveAttempt.current = { key, body: json };
    try {
      await commands.save.mutateAsync({ key, body });
      saveAttempt.current = null;
      setSaveError(null);
      setConflict(null);
      setEditor(null);
      setPhase({ kind: 'saved' });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status === 0) {
        setSaveError(NETWORK_SAVE_ERROR);
        return;
      }
      if (error.status === 422) {
        setEditorErrors(serverFieldErrors(error.details));
        setSaveError(error.message);
        return;
      }
      const details = error.details as { ksp?: { revision?: number } | null } | undefined;
      if (error.status === 409 && details && 'ksp' in details) {
        setSaveError(null);
        setConflict({ message: error.message, revision: details.ksp?.revision ?? null });
        void qc.invalidateQueries({ queryKey: keys.kspDocument(id) });
        return;
      }
      setSaveError(error.message);
    }
  }

  async function download(format: KspExportFormat) {
    setExporting(format);
    setExportError(null);
    try {
      const blob = await commands.exportFile.mutateAsync(format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFileName(saved?.document, format);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setExportError(format);
    } finally {
      setExporting(null);
    }
  }

  function openSavedEditor() {
    if (!saved?.document) return;
    if (phase.kind === 'job' && job?.status === 'FAILED' && job.id != null) {
      // Ошибку новой генерации закрываем: учитель решил править сохранённый.
      void commands.dismiss.mutateAsync(job.id).catch(() => undefined);
    }
    const document = toEditor(saved.document, context?.defaultLanguage);
    setEditor({ origin: 'saved', base: document, value: document });
    setEditorErrors({});
    setSaveError(null);
    setConflict(null);
    setExportError(null);
    setPhase({ kind: 'editSaved' });
  }

  // ---- разметка ----

  const savedBar = (busy: boolean) => saved.exists && (
    <KspSavedBar updatedAt={saved.updatedAt} canEdit={canEdit} canRegenerate={Boolean(context.generationEnabled)}
      busy={busy} exporting={exporting} exportError={exportError}
      onRegenerate={() => setConfirmRegenerate(true)} onEdit={openSavedEditor} onExport={(format) => void download(format)} />
  );
  const savedDocument = saved.exists && saved.document && <KspDocumentView document={saved.document} />;

  let status: ReactNode = null;
  let body: ReactNode;

  if (phase.kind === 'prepare') {
    const prepErrors = form ? validatePrep(context, form) : {};
    const incomplete = prepSubmitted && Object.keys(prepErrors).length > 0;
    body = form && (
      <KspPreparation context={context} lesson={lessonQuery.data} form={form} onChange={setForm}
        errors={prepErrors} submitted={prepSubmitted} submitting={commands.start.isPending}
        submitError={incomplete ? 'Заполните выделенные поля, чтобы сгенерировать КСП.' : startError}
        blockedReason={generationBlocked} onSubmit={submitPreparation} />
    );
  } else if (phase.kind === 'saved') {
    status = <StatusBadge tone="green">Сохранён</StatusBadge>;
    body = (
      <>
        {savedBar(false)}
        {savedDocument}
      </>
    );
  } else if (phase.kind === 'editSaved' && editor) {
    status = dirty ? <StatusBadge tone="amber">Есть несохранённые правки</StatusBadge> : <StatusBadge tone="green">Сохранён</StatusBadge>;
    body = (
      <>
        <KspEditor value={editor.value} onChange={(value) => setEditor({ ...editor, value })} errors={editorErrors}
          lessonMinutes={lessonMinutes} ktp={context.ktp} />
        <EditorFooter
          left={<Button variant="ghost" onClick={() => { setEditor(null); setPhase({ kind: 'saved' }); }}>Отменить правки</Button>}
          saving={commands.save.isPending} retry={saveError === NETWORK_SAVE_ERROR} error={saveError} conflict={conflict}
          onSave={() => void save()} onOverwrite={(revision) => void save(revision)} />
      </>
    );
  } else if (phase.kind === 'job') {
    const regenerating = saved.exists;
    if (jobQuery.isError) {
      body = <ErrorBlock message="Не удалось загрузить генерацию" onRetry={() => void jobQuery.refetch()} />;
    } else if (!job) {
      body = <LoadingBlock label="Загружаем генерацию…" />;
    } else if (kspJobRunning(job)) {
      if (regenerating) status = <StatusBadge tone="green">Сохранён</StatusBadge>;
      body = regenerating ? (
        <>
          {savedBar(true)}
          <AiProgressPanel title="ИИ готовит новый вариант КСП…"
            description="Сохранённый КСП остаётся в уроке, пока вы не сохраните новый вариант." />
          {savedDocument}
        </>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <AiProgressPanel title="ИИ составляет КСП…" description="Окно можно закрыть — результат сохранится и дождётся вас." />
          </section>
          <KspSourceCard context={context} source={job.source} />
        </>
      );
    } else if (job.status === 'FAILED') {
      const retry = () => void startGeneration(requestFromSource(job.source, context.defaultLanguage),
        (message) => toast.error(message));
      if (regenerating) {
        status = <StatusBadge tone="green">Сохранён</StatusBadge>;
        body = (
          <>
            {savedBar(false)}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <AiProgressPanel state="error" title="Новый вариант не получен"
                  description={`${job.errorMessage ?? 'Генерация не удалась.'} Сохранённый КСП не изменён.`} />
                <button type="button" aria-label="Скрыть ошибку"
                  onClick={() => void dismiss(job, { kind: 'saved' })}
                  className="absolute right-3 top-3 rounded-md p-1 text-red-700 transition hover:bg-red-100">
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              {canEdit && (
                <Button variant="secondary" className="self-start" loading={commands.start.isPending} onClick={retry}
                  icon={<RefreshCw className="size-4" aria-hidden="true" />}>
                  Повторить
                </Button>
              )}
            </div>
            {savedDocument}
          </>
        );
      } else {
        body = (
          <>
            <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6">
              <AiProgressPanel state="error" title="КСП не сгенерирован"
                description={`${job.errorMessage ?? 'Генерация не удалась. Повторите попытку.'} Данные урока и пожелания сохранены.`} />
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={commands.dismiss.isPending}
                    onClick={() => void dismiss(job, { kind: 'prepare', form: prepFormFromSource(context, job.source) })}
                    icon={<Pencil className="size-4" aria-hidden="true" />}>
                    Изменить данные
                  </Button>
                  <Button loading={commands.start.isPending} onClick={retry} icon={<RefreshCw className="size-4" aria-hidden="true" />}>
                    Повторить генерацию
                  </Button>
                </div>
              )}
            </section>
            <KspSourceCard context={context} source={job.source} />
          </>
        );
      }
    } else if (job.status === 'DONE' && editor && editor.origin === `job:${job.id}`) {
      status = <StatusBadge tone="amber">{regenerating ? 'Новый вариант не сохранён' : 'Не сохранён'}</StatusBadge>;
      body = canEdit ? (
        <>
          <StatusNotice tone="attention">
            {regenerating
              ? 'Это новый вариант КСП. В уроке пока остаётся прежний сохранённый КСП: он будет заменён, когда вы нажмёте «Сохранить».'
              : 'Результат генерации ещё не сохранён за уроком. Проверьте содержание и нажмите «Сохранить». Скачать Word и PDF можно после сохранения.'}
          </StatusNotice>
          <KspEditor value={editor.value} onChange={(value) => setEditor({ ...editor, value })} errors={editorErrors}
            lessonMinutes={lessonMinutes} ktp={context.ktp} />
          <EditorFooter
            left={regenerating ? (
              <Button variant="ghost" disabled={commands.dismiss.isPending}
                onClick={() => void dismiss(job, { kind: 'saved' })}>
                Вернуться к сохранённому КСП
              </Button>
            ) : (
              <Button variant="secondary" loading={commands.start.isPending}
                disabled={!context.generationEnabled}
                onClick={() => (dirty ? setConfirmRestart(true)
                  : void startGeneration(requestFromSource(job.source, context.defaultLanguage), (message) => toast.error(message)))}
                icon={<RefreshCw className="size-4" aria-hidden="true" />}>
                Сгенерировать заново
              </Button>
            )}
            saving={commands.save.isPending} retry={saveError === NETWORK_SAVE_ERROR} error={saveError} conflict={conflict}
            onSave={() => void save()} onOverwrite={(revision) => void save(revision)} />
        </>
      ) : (
        <>
          <StatusNotice tone="attention">Учебный период урока закрыт — сохранить этот вариант нельзя.</StatusNotice>
          {job.result && <KspDocumentView document={job.result} />}
          <Button variant="secondary" className="self-start" onClick={() => void dismiss(job, saved.exists ? { kind: 'saved' } : { kind: 'prepare' })}>
            Скрыть вариант
          </Button>
        </>
      );
    } else {
      body = <LoadingBlock label="Открываем результат…" />;
    }
  }

  return (
    <PageFrame lessonId={id} status={status} subtitle={subtitle}>
      {phase.kind === 'saved' && !canEdit && (
        <StatusNotice tone="info">Учебный период урока закрыт — КСП только для просмотра.</StatusNotice>
      )}
      {phase.kind === 'prepare' && !canEdit && !saved.exists ? (
        <EmptyBlock title="КСП для этого урока не создан" description="Учебный период урока закрыт — составить КСП уже нельзя." />
      ) : body}

      <ConfirmDialog
        open={confirmRegenerate}
        title="Сгенерировать КСП заново?"
        message="Текущий КСП будет заменён новым. История версий не сохраняется. Прежний КСП останется в уроке, пока вы не сохраните новый вариант."
        confirmLabel="Сгенерировать заново"
        loading={commands.start.isPending}
        onClose={() => setConfirmRegenerate(false)}
        onConfirm={() => {
          if (!saved.document) return;
          void startGeneration(regenerateRequest(saved.document, lastJobQuery.data?.source), (message) => toast.error(message))
            .finally(() => setConfirmRegenerate(false));
        }}
      />
      <ConfirmDialog
        open={confirmRestart}
        title="Сгенерировать заново?"
        message="Ваши правки в этом варианте пропадут. ИИ составит новый вариант по тем же данным урока и пожеланиям."
        confirmLabel="Сгенерировать заново"
        loading={commands.start.isPending}
        onClose={() => setConfirmRestart(false)}
        onConfirm={() => {
          if (!job) return;
          void startGeneration(requestFromSource(job.source, context.defaultLanguage), (message) => toast.error(message))
            .finally(() => setConfirmRestart(false));
        }}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Уйти без сохранения?"
        message={phase.kind === 'editSaved'
          ? 'Ваши правки пропадут. Сохранённый КСП останется без изменений.'
          : 'Ваши правки пропадут. Результат генерации останется в уроке несохранённым: его можно открыть с карточки урока.'}
        cancelLabel="Остаться"
        confirmLabel="Уйти без сохранения"
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </PageFrame>
  );
}

function PageFrame({ lessonId, status, subtitle, children }: {
  lessonId?: number;
  status?: ReactNode;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        {lessonId != null ? (
          <Link to={`/lesson-schedule/lessons/${lessonId}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:text-navy-800">
            <ArrowLeft className="size-4" aria-hidden="true" />
            К уроку
          </Link>
        ) : <span />}
        {status}
      </div>
      <div className="-mt-2 flex flex-col gap-1">
        <h1 className="text-28 font-bold text-ink">КСП · краткосрочный план</h1>
        {subtitle && <p className="text-sm text-planning-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: 'green' | 'amber'; children: ReactNode }) {
  return <span role="status"><Badge appearance="label" size="xs" tone={tone}>{children}</Badge></span>;
}

/**
 * Низ редактора (Р1, Р4, С3, Н3): слева действие варианта, справа — «Скачать … после сохранения»,
 * неактивные Word и PDF и «Сохранить». Ошибка сохранения — текстом у кнопки, правки остаются.
 */
function EditorFooter({ left, saving, retry, error, conflict, onSave, onOverwrite }: {
  left: ReactNode;
  saving: boolean;
  retry: boolean;
  error: string | null;
  conflict: Conflict | null;
  onSave: () => void;
  onOverwrite: (revision: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {error && <p role="alert" className="text-right text-13 font-medium text-red-600">{error}</p>}
      {conflict && (
        <div role="alert" className="flex flex-wrap items-center justify-end gap-3 text-13 font-medium text-red-600">
          <span>{conflict.message}. Ваши правки остались на странице.</span>
          {conflict.revision != null && (
            <Button size="sm" variant="secondary" loading={saving} onClick={() => onOverwrite(conflict.revision as number)}>
              Сохранить поверх
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>{left}</div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-13 text-planning-muted">Скачать Word и PDF можно после сохранения</span>
          {(['docx', 'pdf'] as const).map((format) => (
            <Button key={format} variant="secondary" disabled icon={<Download className="size-4" aria-hidden="true" />}>
              {EXPORT_LABEL[format]}
            </Button>
          ))}
          <Button loading={saving} onClick={onSave} className={cx(retry && 'whitespace-nowrap')}>
            {retry ? 'Повторить сохранение' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
