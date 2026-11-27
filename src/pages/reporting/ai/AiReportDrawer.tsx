import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, RefreshCw, Send, Sparkles, Undo2, Users } from 'lucide-react';
import { AiProgressPanel } from '@/components/ui/AiProgressPanel';
import { Button } from '@/components/ui/Button';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { Modal } from '@/components/ui/Modal';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Select } from '@/components/ui/Select';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { StatusNotice } from '@/components/ui/StatusNotice';
import {
  newIdempotencyKey,
  useAiReport,
  useAiReportCommands,
  useAiReportContext,
  useAiReportHistory,
  useAiReportJob,
  useAiReportVersion,
  useCreateAiReport,
  type AiReportReader,
} from '@/hooks/aiReportQueries';
import { ApiError } from '@/lib/api';
import {
  PARENT_BLOCKS,
  TEACHER_BLOCKS,
  TYPE_LABELS,
  aiErrorText,
  editableBlocks,
  formatDate,
  formatDateTime,
  joinBlocks,
  objectText,
  parentBlocks,
  parentStatus,
  periodText,
  reportStatus,
  reportTitle,
  subjectText,
  teacherBlocks,
  versionOptionLabel,
  type AiReport,
  type TextBlock,
} from '@/lib/aiReportModel';
import { AiReportCreateForm, type AiReportFormState, type AiReportPreset } from './AiReportCreateForm';
import { BlockEditor, EventList, FactsRow, ReportBlocks, StatusBadge, normalizeBlocks } from './AiReportParts';

export type AiDrawerTarget =
  | { kind: 'create'; academicYearId: number | null; preset: AiReportPreset }
  | { kind: 'report'; reportId: number };

/**
 * Шторка AI-сводки (Figma Т2–Т8, И2–И6, Р1–Р7, К3–К5, В2–В4, С1–С5, А3–А4): одна шторка от
 * формы запуска до публикации. Закрытие не отменяет генерацию — задача живёт на сервере,
 * результат найдётся в «Истории AI-отчётов» (ТЗ §4).
 */
export function AiReportDrawer({ reader, target, onClose }: {
  reader: AiReportReader;
  target: AiDrawerTarget;
  onClose: () => void;
}) {
  const [created, setCreated] = useState<{ reportId: number; jobId: number } | null>(null);
  const reportId = target.kind === 'report' ? target.reportId : created?.reportId ?? null;

  if (reportId == null && target.kind === 'create') {
    return <CreateDrawer target={target} onClose={onClose} onCreated={setCreated} />;
  }
  return <ReportDrawer reader={reader} reportId={reportId!} initialJobId={created?.jobId ?? null} onClose={onClose} />;
}

// ---------------------------------------------------------------------------------------------
// Новая сводка
// ---------------------------------------------------------------------------------------------

