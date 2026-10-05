import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { WorkspaceMaterialPickerModal } from '@/components/workspace/WorkspaceMaterialPickerModal';
import { AiJobProgress } from '@/components/ui/AiJobProgress';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { MathText } from '@/components/ui/MathText';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { usePreparationAiSource, useStartTestAiGeneration, useTestAiOverview } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { validatePages } from '@/lib/summaryPages';
import type { TestAiJob, TestAiRequest } from '@/lib/testTemplateApi';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';
import { QUESTION_TYPE_LABELS } from '@/pages/homework/homeworkQuestionsModel';

const sources = [
  { value: 'TOPIC', label: 'По теме' },
  { value: 'TEXTBOOK', label: 'По учебнику' },
  { value: 'DOCUMENT', label: 'По документу' },
] as const;
type SourceTab = (typeof sources)[number]['value'];

export function GenerateWorkspaceTestModal({ initialTopic, onClose, onUse }: {
  initialTopic: string;
  onClose: () => void;
  onUse: (job: TestAiJob) => void;
}) {
  const [tab, setTab] = useState<SourceTab>('TOPIC');
  const [topic, setTopic] = useState(initialTopic);
  const [audience, setAudience] = useState('');
  const [source, setSource] = useState<WorkspaceSearchItem | null>(null);
  const [picker, setPicker] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [count, setCount] = useState('10');
  const [openCount, setOpenCount] = useState('2');
  const [language, setLanguage] = useState('ru');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const attempt = useRef<{ body: string; key: string }>();
  const overview = useTestAiOverview();
  const start = useStartTestAiGeneration();
  const sourceType = tab === 'TEXTBOOK' ? 'TEXTBOOK' : 'DOCUMENT';
  const metadata = usePreparationAiSource(sourceType, source?.id ?? null);
  const job = overview.data?.latestJob;
  const running = job?.status === 'PENDING' || job?.status === 'RUNNING';
  const busy = start.isPending || running;
  const questionCount = Number(count);
  const openQuestionCount = Number(openCount);
  const countError = !count || !Number.isInteger(questionCount) || questionCount < 1 || questionCount > 30
    ? 'Укажите от 1 до 30 вопросов.' : '';
  const openCountError = !openCount || !Number.isInteger(openQuestionCount) || openQuestionCount < 0 || openQuestionCount > questionCount
    ? 'Укажите число от 0 до общего количества вопросов.' : '';
  const pageError = source && metadata.data?.pageNavigation
    ? validatePages(from, to, metadata.data.pageCount ?? 0, metadata.data.maxPages ?? 30) : '';
  const ready = !busy && !overview.isPending && !overview.isError && overview.data?.aiEnabled
    && (overview.data.remainingCalls ?? 0) > 0 && topic.trim() && !countError && !openCountError
    && (tab === 'TOPIC' || (source?.id != null && metadata.data && !metadata.isError && !pageError));
  const result = job?.status === 'DONE' ? job.result?.questions : null;

  function changeSource(next: SourceTab) {
    setTab(next);
    setSource(null);
    setFrom('');
    setTo('');
    setError('');
  }

  async function generate() {
    if (!ready) return;
    const body: TestAiRequest = {
      topic: topic.trim(), audience: audience.trim(), language, teacherPrompt: prompt.trim(),
      questionCount, openQuestionCount,
      ...(tab !== 'TOPIC' && source?.id != null ? { sourceType, workspaceItemId: source.id,
        ...(metadata.data?.pageNavigation && from ? { pageFrom: Number(from), pageTo: Number(to || from) } : {}),
      } : {}),
    };
    const serialized = JSON.stringify(body);
    if (attempt.current?.body !== serialized) attempt.current = { body: serialized, key: crypto.randomUUID() };
    setError('');
    try {
      await start.mutateAsync({ body, key: attempt.current.key });
      // A confirmed request may be followed by a new generation with identical settings.
      // An uncertain network response keeps the same key for a safe retry.
      attempt.current = undefined;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось начать генерацию. Повторите попытку.');
      void overview.refetch();
    }
  }

  return <>
    <Modal open onClose={() => { if (!start.isPending) onClose(); }} title="Сгенерировать тест с ИИ" size="lg"
      subtitle="Укажите тему и настройки. Готовые вопросы можно проверить и изменить перед сохранением теста."
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={start.isPending}>Закрыть</Button>
        <Button icon={<Sparkles className="size-4" />} onClick={() => void generate()} loading={start.isPending} disabled={!ready}>
          {result?.length ? 'Сгенерировать заново' : 'Сгенерировать'}
        </Button>
      </>}>
      <div className="space-y-5">
        {overview.isPending && <LoadingBlock label="Проверяем доступность генерации…" />}
        {overview.isError && <ErrorBlock message="Не удалось загрузить данные" onRetry={() => void overview.refetch()} />}
        {overview.data && <>
          {!overview.data.aiEnabled && <NoticeBar tone="warning">Генерация сейчас отключена. Вопросы можно добавить вручную.</NoticeBar>}
          {overview.data.aiEnabled && (overview.data.remainingCalls ?? 0) <= 0 && <NoticeBar tone="warning">Лимит генерации на сегодня исчерпан. Вопросы можно добавить вручную или вернуться завтра.</NoticeBar>}
          <fieldset disabled={busy || !overview.data.aiEnabled} className="min-w-0 space-y-5">
            <Field label="Тема теста" required>
              <TextInput value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={300}
                placeholder="Например, Законы Ньютона" />
            </Field>
            <Field label="Для кого" hint="Поможет подобрать сложность вопросов.">
              <TextInput value={audience} onChange={(event) => setAudience(event.target.value)} maxLength={120}
                placeholder="Например, физика, 7 класс" />
            </Field>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-ink">На чём основывать вопросы</p>
              <SegmentedTabs value={tab} options={sources} onChange={changeSource} ariaLabel="Источник для теста" className="flex-wrap" />
              {tab !== 'TOPIC' && <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" size="sm" onClick={() => setPicker(true)}>
                    {source ? 'Заменить источник' : 'Выбрать из рабочего пространства'}
                  </Button>
                  {source && <p className="min-w-0 break-words text-sm text-ink">{source.title}</p>}
                </div>
                {source && metadata.isPending && <LoadingBlock label="Проверяем источник…" />}
                {metadata.isError && <ErrorBlock message={metadata.error.message} onRetry={() => void metadata.refetch()} />}
                {source && metadata.data?.pageNavigation && <Field label="Страницы PDF" error={pageError}
                  hint={`Всего ${metadata.data.pageCount} стр. За один раз — до ${metadata.data.maxPages}. Укажите номера страниц в файле.`}>
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput type="number" min={1} max={metadata.data.pageCount} aria-label="Со страницы" placeholder="С" value={from} onChange={(event) => setFrom(event.target.value)} />
                    <TextInput type="number" min={1} max={metadata.data.pageCount} aria-label="По страницу" placeholder="По" value={to} onChange={(event) => setTo(event.target.value)} />
                  </div>
                </Field>}
              </div>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Всего вопросов" required error={countError}>
                <TextInput type="number" min={1} max={30} step={1} value={count} onChange={(event) => {
                  setCount(event.target.value);
                  const next = Number(event.target.value);
                  if (next > 0 && openQuestionCount > next) setOpenCount(String(next));
                }} />
              </Field>
              <Field label="Из них с развёрнутым ответом" error={openCountError} hint="Остальные — с выбором ответа.">
                <TextInput type="number" min={0} max={questionCount || 30} step={1} value={openCount} onChange={(event) => setOpenCount(event.target.value)} />
              </Field>
            </div>
            <Field label="Язык вопросов"><Select value={language} disabled={busy || !overview.data.aiEnabled} onChange={(event) => setLanguage(event.target.value)}>
              <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option>
            </Select></Field>
            <Field label="Пожелания к вопросам" hint="Необязательно. Например, больше практических задач, без сложных вычислений.">
              <TextArea rows={3} maxLength={2000} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </Field>
          </fieldset>
          <p className="text-13 text-muted">Осталось вызовов ИИ сегодня: {overview.data.remainingCalls ?? 0}. Распознавание сканов также расходует лимит.</p>
          {job && <div aria-live="polite"><AiJobProgress job={job} /></div>}
          {result && result.length > 0 && <section className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div>
              <h3 className="font-semibold text-ink">Готовые вопросы: {result.length}</h3>
              <p className="mt-1 break-words text-sm text-muted">{job?.request?.topic}{job?.sourceName && job.sourceName !== job.request?.topic ? ` · ${job.sourceName}` : ''}</p>
            </div>
            <ol className="max-h-80 space-y-4 overflow-y-auto pr-2">
              {result.map((question, index) => <li key={index} className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
                <p className="text-13 text-muted">Вопрос {index + 1} · {question.type ? QUESTION_TYPE_LABELS[question.type] : ''}</p>
                <MathText text={question.text ?? ''} />
                {question.options?.map((option, optionIndex) => <div key={optionIndex} className="flex items-start gap-2 text-sm">
                  <span className="text-muted">{optionIndex + 1}.</span><MathText text={option.text ?? ''} />
                  {option.correct && <span className="shrink-0 text-success-fg">Верный</span>}
                </div>)}
                {question.referenceAnswer && <div className="text-sm text-muted"><span className="font-medium">Эталонный ответ: </span><MathText text={question.referenceAnswer} /></div>}
              </li>)}
            </ol>
            <Button onClick={() => { if (job?.id != null) { onUse(job); onClose(); } }} disabled={job?.id == null}>Использовать вопросы</Button>
          </section>}
        </>}
        {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
      </div>
    </Modal>
    {picker && <WorkspaceMaterialPickerModal usage={tab === 'TEXTBOOK' ? 'SELECT_TEXTBOOK_FOR_LESSON' : 'ATTACH_DOCUMENT_TO_LESSON'}
      type={tab === 'TEXTBOOK' ? 'TEXTBOOK' : 'DOCUMENT'} singleSelect onClose={() => setPicker(false)}
      onConfirm={(items) => { setSource(items[0] ?? null); setFrom(''); setTo(''); setError(''); }} />}
  </>;
}
