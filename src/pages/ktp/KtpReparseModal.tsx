import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useKtpCommand, useKtpJob, useKtpParsePreview } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { ktpApi, type KtpContent, type KtpDraft } from '@/lib/ktpApi';
import { ktpCount, ktpHours, ktpRows, runningKtp } from '@/lib/ktpModel';
import { KtpIssues } from './KtpIssues';
import { ktpError } from './KtpShared';

type Props = {
  draft: KtpDraft;
  sourceName?: string;
  onClose: (applied: boolean) => void;
  onRefresh: (applied: boolean) => Promise<void>;
};

export function KtpReparseModal({ draft, sourceName, onClose, onRefresh }: Props) {
  const start = useKtpCommand(ktpApi.reparse, false);
  const apply = useKtpCommand(ktpApi.applyParsePreview);
  const [jobId, setJobId] = useState<number>();
  const job = useKtpJob(jobId);
  const finished = !!job.data?.status && !runningKtp(job.data.status);
  const result = useKtpParsePreview(draft.id!, jobId, finished);
  const [table, setTable] = useState('');
  const [sheet, setSheet] = useState('');
  const [headerRow, setHeaderRow] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [applied, setApplied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<unknown>();
  const busy = start.isPending || apply.isPending || refreshing;
  const running = !!jobId && !finished;
  const invalidTable = !!table && (!Number.isInteger(Number(table)) || Number(table) < 1 || Number(table) > 100);
  const invalidHeader = !!headerRow && (!Number.isInteger(Number(headerRow)) || Number(headerRow) < 1 || Number(headerRow) > 10000);
  const conflict = [start.error, apply.error].some(error => error instanceof ApiError && error.status === 409);
  const preview = result.data;
  const stale = !!preview && (preview.draftId !== draft.id || preview.baseRevision !== draft.revision);
  const ready = !applied && !conflict && !stale && !job.isError && !result.isError && !result.isFetching && job.data?.status === 'SUCCEEDED'
    && preview?.job?.status === 'SUCCEEDED' && !!preview.content && preview.baseRevision != null;

  function close() { if (!busy) onClose(applied); }
  async function refresh(wasApplied: boolean) {
    setRefreshing(true); setRefreshError(undefined);
    try { await onRefresh(wasApplied); }
    catch (error) { setRefreshError(error); }
    finally { setRefreshing(false); }
  }
  async function process() {
    if (busy || running || invalidTable || invalidHeader || conflict || applied) return;
    setAccepted(false);
    try {
      const next = await start.mutateAsync({ id: draft.id!, body: { expectedRevision: draft.revision!, options: {
        ...(table ? { tableNumber: Number(table) } : {}), ...(sheet.trim() ? { sheetName: sheet.trim() } : {}),
        ...(headerRow ? { headerRowNumber: Number(headerRow) } : {}),
      } } });
      setJobId(next.id);
    } catch { /* Existing draft stays intact; retry preserves the command key. */ }
  }
  async function replace() {
    if (!ready || !accepted || busy || !jobId || preview?.baseRevision == null) return;
    try {
      await apply.mutateAsync({ id: draft.id!, jobId, body: { expectedRevision: preview.baseRevision } });
      setApplied(true);
      await refresh(true);
    } catch { /* Show the failure without replacing local content or silently rebasing. */ }
  }
  return <Modal open onClose={close} title="Повторно распознать файл КТП" subtitle={sourceName} size="2xl" appearance="planning" scrollable footer={<>
    <Button variant="secondary" disabled={busy} onClick={close}>{applied ? 'К списку КТП' : 'Оставить черновик без замены'}</Button>
    {applied || conflict || stale ? <Button variant="primary" loading={refreshing} disabled={apply.isPending} onClick={() => void refresh(applied)}>Обновить черновик</Button>
      : ready ? <Button variant="primary" loading={apply.isPending} disabled={!accepted || busy} onClick={() => void replace()}>{apply.isError ? 'Повторить применение' : 'Применить новое распознавание'}</Button>
        : !running && <Button variant="primary" loading={start.isPending} disabled={busy || invalidTable || invalidHeader} onClick={() => void process()}>{jobId ? 'Распознать заново' : 'Начать распознавание'}</Button>}
  </>}><div className="space-y-5">
    <StatusNotice tone="warning">Распознавание подготовит отдельный результат из исходного файла. До применения сохранённый черновик не изменится. При применении новые темы и часы заменят ручные правки, а решения по неразобранным строкам нужно будет проверить заново.</StatusNotice>
    <p className="text-sm text-planning-muted">Можно закрыть окно на любом этапе до применения: черновик останется прежним. Уже начатая обработка файла продолжится, но сама ничего не заменит.</p>
    {!applied && !jobId && <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Номер таблицы Word" hint="Необязательно · от 1 до 100" error={invalidTable ? 'Укажите целое число от 1 до 100' : undefined}><TextInput type="number" min="1" max="100" step="1" disabled={busy} value={table} onChange={event => setTable(event.target.value)} /></Field>
      <Field label="Лист Excel" hint="Необязательно · точное название листа"><TextInput maxLength={100} disabled={busy} value={sheet} onChange={event => setSheet(event.target.value)} /></Field>
      <Field label="Номер строки заголовков" hint="Необязательно · от 1 до 10000" error={invalidHeader ? 'Укажите целое число от 1 до 10000' : undefined}><TextInput type="number" min="1" max="10000" step="1" disabled={busy} value={headerRow} onChange={event => setHeaderRow(event.target.value)} /></Field>
    </div>}
    {start.isError && <StatusNotice tone="error">{ktpError(start.error)}</StatusNotice>}
    {jobId && job.isPending && <LoadingBlock label="Проверяем состояние распознавания…" />}
    {job.isError && <ErrorBlock message={ktpError(job.error)} onRetry={() => void job.refetch()} />}
    {running && job.data && <StatusNotice>{job.data.status === 'RETRY_WAIT' ? 'Обработка будет повторена автоматически. Сохранённый черновик остаётся без изменений.' : 'Распознаём исходный файл. Сохранённый черновик остаётся без изменений.'}</StatusNotice>}
    {finished && result.isPending && <LoadingBlock label="Загружаем результат для сравнения…" />}
    {result.isError && <ErrorBlock message={ktpError(result.error)} onRetry={() => void result.refetch()} />}
    {finished && job.data?.status !== 'SUCCEEDED' && <StatusNotice tone="error">Не удалось повторно распознать файл. Сохранённый черновик не изменён. Проверьте замечания ниже или продолжите ручное заполнение.</StatusNotice>}
    {finished && !applied && !conflict && !stale && <Button variant="secondary" size="sm" disabled={busy} onClick={() => { setJobId(undefined); setAccepted(false); start.reset(); apply.reset(); }}>Изменить параметры распознавания</Button>}
    {(conflict || stale) && <StatusNotice tone="warning">Черновик изменился после начала распознавания. Старый результат применять нельзя. Обновите черновик, проверьте сохранённые изменения и запустите новое распознавание.</StatusNotice>}
    {preview?.content && !applied && <>
      <div className="grid gap-4 lg:grid-cols-2"><Plan title="Сохранённый черновик" content={draft.content} /><Plan title="Новое распознавание" content={preview.content} /></div>
      <section aria-label="Замечания нового распознавания" className="space-y-3"><h3 className="text-base font-bold text-planning-ink">Ошибки и предупреждения нового распознавания</h3>
        {!preview.content.issues?.length && <StatusNotice tone="success">Ошибок и предупреждений распознавания нет. Сверьте содержание с исходным файлом.</StatusNotice>}
        <KtpIssues appearance="review" issues={preview.content.issues ?? []} content={preview.content} />
        {!!preview.content.candidates?.length && <StatusNotice tone="warning"><p>Неразобранные строки · {preview.content.candidates.length}. После применения решите, добавить их как темы или обоснованно исключить.</p><ul className="mt-2 space-y-2">{preview.content.candidates.map((candidate, index) => <li key={candidate.id ?? index} className="break-words">{candidate.message}<p>{candidate.rawCells?.join(' · ')}</p></li>)}</ul></StatusNotice>}
      </section>
      {ready && <Toggle checked={accepted} onChange={setAccepted} disabled={busy} label="Я сравнил(а) результаты и согласен(на) заменить ручные правки" description="Ошибки и предупреждения нового результата нужно будет проверить в черновике перед подтверждением КТП." />}
    </>}
    {finished && result.isSuccess && !preview?.content && <StatusNotice tone="warning">Новый план не получен. Сохранённый черновик не изменён; продолжите ручное заполнение или запустите распознавание заново.</StatusNotice>}
    {apply.isError && <StatusNotice tone="error">{ktpError(apply.error)}</StatusNotice>}
    {applied && <StatusNotice tone="success">Новое распознавание применено. Загружаем обновлённый черновик; повторно применять результат не нужно.</StatusNotice>}
    {refreshError != null && <StatusNotice tone="error">{ktpError(refreshError)}<p>{applied ? 'Результат уже сохранён. Нажмите «Обновить черновик» для продолжения или вернитесь к списку КТП.' : 'Не удалось обновить черновик. Повторите загрузку перед новым распознаванием.'}</p></StatusNotice>}
  </div></Modal>;
}

function Plan({ title, content }: { title: string; content?: KtpContent }) {
  const rows = ktpRows(content);
  return <section aria-label={title} className="min-w-0 space-y-4 rounded-xl border border-planning-line bg-white p-4">
    <h3 className="text-base font-bold text-planning-ink">{title}</h3>
    <p className="text-sm text-planning-muted">{ktpCount(rows.length, ['тема', 'темы', 'тем'])} · {ktpHours(rows.reduce((sum, row) => sum + (row.topic.plannedHours ?? 0), 0))} ч по заполненным темам</p>
    <dl className="space-y-2 break-words text-13 text-planning-muted">{[
      ['Предмет', content?.header?.subject], ['Учебный год', content?.header?.academicYear], ['Классы', content?.header?.classNames?.join(', ')],
      ['Учитель', content?.header?.teacherName], ['Заявлено часов за год', content?.header?.declaredAnnualHours], ['Заявлено часов в неделю', content?.header?.declaredWeeklyHours],
    ].filter(([, value]) => value != null && value !== '').map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>)}</dl>
    {!rows.length && <p className="text-sm text-planning-muted">Тем пока нет.</p>}
    {content?.periods?.map((period, pi) => <div key={pi} className="space-y-3"><h4 className="font-bold text-planning-ink">{period.title || `Период ${pi + 1}`}</h4>
      {period.sections?.map((section, si) => <div key={si} className="space-y-2"><h5 className="text-sm font-semibold text-planning-muted">{section.code} {section.title || `Раздел ${si + 1}`}{section.declaredHours != null && ` · заявлено ${ktpHours(section.declaredHours)} ч`}</h5>
        <ul className="space-y-3">{section.topics?.map((topic, ti) => <li key={ti} className="space-y-1 break-words border-t border-planning-row-line pt-2 text-13">
          <p className="font-semibold text-planning-ink">{topic.sourceNumber ?? topic.order}. {topic.title || 'Тема не указана'}</p><p>{topic.plannedHours == null ? 'Часы не указаны' : `${ktpHours(topic.plannedHours)} ч`}</p>
          {([['Цели обучения', topic.learningObjectives], ['Плановые сроки', topic.plannedDates], ['Примечания', topic.notes], ['Рекомендации', topic.recommendations]] as const).map(([label, value]) => value && <p key={label}><strong>{label}:</strong> {value}</p>)}
        </li>)}</ul>
      </div>)}
    </div>)}
  </section>;
}
