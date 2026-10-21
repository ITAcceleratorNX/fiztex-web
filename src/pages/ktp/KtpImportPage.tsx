import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button, buttonClassName } from '@/components/ui/Button';
import { WorkspacePageHeader } from '@/components/ui/WorkspacePageHeader';
import { ResultCard } from '@/components/ui/ResultCard';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { Field, TextInput } from '@/components/ui/Field';
import { useKtpCommand, useKtpDiagnostics, useKtpImport, useKtpJob } from '@/hooks/queries';
import { ktpApi } from '@/lib/ktpApi';
import { ktpPaths, runningKtp } from '@/lib/ktpModel';
import { KtpAccess, ktpError, SourceButton } from './KtpShared';
import { KtpIssueDetails } from './KtpIssues';
import { KtpUploadModal } from './KtpUploadModal';
import { KtpRemovalDialog } from './KtpRemovalDialog';

export function KtpImportPage() { return <KtpAccess><Import /></KtpAccess>; }
function Import() {
  useDocumentTitle('Загрузка КТП');
  const id = Number(useParams().importId);
  const imported = useKtpImport(id);
  const job = useKtpJob(imported.data?.currentJob?.id);
  const diagnostics = useKtpDiagnostics(imported.data?.status === 'FAILED' ? imported.data.currentJob?.id : undefined);
  const start = useKtpCommand(ktpApi.start);
  const manual = useKtpCommand(ktpApi.manual);
  const [table, setTable] = useState('');
  const [sheet, setSheet] = useState('');
  const [upload, setUpload] = useState(false);
  const [removing, setRemoving] = useState(false);
  const navigate = useNavigate();
  if (!Number.isSafeInteger(id) || id <= 0) return <ErrorBlock message="Не найдено. Возможно, страницу уже удалили." />;
  if (imported.isPending) return <LoadingBlock />;
  if (imported.isError) return <ErrorBlock message={ktpError(imported.error)} onRetry={() => void imported.refetch()} />;
  const item = imported.data;
  if (item.draftId) return <Navigate replace to={ktpPaths.draft(item.draftId)} />;
  const running = runningKtp(item.status);
  async function process() {
    try { await start.mutateAsync({ id, body: { expectedRevision: item.revision!, options: { ...(table ? { tableNumber: Number(table) } : {}), ...(sheet.trim() ? { sheetName: sheet.trim() } : {}) } } }); }
    catch { /* A retry uses the same command key. */ }
  }
  const failed = item.status === 'FAILED';
  const processButton = <Button variant="primary" loading={start.isPending} disabled={manual.isPending || !!table && (!Number.isInteger(Number(table)) || Number(table) < 1)} onClick={() => void process()}>Обработать файл</Button>;
  const manualButton = item.allowedActions?.includes('CREATE_MANUAL_DRAFT') && <Button variant="primary" loading={manual.isPending} disabled={start.isPending} onClick={async () => {
    try { const draft = await manual.mutateAsync({ id, body: { expectedRevision: item.revision! } }); if (draft.id) navigate(ktpPaths.draft(draft.id)); } catch { /* Visible below. */ }
  }}>Создать черновик вручную</Button>;
  const back = <Link className={buttonClassName({ variant: 'secondary' })} to={ktpPaths.list}>К списку КТП</Link>;
  return <div className="planning-page gap-8">
    <WorkspacePageHeader section title="КТП" backTo={ktpPaths.list} backLabel="К списку КТП" actions={<ActionMenu appearance="compact" placement="viewport" label="Действия загрузки КТП" items={[{ label: 'Удалить загрузку', danger: true, onSelect: () => setRemoving(true) }]} />} />
    <ResultCard tone={running ? 'loading' : failed ? 'error' : 'success'} title={running ? 'Распознаём КТП' : failed ? 'Не удалось распознать файл' : 'Файл загружен и сохранён отдельно'}
      description={failed ? <>В файле «{item.source?.originalName}» не удалось распознать таблицу тем.<br />Загрузите .docx или .xlsx с таблицей: № · Раздел · Тема урока · Кол-во часов.</> : item.source?.originalName}
      actions={failed ? <>{manualButton}<Button variant={manualButton ? 'secondary' : 'primary'} disabled={manual.isPending} onClick={() => setUpload(true)}>Загрузить другой файл</Button>{back}</> : <>{!running && item.allowedActions?.includes('START_PROCESSING') && processButton}{back}</>}>
      {running ? <><ul className="mx-auto max-w-sm space-y-3 text-left"><li className="text-planning-success-fg">✓ Файл загружен и сохранён отдельно</li><li className="font-semibold">● Разбираем четверти, разделы и часы…</li></ul><p className="mt-8 text-xs text-planning-muted">Можно закрыть страницу. Обработка продолжится, результат будет доступен в списке КТП.</p>{job.data?.status === 'RETRY_WAIT' && <p className="mt-4 text-amber-700">Обработка будет повторена автоматически.</p>}</>
        : !failed ? <p>Чтобы проверить темы и часы, запустите обработку.</p> : manualButton ? <p>Можно заполнить план самостоятельно. Нажмите «Создать черновик вручную», затем в разделе «Структура плана» добавьте период, раздел и темы с часами. После заполнения сохраните черновик и проверьте замечания.</p> : null}
    </ResultCard>
    {job.isError && <ErrorBlock message={ktpError(job.error)} onRetry={() => void job.refetch()} />}
    {(start.isError || manual.isError) && <ErrorBlock message={ktpError(start.error ?? manual.error)} onRetry={() => void imported.refetch()} />}
    {!running && <details className="rounded-xl border border-planning-line bg-white p-4"><summary className="cursor-pointer text-sm font-medium text-planning-muted">{failed ? 'Подробности и повторная обработка' : 'Выбрать таблицу или лист'}</summary><div className="mt-4 space-y-4">
      {failed && <div className="space-y-2">{diagnostics.data?.pages.flatMap(page => page.items ?? []).map((entry, index) => <StatusNotice key={index} tone={entry.issue?.severity === 'ERROR' ? 'error' : 'warning'}>{entry.issue ? <KtpIssueDetails issue={entry.issue} /> : entry.candidate?.message}</StatusNotice>)}
        {diagnostics.isError && <ErrorBlock message={ktpError(diagnostics.error)} onRetry={() => void diagnostics.refetch()} />}
        {diagnostics.hasNextPage && <Button variant="secondary" loading={diagnostics.isFetchingNextPage} onClick={() => void diagnostics.fetchNextPage()}>Показать ещё</Button>}
      </div>}
      {item.allowedActions?.includes('START_PROCESSING') && <div className="grid gap-4 sm:grid-cols-2"><Field label="Номер таблицы Word"><TextInput type="number" min="1" step="1" value={table} onChange={event => setTable(event.target.value)} /></Field><Field label="Лист Excel"><TextInput value={sheet} onChange={event => setSheet(event.target.value)} /></Field></div>}
      <div className="flex flex-wrap items-center gap-3">{failed && item.allowedActions?.includes('START_PROCESSING') && processButton}
        <SourceButton source={{ importId: id }} name={item.source?.originalName} />
      </div>
    </div></details>}
    {upload && <KtpUploadModal onClose={() => setUpload(false)} />}
    {removing && <KtpRemovalDialog target={{ kind: 'import', id, label: item.source?.originalName ?? 'Загрузка КТП' }} onClose={() => setRemoving(false)} onRemoved={() => navigate(ktpPaths.list)} />}
  </div>;
}