function CreateDrawer({ target, onClose, onCreated }: {
  target: Extract<AiDrawerTarget, { kind: 'create' }>;
  onClose: () => void;
  onCreated: (created: { reportId: number; jobId: number }) => void;
}) {
  const context = useAiReportContext(target.academicYearId);
  const create = useCreateAiReport();
  const [form, setForm] = useState<AiReportFormState>({ body: null, problem: null });
  const onChange = useCallback((state: AiReportFormState) => setForm(state), []);
  // Тот же запрос — тот же ключ: повтор после обрыва связи вернёт ту же задачу.
  const bodyKey = JSON.stringify(form.body);
  const key = useMemo(() => newIdempotencyKey(), [bodyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const year = context.data?.years?.find((item) => item.id === context.data?.selectedYearId);
  const unavailable = context.data && (context.data.owners ?? []).length === 0;
  const errorCode = create.error instanceof ApiError ? create.error.code : undefined;

  function submit() {
    if (!form.body) return;
    create.mutate({ body: form.body, key }, {
      onSuccess: (job) => onCreated({ reportId: job.reportId!, jobId: job.jobId! }),
    });
  }

  return (
    <Modal open onClose={onClose} placement="right" appearance="drawer" size="drawer" scrollable
      title="Новая AI-сводка"
      subtitle={`${year?.name ?? ''} учебный год · текст появится как черновик — его можно проверить и изменить`.trim()}
      footer={(
        <div className="flex w-full justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onClose}>Отмена</Button>
          <Button variant="navy" size="md" icon={<Sparkles className="size-4" />} loading={create.isPending}
            disabled={!form.body || create.isPending || context.data?.generationEnabled === false}
            onClick={submit}>
            {create.isPending ? 'Формируется…' : 'Сформировать'}
          </Button>
        </div>
      )}>
      {context.isPending ? <LoadingBlock label="Загрузка ваших классов…" /> : context.isError ? (
        <ErrorBlock message="Не удалось загрузить ваши классы и предметы." onRetry={() => void context.refetch()} />
      ) : unavailable ? (
        <StatusNotice tone="warning">
          AI-сводка формируется только по штатным назначениям — предметнику по своим классам и предмету,
          классному руководителю по своему классу. Дополнительный просмотр журнала не даёт генерации,
          утверждения и публикации.
        </StatusNotice>
      ) : (
        <div className="space-y-4">
          {context.data?.generationEnabled === false && (
            <StatusNotice tone="warning">AI-сводки сейчас выключены. Готовые отчёты по-прежнему доступны в истории.</StatusNotice>
          )}
          <AiReportCreateForm context={context.data!} preset={target.preset} onChange={onChange} disabled={create.isPending} />
          {create.isError && <StatusNotice tone="error">{aiErrorText(errorCode, 'Не удалось запустить генерацию. Попробуйте ещё раз.')}</StatusNotice>}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Отчёт
// ---------------------------------------------------------------------------------------------

type Step = 'approve' | 'publish' | 'unpublish' | null;

function ReportDrawer({ reader, reportId, initialJobId, onClose }: {
  reader: AiReportReader;
  reportId: number;
  initialJobId: number | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const detail = useAiReport(reader, reportId);
  const history = useAiReportHistory(reader, reportId);
  const commands = useAiReportCommands(reportId);
  const report = detail.data;
  const admin = reader === 'admin';

  const latestJob = report?.latestJob;
  const runningJobId = initialJobId ?? (latestJob && (latestJob.status === 'PENDING' || latestJob.status === 'RUNNING') ? latestJob.jobId! : null);
  const [watchedJob, setWatchedJob] = useState<number | null>(runningJobId);
  useEffect(() => { if (runningJobId != null) setWatchedJob(runningJobId); }, [runningJobId]);
  const job = useAiReportJob(admin ? null : watchedJob);
  const jobStatus = job.data?.status;
  useEffect(() => {
    if (jobStatus === 'DONE' || jobStatus === 'FAILED') {
      void client.invalidateQueries({ queryKey: ['ai-reports', 'teacher', 'detail', reportId] });
      void client.invalidateQueries({ queryKey: ['ai-reports', 'teacher', 'history', reportId] });
      void client.invalidateQueries({ queryKey: ['ai-reports', 'teacher', 'list'] });
      setWatchedJob(null);
    }
  }, [client, jobStatus, reportId]);
  const generating = !admin && (watchedJob != null || report?.report?.state === 'GENERATING')
    && jobStatus !== 'DONE' && jobStatus !== 'FAILED';

  const [tab, setTab] = useState<'teacher' | 'parent'>('teacher');
  const [teacherDraft, setTeacherDraft] = useState<TextBlock[] | null>(null);
  const [parentDraft, setParentDraft] = useState<TextBlock[] | null>(null);
  const [step, setStep] = useState<Step>(null);
  const [checked, setChecked] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const oldVersion = useAiReportVersion(reader, reportId, viewVersion);

  const current = report?.current;
  const shown = viewVersion != null && viewVersion !== current?.id ? oldVersion.data : current;
  const readOnlyVersion = shown != null && shown.id !== current?.id;
  const approved = shown?.status === 'APPROVED';
  const actions = report?.actions ?? {};
  const student = report?.report?.type === 'STUDENT';
  const hasParentView = student && (approved || report?.parentSummary != null || admin);
  const dirty = teacherDraft != null || parentDraft != null;

  const mutationError = [commands.saveText, commands.approve, commands.saveParent, commands.confirmParent, commands.publish,
    commands.unpublish, commands.regenerate].find((mutation) => mutation.isError)?.error;
  const errorCode = mutationError instanceof ApiError ? mutationError.code : undefined;
  const busy = [commands.saveText, commands.approve, commands.saveParent, commands.confirmParent, commands.publish,
    commands.unpublish, commands.regenerate].some((mutation) => mutation.isPending);

  function resetErrors() {
    [commands.saveText, commands.approve, commands.saveParent, commands.confirmParent, commands.publish,
      commands.unpublish, commands.regenerate].forEach((mutation) => mutation.reset());
  }

  function close() {
    if (dirty && !window.confirm('Несохранённые правки пропадут. Закрыть шторку?')) return;
    onClose();
  }

  function regenerate() {
    if (dirty && !window.confirm('Новая версия сформируется по данным журнала, а несохранённые правки пропадут. Продолжить?')) return;
    resetErrors();
    setTeacherDraft(null);
    setParentDraft(null);
    commands.regenerate.mutate(undefined, { onSuccess: (started) => setWatchedJob(started.jobId ?? null) });
  }

  function saveTeacher(onSaved?: (saved: AiReport) => void) {
    if (!teacherDraft || !current) return;
    resetErrors();
    const text = joinBlocks(normalizeBlocks(teacherDraft), true);
    commands.saveText.mutate({ baseVersionId: current.id!, revision: current.revision!, text }, {
      onSuccess: (saved) => { setTeacherDraft(null); setConflict(false); onSaved?.(saved); },
      onError: (error) => { if (error instanceof ApiError && error.code === 'AI_REPORT_VERSION_CONFLICT') setConflict(true); },
    });
  }

  function approve() {
    if (!current) return;
    resetErrors();
    commands.approve.mutate({ versionId: current.id!, revision: current.revision! }, {
      onSuccess: () => { setStep(null); setChecked(false); },
    });
  }

  function parentText(): string {
    return parentDraft ? joinBlocks(normalizeBlocks(parentDraft), false)
      : report?.parentSummary && !report.parentSummary.outdated ? report.parentSummary.text ?? ''
        : current?.parentSuggestion ?? '';
  }

  function saveParent(then?: (saved: AiReport) => void) {
    resetErrors();
    const summary = report?.parentSummary;
    const editable = summary && summary.status === 'DRAFT' && !summary.outdated;
    commands.saveParent.mutate({ text: parentText(), revision: editable ? summary.revision : undefined }, {
      onSuccess: (saved) => { setParentDraft(null); then?.(saved); },
    });
  }

  function confirmParent() {
    const summary = report?.parentSummary;
    const confirm = (target: AiReport) => {
      const fresh = target.parentSummary;
      if (!fresh) return;
      commands.confirmParent.mutate({ parentSummaryId: fresh.id!, revision: fresh.revision! });
    };
    if (parentDraft || !summary || summary.outdated || summary.status !== 'DRAFT') saveParent(confirm);
    else confirm(report!);
  }

  function publish() {
    const summary = report?.parentSummary;
    if (!summary) return;
    resetErrors();
    commands.publish.mutate(summary.id!, { onSuccess: () => setStep(null) });
  }

  function unpublish() {
    resetErrors();
    commands.unpublish.mutate(undefined, { onSuccess: () => setStep(null) });
  }

  const summary = report?.report;
  const status = reportStatus(summary);
  const header = (
    <div className="flex flex-wrap items-center gap-2 text-13 text-slate-500">
      <StatusBadge status={status} />
      {shown?.number != null && <span>Версия {shown.number}{shown.approvedAt ? ` · утверждена ${formatDateTime(shown.approvedAt)}${shown.approvedBy?.name ? ` · ${shown.approvedBy.name}` : ''}` : ''}</span>}
    </div>
  );

  const rows = summary ? [
    { key: 'type', label: 'Тип', value: TYPE_LABELS[summary.type as keyof typeof TYPE_LABELS] ?? summary.type },
    { key: 'object', label: summary.student ? 'Ученик' : summary.type === 'CLASSES' ? 'Классы' : 'Класс', value: objectText(summary) },
    { key: 'subject', label: 'Предмет', value: summary.owner === 'HOMEROOM' ? 'Все предметы класса' : subjectText(summary) },
    { key: 'period', label: 'Период', value: periodText(summary.period) },
    { key: 'created', label: 'Сформирован', value: shown?.createdAt ? `${formatDateTime(shown.createdAt)}${shown.createdBy?.name ? ` · ${shown.createdBy.name}` : ''}` : '—' },
  ] : [];

  const parentEditing = parentDraft != null;
  const teacherEditing = teacherDraft != null;
  const parentSummary = report?.parentSummary;
  const pStatus = parentStatus(report);
  const publication = report?.publication;
  const ourPublication = publication && parentSummary && publication.parentSummaryId === parentSummary.id ? publication : null;

  let footer: React.ReactNode;
  if (admin || !current) {
    footer = (
      <div className="flex w-full justify-end gap-3">
        {!admin && !current && !generating && actions.canRegenerate && (
          <Button variant="navy" size="md" icon={<RefreshCw className="size-4" />} loading={commands.regenerate.isPending} onClick={regenerate}>Повторить</Button>
        )}
        {generating && <Button variant="navy" size="md" loading disabled>Формируется…</Button>}
        <Button variant="secondary" size="md" onClick={close}>Закрыть</Button>
      </div>
    );
  } else if (readOnlyVersion) {
    footer = (
      <div className="flex w-full justify-between gap-3">
        <Button variant="ghost" size="md" onClick={() => setViewVersion(null)}>К текущей версии</Button>
        <Button variant="secondary" size="md" onClick={close}>Закрыть</Button>
      </div>
    );
  } else if (tab === 'teacher') {
    if (teacherEditing) {
      footer = (
        <div className="flex w-full gap-3">
          <Button variant="secondary" size="md" onClick={() => { setTeacherDraft(null); setConflict(false); resetErrors(); }}>Отмена</Button>
          <Button variant="navy" size="md" loading={commands.saveText.isPending} onClick={() => saveTeacher()}>Сохранить</Button>
        </div>
      );
    } else if (step === 'approve') {
      footer = (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <label className="flex max-w-md items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1 size-4 accent-navy-700" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            <span>Я проверил(а) факты и рекомендации AI
              <span className="block text-13 text-slate-500">После утверждения изменить текст можно только новой версией.</span>
            </span>
          </label>
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={() => { setStep(null); setChecked(false); }}>Отмена</Button>
            <Button variant="navy" size="md" disabled={!checked} loading={commands.approve.isPending} onClick={approve}>Утвердить</Button>
          </div>
        </div>
      );
    } else {
      footer = (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {actions.canRegenerate && (
              <Button variant="ghost" size="md" icon={<RefreshCw className="size-4" />} disabled={busy || generating} onClick={regenerate}>
                {approved ? 'Новая версия' : 'Повторить генерацию'}
              </Button>
            )}
            {actions.canEdit && (
              <Button variant="ghost" size="md" icon={<Pencil className="size-4" />} disabled={busy || generating}
                onClick={() => { resetErrors(); setTeacherDraft(editableBlocks(current.teacherText, TEACHER_BLOCKS)); }}>
                Редактировать
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            {!approved && actions.canApprove && (
              <Button variant="navy" size="md" disabled={busy || generating} onClick={() => setStep('approve')}>Утвердить</Button>
            )}
            {approved && student && actions.canEditParentSummary && (
              <Button variant="navy" size="md" icon={<Users className="size-4" />} onClick={() => setTab('parent')}>
                {parentSummary ? 'Сводка для родителя' : 'Подготовить сводку для родителя'}
              </Button>
            )}
            {approved && !student && <Button variant="secondary" size="md" onClick={close}>Закрыть</Button>}
          </div>
        </div>
      );
    }
  } else if (parentEditing) {
    footer = (
      <div className="flex w-full gap-3">
        <Button variant="secondary" size="md" onClick={() => { setParentDraft(null); resetErrors(); }}>Отмена</Button>
        <Button variant="navy" size="md" loading={commands.saveParent.isPending} onClick={() => saveParent()}>Сохранить</Button>
      </div>
    );
  } else if (step === 'publish' || step === 'unpublish') {
    const publishing = step === 'publish';
    footer = (
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink">
          <b>{publishing ? 'Опубликовать сводку родителям?' : 'Снять публикацию?'}</b>
          <span className="block text-13 text-slate-500">{publishing
            ? 'Родитель увидит текст в приложении и получит уведомление.'
            : 'Родитель сразу перестанет видеть сводку, в том числе по старой ссылке.'}</span>
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" size="md" onClick={() => setStep(null)}>Отмена</Button>
          {publishing
            ? <Button variant="navy" size="md" icon={<Send className="size-4" />} loading={commands.publish.isPending} onClick={publish}>Опубликовать</Button>
            : <Button variant="danger" size="md" icon={<Undo2 className="size-4" />} loading={commands.unpublish.isPending} onClick={unpublish}>Снять публикацию</Button>}
        </div>
      </div>
    );
  } else if (ourPublication?.active) {
    footer = (
      <div className="flex w-full justify-between gap-3">
        {actions.canUnpublish
          ? <Button variant="danger-outline" size="md" icon={<Undo2 className="size-4" />} onClick={() => setStep('unpublish')}>Снять публикацию</Button>
          : <span />}
        <Button variant="secondary" size="md" onClick={close}>Закрыть</Button>
      </div>
    );
  } else {
    const canConfirm = actions.canEditParentSummary && (actions.canConfirmParentSummary || !parentSummary || parentSummary.outdated
      || parentSummary.status === 'DRAFT') && parentSummary?.status !== 'CONFIRMED' && parentText().trim().length > 0;
    const publishHint = !report?.parentPublicationEnabled ? 'Публикация родителям пока не включена в школе.'
      : parentSummary?.status !== 'CONFIRMED' ? 'Сначала утвердите текст для родителя.'
        : parentSummary?.outdated ? 'Текст построен по прежней версии отчёта.' : undefined;
    footer = (
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {actions.canEditParentSummary && parentSummary?.status !== 'CONFIRMED' && (
            <Button variant="ghost" size="md" icon={<Pencil className="size-4" />} disabled={busy}
              onClick={() => { resetErrors(); setParentDraft(editableBlocks(parentText(), PARENT_BLOCKS)); }}>Редактировать</Button>
          )}
          {actions.canEditParentSummary && parentSummary?.status === 'CONFIRMED' && !ourPublication?.active && (
            <Button variant="ghost" size="md" icon={<Pencil className="size-4" />} disabled={busy}
              onClick={() => { resetErrors(); setParentDraft(editableBlocks(parentSummary.text, PARENT_BLOCKS)); }}>Изменить текст</Button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {canConfirm && (
            <Button variant="secondary" size="md" loading={commands.saveParent.isPending || commands.confirmParent.isPending}
              onClick={confirmParent}>Утвердить текст</Button>
          )}
          <span title={actions.canPublish ? undefined : publishHint}>
            <Button variant="navy" size="md" icon={<Send className="size-4" />} disabled={!actions.canPublish || busy}
              onClick={() => setStep('publish')}>
              {ourPublication && !ourPublication.active ? 'Опубликовать снова' : 'Опубликовать родителям'}
            </Button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <Modal open onClose={close} placement="right" appearance="drawer" size="drawer" scrollable
      title={reportTitle(summary)} subtitle={summary ? header : undefined} footer={footer}>
      {detail.isPending ? <LoadingBlock label="Загрузка отчёта…" /> : detail.isError ? (
        <ErrorBlock message={aiErrorText(detail.error instanceof ApiError ? detail.error.code : undefined, 'Не удалось загрузить отчёт.')}
          onRetry={detail.error instanceof ApiError && detail.error.status === 404 ? undefined : () => void detail.refetch()} />
      ) : (
        <div className="space-y-5">
          {admin && (
            <StatusNotice tone="navy" icon={Eye}>Просмотр: утверждённый текст и версия для родителя. Генерации, правки и публикации здесь нет.</StatusNotice>
          )}
          {conflict && (
            <StatusNotice tone="warning">
              Отчёт изменён в другом окне. Ваши правки не потеряны — обновите отчёт и сохраните их ещё раз.{' '}
              <Button variant="link" size="inline" onClick={() => { void detail.refetch(); setConflict(false); resetErrors(); }}>Обновить</Button>
            </StatusNotice>
          )}
          {!admin && report?.sourcesChanged && !generating && (
            <StatusNotice tone="attention">
              Данные изменились: после формирования версии в журнале появились новые оценки или отметки. Текст сам не меняется.
              {actions.canRegenerate && <>{' '}<Button variant="link" size="inline" onClick={regenerate}>Сформировать новую версию</Button></>}
            </StatusNotice>
          )}
          {!admin && current && latestJob?.status === 'FAILED' && !generating && (latestJob.createdAt ?? '') > (current.createdAt ?? '') && (
            <AiProgressPanel state="error" title="Генерация не удалась — прежний текст на месте"
              description={aiErrorText(latestJob.errorCode, 'Попробуйте сформировать ещё раз.')} />
          )}
          {!admin && current && !actions.canEdit && !actions.canUnpublish && !actions.canRegenerate && (
            <StatusNotice tone="info">Назначение на этот класс снято — отчёт доступен только для чтения.</StatusNotice>
          )}

          {rows.length > 0 && <KeyValueList rows={rows} />}

          {generating && (
            <AiProgressPanel title={`AI готовит сводку: ${[objectText(summary), summary?.subject?.name, summary?.period?.label].filter(Boolean).join(' · ')}`}
              description="Шторку можно закрыть — сводка появится в «Истории AI-отчётов»." />
          )}
          {!current && !generating && latestJob?.status === 'FAILED' && (
            <AiProgressPanel state="error" title="Сводку сформировать не удалось" description={aiErrorText(latestJob.errorCode, 'Попробуйте ещё раз.')} />
          )}

          {current && (report?.versions ?? []).length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-13 text-slate-500">Версия</span>
              <Select aria-label="Версия отчёта" className="max-w-sm" value={String(shown?.id ?? current.id)} disabled={dirty}
                onChange={(event) => setViewVersion(Number(event.target.value) === current.id ? null : Number(event.target.value))}>
                {[...(report?.versions ?? [])].reverse().map((item) => <option key={item.id} value={item.id}>{versionOptionLabel(item)}</option>)}
              </Select>
            </div>
          )}
          {readOnlyVersion && <StatusNotice tone="info">Прежняя версия — только чтение.</StatusNotice>}

          {current && hasParentView && !readOnlyVersion && (
            <SegmentedTabs ariaLabel="Чей текст" value={tab} appearance="outlined"
              onChange={(value) => { if (!dirty) { setTab(value); setStep(null); } }}
              options={[{ value: 'teacher', label: 'Для учителя' }, { value: 'parent', label: 'Для родителя', disabled: dirty }]} />
          )}

          {shown && (tab === 'teacher' || readOnlyVersion) && (
            <>
              <FactsRow facts={shown.facts} />
              {teacherEditing
                ? <BlockEditor blocks={teacherDraft!} onChange={setTeacherDraft} disabled={commands.saveText.isPending} />
                : <ReportBlocks blocks={teacherBlocks(shown.teacherText)} approved={approved} />}
            </>
          )}

          {current && tab === 'parent' && !readOnlyVersion && (
            <ParentSection report={report!} admin={admin} draft={parentDraft} onDraft={setParentDraft}
              statusLabel={pStatus} text={parentText()} />
          )}

          {mutationError != null && !conflict && (
            <StatusNotice tone="error">{aiErrorText(errorCode, 'Не удалось сохранить. Текст остался в форме — попробуйте ещё раз.')}</StatusNotice>
          )}

          {tab === 'teacher' && (
            <div className="border-t border-planning-line pt-4">
              <EventList events={history.data} versions={report?.versions} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ParentSection({ report, admin, draft, onDraft, statusLabel, text }: {
  report: AiReport;
  admin: boolean;
  draft: TextBlock[] | null;
  onDraft: (next: TextBlock[]) => void;
  statusLabel: ReturnType<typeof parentStatus>;
  text: string;
}) {
  const history = useAiReportHistory(admin ? 'admin' : 'teacher', report.report?.id ?? null);
  const summary = report.parentSummary;
  const suggestion = !summary || summary.outdated;
  const subject = report.report?.subject?.name;
  return (
    <div className="space-y-4">
      <StatusNotice tone="info" icon={Eye}>
        Этот текст увидит родитель в приложении. Он короче учительского и не содержит служебных комментариев, данных
        других учеников и выводов без опоры на оценки.
      </StatusNotice>
      {!report.parentPublicationEnabled && !admin && (
        <StatusNotice tone="warning">Публикация родителям пока не включена в школе: текст можно подготовить и утвердить заранее.</StatusNotice>
      )}
      {summary?.outdated && !admin && (
        <StatusNotice tone="attention">Прежний текст для родителя построен по старой версии отчёта. Ниже — новое предложение AI: проверьте и утвердите его.</StatusNotice>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-13 text-slate-500">{subject ? `Сводка по предмету «${subject}»` : 'Общая сводка по всем предметам класса'}</span>
        {suggestion ? <StatusBadgeText text="Предложение AI" /> : <StatusBadge status={statusLabel} />}
      </div>
      {draft
        ? <BlockEditor blocks={draft} onChange={onDraft} />
        : text.trim()
          ? <ReportBlocks blocks={parentBlocks(text)} approved={!suggestion} bullets={false} />
          : <p className="text-sm text-slate-500">AI не предложил текст для родителя — нажмите «Редактировать» и напишите его сами.</p>}
      {summary?.confirmedAt && <p className="text-xs text-slate-500">Текст утверждён {formatDate(summary.confirmedAt)}.</p>}
      <div className="rounded-xl border border-planning-line p-4">
        <EventList title="История публикации" events={history.data} versions={report.versions}
          kinds={['PARENT_SUMMARY_CONFIRMED', 'PUBLISHED', 'UNPUBLISHED']} />
        {!(history.data ?? []).some((event) => ['PARENT_SUMMARY_CONFIRMED', 'PUBLISHED', 'UNPUBLISHED'].includes(event.kind ?? '')) && (
          <p className="text-13 text-slate-500">Родителям ещё не публиковалось.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadgeText({ text }: { text: string }) {
  return <span className="rounded-full bg-ai-panel px-2.5 py-0.5 text-xs font-semibold text-navy-700 ring-1 ring-ai-panel-line">{text}</span>;
}
