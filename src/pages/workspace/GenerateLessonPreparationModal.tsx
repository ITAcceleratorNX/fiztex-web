import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { WorkspaceMaterialPickerModal } from '@/components/workspace/WorkspaceMaterialPickerModal';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { SummaryDocument } from '@/components/ui/SummaryDocument';
import { usePreparationAiOverview, usePreparationAiSource, useStartPreparationAiGeneration, useUploadWorkspaceFile } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { SummaryContent } from '@/lib/lessonSummaryApi';
import type { PreparationAiRequest } from '@/lib/lessonPreparationApi';
import { validatePages } from '@/lib/summaryPages';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

const supported = /\.(pdf|docx|png|jpe?g)$/i;
const options = [
  { value: 'TEXTBOOK', label: 'Учебник' },
  { value: 'DOCUMENT', label: 'Документ' },
  { value: 'UPLOAD', label: 'Загрузить файл' },
] as const;
type SourceTab = (typeof options)[number]['value'];

export function GenerateLessonPreparationModal({ onClose, onUse }: {
  onClose: () => void;
  onUse: (content: SummaryContent, source: WorkspaceSearchItem | null) => void;
}) {
  const [tab, setTab] = useState<SourceTab>('TEXTBOOK');
  const [source, setSource] = useState<WorkspaceSearchItem | null>(null);
  const [picker, setPicker] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState<NonNullable<SummaryContent['companionKind']>>('PLAN');
  const [language, setLanguage] = useState('ru');
  const [error, setError] = useState('');
  const attempt = useRef<{ body: string; key: string }>();
  const overview = usePreparationAiOverview();
  const sourceType = tab === 'TEXTBOOK' ? 'TEXTBOOK' : 'DOCUMENT';
  const metadata = usePreparationAiSource(sourceType, source?.id ?? null);
  const upload = useUploadWorkspaceFile();
  const start = useStartPreparationAiGeneration();
  const job = overview.data?.latestJob;
  const running = job?.status === 'PENDING' || job?.status === 'RUNNING';
  const busy = upload.isPending || start.isPending;
  const pageError = metadata.data?.pageNavigation
    ? validatePages(from, to, metadata.data.pageCount ?? 0, metadata.data.maxPages ?? 30) : '';
  const result = job?.status === 'DONE' && job.result?.summaryText && job.result.companionText
    && job.result.companionKind ? job.result : null;

  function changeTab(next: SourceTab) {
    setTab(next);
    setSource(null);
    setFile(null);
    setFrom('');
    setTo('');
    setError('');
  }

  async function uploadFile(next: File | null) {
    setFile(next);
    setSource(null);
    setFrom('');
    setTo('');
    setError('');
    if (!next) return;
    if (!supported.test(next.name) || next.size === 0 || next.size > 50 * 1024 * 1024) {
      setError('Выберите PDF, DOCX, PNG или JPG размером до 50 МБ. Файл не должен быть пустым.');
      return;
    }
    try {
      const material = await upload.mutateAsync(next);
      if (material.workspaceItemId == null) throw new Error('Missing workspace item');
      setSource({ id: material.workspaceItemId, title: material.title ?? next.name,
        type: 'DOCUMENT', fileExtension: material.fileExtension });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить файл. Повторите загрузку.');
    }
  }

  async function generate() {
    if (source?.id == null || !metadata.data || pageError || busy || running) return;
    const body: PreparationAiRequest = {
      sourceType, workspaceItemId: source.id, companionKind: kind,
      language, teacherPrompt: prompt.trim(),
      ...(metadata.data.pageNavigation && from ? { pageFrom: Number(from), pageTo: Number(to || from) } : {}),
    };
    const serialized = JSON.stringify(body);
    if (attempt.current?.body !== serialized) attempt.current = { body: serialized, key: crypto.randomUUID() };
    setError('');
    try {
      await start.mutateAsync({ body, key: attempt.current.key });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось начать генерацию. Повторите попытку.');
    }
  }

  function useResult() {
    if (!result) return;
    const request = job?.request;
    const usedSource: WorkspaceSearchItem | null = request?.workspaceItemId && request.sourceType
      ? { id: request.workspaceItemId, title: job?.sourceName ?? 'Источник', type: request.sourceType }
      : null;
    onUse(result, usedSource);
    onClose();
  }

  return <>
    <Modal open onClose={() => { if (!busy) onClose(); }} title="Создать заготовку с ИИ" size="lg"
      subtitle="Выберите источник из рабочего пространства. Готовый конспект можно отредактировать перед сохранением."
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Закрыть</Button>
        <Button icon={<Sparkles className="size-4" />} onClick={() => void generate()} loading={start.isPending}
          disabled={busy || running || overview.isPending || overview.isError || !overview.data?.aiEnabled
            || (overview.data?.remainingCalls ?? 0) <= 0 || !source?.id || !metadata.data || Boolean(pageError)}>
          Сгенерировать
        </Button>
      </>}>
      <div className="space-y-5">
        {overview.isPending && <LoadingBlock label="Проверяем доступность генерации…" />}
        {overview.isError && <ErrorBlock message="Не удалось загрузить генерацию" onRetry={() => void overview.refetch()} />}
        {overview.data && <>
          {!overview.data.aiEnabled && <NoticeBar tone="warning">Генерация сейчас отключена. Заготовку можно создать вручную.</NoticeBar>}
          <p className="text-sm text-muted">Осталось вызовов ИИ сегодня: {overview.data.remainingCalls ?? 0}</p>
          <fieldset disabled={busy || running || !overview.data.aiEnabled} className="min-w-0 space-y-5">
            <SegmentedTabs value={tab} options={options} onChange={changeTab} ariaLabel="Источник для заготовки" className="flex-wrap" />
            {tab === 'UPLOAD' ? <>
              <FileDropzone file={file} onChange={(next) => void uploadFile(next)} disabled={busy || running}
                accept=".pdf,.docx,.png,.jpg,.jpeg" formatsLabel="PDF, DOCX, PNG, JPG · до 50 МБ" error={Boolean(error)} />
              <p className="text-sm text-muted">Файл сохранится в разделе «Документы и материалы».</p>
              {upload.isPending && <LoadingBlock label="Загружаем файл…" />}
              {upload.isError && file && <Button variant="secondary" onClick={() => void uploadFile(file)}>Повторить загрузку</Button>}
            </> : <div className="space-y-2">
              <Field label={tab === 'TEXTBOOK' ? 'Учебник' : 'Документ'} required>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" onClick={() => setPicker(true)}>
                    {source ? 'Заменить источник' : 'Выбрать из рабочего пространства'}
                  </Button>
                  {source && <span className="text-sm text-ink">{source.title}</span>}
                </div>
              </Field>
            </div>}
            {source?.id != null && metadata.isPending && <LoadingBlock label="Проверяем источник…" />}
            {metadata.isError && <ErrorBlock message={metadata.error.message} onRetry={() => void metadata.refetch()} />}
            {metadata.data?.pageNavigation && <Field label="Страницы PDF" error={pageError}
              hint={`Всего ${metadata.data.pageCount} стр. За один раз — до ${metadata.data.maxPages}. Номера страниц в файле могут отличаться от печатных.`}>
              <div className="flex items-center gap-3">
                <TextInput type="number" min={1} max={metadata.data.pageCount} aria-label="Со страницы" placeholder="С" value={from} onChange={(event) => setFrom(event.target.value)} />
                <span className="text-muted">—</span>
                <TextInput type="number" min={1} max={metadata.data.pageCount} aria-label="По страницу" placeholder="По" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
            </Field>}
            <Field label="Тема или пожелание" hint="Например: объясни второй закон Ньютона простыми словами и выдели основные формулы.">
              <TextArea rows={3} maxLength={2000} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Второй блок"><Select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
                <option value="PLAN">План урока</option><option value="RETELLING">Краткий пересказ</option>
              </Select></Field>
              <Field label="Язык"><Select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option>
              </Select></Field>
            </div>
          </fieldset>
          {running && <LoadingBlock label={job?.phase === 'CALLING_MODEL' ? 'ИИ готовит конспект…' : 'Обрабатываем материал…'} />}
          {job?.status === 'FAILED' && <ErrorBlock message={job.errorMessage ?? 'Не удалось создать конспект. Попробуйте снова.'} />}
          {result && <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-ink">Последняя генерация · {job?.sourceName}</p>
            <SummaryDocument content={{ title: result.title, summaryText: result.summaryText,
              companionText: result.companionText, companionKind: result.companionKind }} />
            {job?.warningMessage && <NoticeBar tone="warning">{job.warningMessage}</NoticeBar>}
            <Button type="button" onClick={useResult}>Использовать в заготовке</Button>
          </div>}
          <NoticeBar tone="soft">ИИ подготовит черновик без привязки к уроку. Проверьте текст и сохраните заготовку отдельно.</NoticeBar>
        </>}
        {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
      </div>
    </Modal>
    {picker && <WorkspaceMaterialPickerModal
      usage={tab === 'TEXTBOOK' ? 'SELECT_TEXTBOOK_FOR_LESSON' : 'ATTACH_DOCUMENT_TO_LESSON'}
      type={tab === 'TEXTBOOK' ? 'TEXTBOOK' : 'DOCUMENT'} singleSelect
      onClose={() => setPicker(false)} onConfirm={(items) => { setSource(items[0] ?? null); setFrom(''); setTo(''); setError(''); }} />}
  </>;
}
