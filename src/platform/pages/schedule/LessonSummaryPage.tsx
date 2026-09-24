import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { AiJobProgress } from '@/components/ui/AiJobProgress';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { SummaryDocument } from '@/components/ui/SummaryDocument';
import { useToast } from '@/context/ToastContext';
import { useLesson, useLessonSummary, useSummaryCommands } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { summaryRunning, type SummaryContent } from '@/lib/lessonSummaryApi';
import { LessonSummaryGenerateModal } from './LessonSummaryGenerateModal';

export function LessonSummaryPage() {
  const { lessonId } = useParams();
  return <SummaryPage key={lessonId} id={Number(lessonId)} />;
}

function SummaryPage({ id }: { id: number }) {
  useDocumentTitle('Конспект урока');
  const valid = Number.isSafeInteger(id) && id > 0;
  const navigate = useNavigate();
  const toast = useToast();
  const lesson = useLesson(valid ? id : null);
  const query = useLessonSummary(valid ? id : null);
  const { save, publish, unpublish } = useSummaryCommands(id);
  // The local copy pins its revision. Polling must never overwrite unsaved input.
  const [edit, setEdit] = useState<{ content: SummaryContent; revision: number } | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview' | 'published'>('edit');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'discard' | 'unpublish' | null>(null);
  const [error, setError] = useState('');
  const [candidateOpen, setCandidateOpen] = useState(false);
  const data = query.data;
  const dirty = edit != null;
  const content: SummaryContent = edit?.content ?? data?.content ?? {
    title: lesson.data?.topic || 'Конспект урока', summaryText: '', companionText: '', companionKind: 'RETELLING',
  };
  const busy = save.isPending || publish.isPending || unpublish.isPending;
  const job = data?.latestJob;
  const running = summaryRunning(job);
  const canPublish = Boolean(content.title?.trim() && content.summaryText.trim() && content.companionText.trim());
  const conflict = edit != null && edit.revision !== data?.revision;

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  function change(patch: Partial<SummaryContent>) {
    setEdit({ content: { ...content, ...patch }, revision: edit?.revision ?? data?.revision ?? 0 });
    setError('');
  }

  async function persist(shouldPublish: boolean) {
    setError('');
    try {
      let revision = data?.revision ?? 0;
      if (edit || !data?.content) {
        const result = await save.mutateAsync({ revision: edit?.revision ?? revision, content });
        revision = result.revision ?? revision;
        setEdit(null);
      }
      if (shouldPublish) {
        await publish.mutateAsync(revision);
        setMode('published');
      }
      toast.success(shouldPublish ? 'Оба блока опубликованы для учеников' : 'Черновик сохранён');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить конспект. Ваши правки остались на странице.');
    }
  }

  async function confirmAction() {
    if (confirm === 'leave') navigate('/lesson-schedule/lessons/' + id);
    if (confirm === 'discard') {
      setEdit(null);
      setError('');
      void query.refetch();
    }
    if (confirm === 'unpublish') {
      try {
        const result = await unpublish.mutateAsync(data?.revision ?? 0);
        // Removing the publication doesn't change the saved draft.
        setEdit((previous) => previous ? { ...previous, revision: result.revision ?? previous.revision } : null);
        setMode('edit');
        toast.success('Конспект скрыт от учеников');
      } catch (e) { setError(e instanceof ApiError ? e.message : 'Не удалось снять публикацию'); }
    }
    setConfirm(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} disabled={busy}
          onClick={() => dirty ? setConfirm('leave') : navigate('/lesson-schedule/lessons/' + id)}>К уроку</Button>
        {data && <Badge tone={data.publishedAt ? 'green' : 'gray'}>{data.publishedAt ? 'Опубликован' : 'Черновик'}</Badge>}
      </div>
      <div>
        <h1 className="text-28 font-bold text-ink">Конспект урока</h1>
        <p className="text-sm text-muted">{[lesson.data?.subjectName, lesson.data?.className, lesson.data?.topic].filter(Boolean).join(' · ')}</p>
      </div>
      {!valid ? <ErrorBlock message="Урок не найден" /> : query.isPending ? <LoadingBlock label="Загружаем конспект…" /> :
        query.isError ? <ErrorBlock message={query.error.message} onRetry={() => void query.refetch()} /> : data && <>
          {!data.canEdit && data.hasUnpublishedChanges && <NoticeBar tone="soft">
            Показан черновик. {data.publishedAt ? 'Ученики видят предыдущую опубликованную версию.' : 'Ученикам он пока недоступен.'}
          </NoticeBar>}
          {data.canEdit && <>
            <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-semibold text-ink">{dirty ? 'Есть несохранённые правки' :
                  data.hasUnpublishedChanges ? 'Черновик готов к редактированию' : data.publishedAt ? 'Ученики видят оба блока' : 'Начните с материала урока'}</p>
                <p className="mt-1 text-sm text-muted">{data.publishedAt && (dirty || data.hasUnpublishedChanges)
                  ? 'Ученики пока видят предыдущую опубликованную версию.'
                  : 'Конспект и пересказ или план — в одном документе.'}</p>
              </div>
              <Button variant="secondary" icon={<Sparkles className="size-4" />} onClick={() => setGenerateOpen(true)}
                disabled={dirty || busy || running || !lesson.data || data.aiEnabled === false || data.remainingCalls === 0}>
                {data.content?.summaryText ? 'Сгенерировать заново' : 'Создать с ИИ'}
              </Button>
              {dirty && <p className="w-full text-sm text-muted">Сохраните правки перед новой генерацией.</p>}
              {data.aiEnabled === false && <p className="w-full text-sm text-muted">Генерация временно отключена. Вы можете написать конспект вручную.</p>}
              {data.remainingCalls === 0 && <p className="w-full text-sm text-muted">Дневной лимит ИИ исчерпан. Редактирование и публикация доступны.</p>}
            </div>
            {job && <div aria-live="polite"><AiJobProgress job={job} /></div>}
            {running && <NoticeBar tone="soft">Готовим новый черновик. Вы можете продолжать редактирование — ваши правки сохранятся.</NoticeBar>}
            {job?.status === 'DONE' && !job.applied && job.result && <NoticeBar tone="warning">
              Пока работал ИИ, конспект изменился. Сгенерированный вариант сохранён отдельно.
              <Button size="sm" variant="ghost" onClick={() => setCandidateOpen((value) => !value)}>
                {candidateOpen ? 'Скрыть результат' : 'Посмотреть результат'}
              </Button>
            </NoticeBar>}
            {candidateOpen && job?.result && <div className="card space-y-5 p-6">
              <SummaryDocument content={job.result} />
              <Button variant="secondary" disabled={dirty || busy} onClick={() => {
                setEdit({ content: job.result!, revision: data.revision ?? 0 });
                setMode('edit'); setCandidateOpen(false);
              }}>Использовать как черновик</Button>
              {dirty && <p className="text-sm text-muted">Сначала сохраните или отмените свои правки.</p>}
            </div>}
            <SegmentedTabs value={mode} onChange={setMode} ariaLabel="Режим конспекта"
              options={[
                { value: 'edit', label: 'Редактирование' }, { value: 'preview', label: 'Предпросмотр' },
                ...(data.publishedContent ? [{ value: 'published' as const, label: 'Видно ученикам' }] : []),
              ]} className="self-start flex-wrap" />
          </>}
          {conflict && <NoticeBar tone="warning">На сервере появилась новая версия. Ваши правки сохранены на странице.
            Скопируйте нужный текст перед загрузкой актуальной версии.
            <Button variant="ghost" size="sm" onClick={() => setConfirm('discard')}>Загрузить актуальную версию</Button>
          </NoticeBar>}
          <div className="card p-5 sm:p-8">
            {data.canEdit && mode === 'edit' ? <fieldset disabled={busy} className="space-y-6">
              <Field label="Название" required>
                <TextInput aria-label="Название конспекта" value={content.title ?? ''} maxLength={300}
                  onChange={(e) => change({ title: e.target.value })} />
              </Field>
              <div className="grid gap-6 xl:grid-cols-2">
                <Field label="Краткий конспект" hint="Основные мысли, определения и формулы. До 20 000 знаков.">
                  <TextArea aria-label="Краткий конспект" rows={18} maxLength={20000} value={content.summaryText}
                    placeholder="Создайте конспект с ИИ или напишите здесь…" onChange={(e) => change({ summaryText: e.target.value })} />
                </Field>
                <div className="space-y-3">
                  <Field label="Второй блок">
                    <Select aria-label="Формат второго блока" value={content.companionKind}
                      onChange={(e) => change({ companionKind: e.target.value as SummaryContent['companionKind'] })}>
                      <option value="RETELLING">Краткий пересказ</option><option value="PLAN">План урока</option>
                    </Select>
                  </Field>
                  <TextArea aria-label="Текст второго блока" rows={16} maxLength={20000} value={content.companionText}
                    placeholder="Пересказ или последовательность шагов урока…" onChange={(e) => change({ companionText: e.target.value })} />
                  <p className="text-xs text-muted">Этот блок тоже будет виден ученикам.</p>
                </div>
              </div>
              <p className="text-xs text-muted">Формулы можно записывать между $…$. Проверьте их в предпросмотре.</p>
            </fieldset> : mode === 'published' && data.publishedContent ?
              <SummaryDocument content={data.publishedContent} /> :
              (data.content || dirty) ? <SummaryDocument content={content} /> :
                <EmptyBlock title="Конспект пока не опубликован" description="Здесь появятся материалы, когда учитель их опубликует." />}
          </div>
          {error && <div role="alert"><ErrorBlock message={error} /></div>}
          {data.canEdit && <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
            <div className="flex flex-wrap gap-2">
              {data.publishedAt && <Button variant="ghost" disabled={busy || conflict} onClick={() => setConfirm('unpublish')}>Снять с публикации</Button>}
              {dirty && <Button variant="ghost" disabled={busy} onClick={() => setConfirm('discard')}>Отменить правки</Button>}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" loading={save.isPending} disabled={busy || !content.title?.trim() || (!dirty && Boolean(data.content)) || conflict}
                onClick={() => void persist(false)}>Сохранить черновик</Button>
              <Button loading={publish.isPending} disabled={busy || !canPublish || conflict || (!dirty && !data.hasUnpublishedChanges && Boolean(data.publishedAt))}
                onClick={() => void persist(true)}>{data.publishedAt ? 'Обновить публикацию' : 'Опубликовать оба блока'}</Button>
            </div>
          </div>}
        </>}
      {generateOpen && lesson.data && <LessonSummaryGenerateModal lesson={lesson.data} companionKind={content.companionKind}
        onClose={() => setGenerateOpen(false)} onStarted={() => setMode('edit')} />}
      <ConfirmDialog open={confirm != null} onClose={() => setConfirm(null)} loading={unpublish.isPending}
        onConfirm={() => void confirmAction()} title={confirm === 'unpublish' ? 'Скрыть конспект от учеников?' : 'Отменить несохранённые правки?'}
        message={confirm === 'unpublish' ? 'Оба блока станут недоступны ученикам. Черновик сохранится, его можно опубликовать снова.' :
          'Изменения на этой странице будут потеряны. Сохранённый черновик останется.'}
        confirmLabel={confirm === 'unpublish' ? 'Снять с публикации' : confirm === 'leave' ? 'Уйти без сохранения' : 'Отменить правки'} />
    </div>
  );
}
