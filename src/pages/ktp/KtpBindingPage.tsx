import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { WorkspacePageHeader } from '@/components/ui/WorkspacePageHeader';
import { ResultCard } from '@/components/ui/ResultCard';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { FileTypeBadge } from '@/components/ui/FileTypeBadge';
import { Select } from '@/components/ui/Field';
import { DataTable, TableHead, TableCell, TableGroupRow, TableSectionRow } from '@/components/ui/DataTable';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useKtpBinding, useKtpBindings, useKtpCommand, useKtpContext, useKtpDistribution, useKtpHistory, useKtpImport, useKtpProgress, useKtpVersion } from '@/hooks/queries';
import { ktpApi, type KtpRemovalTarget } from '@/lib/ktpApi';
import { allocationMessages, bindingStateLabel, ktpCount, ktpHours, ktpPaths, ktpRows, ktpWorkLabels, topicStatusLabel } from '@/lib/ktpModel';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDateTime } from '@/lib/format';
import type { Schema } from '@/lib/apiSchemas';
import { KtpAccess, ktpError, SourceButton } from './KtpShared';
import { KtpUploadModal } from './KtpUploadModal';
import { KtpAdjustmentModal, KtpInitialSyncModal, KtpVersionSyncModal } from './KtpProgressModals';
import { KtpRemovalDialog } from './KtpRemovalDialog';
import { KtpVersionsDialog } from './KtpVersionsDialog';
import { KtpHistoricalLinkModal } from './KtpHistoricalLinkModal';

export function KtpBindingPage() { return <KtpAccess><Binding /></KtpAccess>; }
function Binding() {
  const id = Number(useParams().bindingId);
  useDocumentTitle('КТП');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const binding = useKtpBinding(id > 0 ? id : undefined);
  const context = useKtpContext();
  const bindings = useKtpBindings();
  const progress = useKtpProgress(id > 0 ? id : undefined);
  const distribution = useKtpDistribution(id > 0 ? id : undefined);
  const history = useKtpHistory(id);
  const reconcile = useKtpCommand(ktpApi.reconcile);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedVersion = Number(params.get('version')) || undefined;
  const versionId = requestedVersion ?? binding.data?.versionId;
  const version = useKtpVersion(id > 0 ? id : undefined, versionId);
  const imported = useKtpImport(version.data?.sourceImportId ?? 0);
  const [upload, setUpload] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [removing, setRemoving] = useState<KtpRemovalTarget | null>(null);
  const [sync, setSync] = useState<'version' | null>(null);
  const [topic, setTopic] = useState<Schema<'KtpTopicProgress'> | null>(null);
  const [historicalLink, setHistoricalLink] = useState(false);
  const highlightedId = params.get('topic');
  useEffect(() => {
    if (highlightedId && progress.data && version.data) {
      document.getElementById(`topic-${highlightedId}`)?.scrollIntoView?.({ block: 'center' });
    }
  }, [highlightedId, progress.data, version.data]);
  if (!Number.isSafeInteger(id) || id <= 0) return <ErrorBlock message="Не найдено. Возможно, страницу уже удалили." />;
  if (binding.isPending || context.isPending || progress.isPending || version.isPending) return <LoadingBlock />;
  const error = binding.error ?? context.error ?? progress.error ?? version.error;
  if (error || !binding.data || !progress.data) return <ErrorBlock message={ktpError(error)} onRetry={() => { void binding.refetch(); void context.refetch(); void progress.refetch(); void version.refetch(); }} />;
  const b = binding.data;
  const p = progress.data;
  const oldVersion = versionId !== b.versionId;
  const assignments = context.data?.assignments ?? [];
  const assignment = assignments.find(a => a.academicYearId === b.academicYearId && a.classId === b.classId && a.subjectId === b.subjectId);
  const related = [b, ...(bindings.data?.pages.flatMap(page => page.items ?? []).filter(value => value.id !== b.id && value.academicYearId === b.academicYearId && value.subjectId === b.subjectId) ?? [])].sort((left, right) => (assignments.find(a => a.classId === left.classId)?.className ?? '').localeCompare(assignments.find(a => a.classId === right.classId)?.className ?? '', 'ru', { numeric: true }));
  const rows = ktpRows(version.data?.content ?? b.content);
  const completed = p.topics?.filter(t => t.status === 'COMPLETED').length ?? 0;
  const selectedPeriod = params.get('period') ?? '';
  const allowed = b.state === 'READY';
  const archived = b.state === 'ARCHIVED';
  const needsVersionSync = b.state === 'AWAITING_VERSION_SYNC';
  const content = version.data?.content ?? b.content;
  const firstPendingPeriod = content?.periods?.find(period => ktpRows({ periods: [period] }).some(row => p.topics?.find(t => t.order === row.topic.order)?.status !== 'COMPLETED'))?.order ?? content?.periods?.[0]?.order;
  const highlightedOrder = p.topics?.find(value => String(value.topicId) === highlightedId)?.order;
  const highlightedPeriod = rows.find(row => row.topic.order === highlightedOrder)?.period.order;
  const versionEntry = history.data?.pages.flatMap(page => page.items ?? []).find(item => item.versionId === versionId);
  const versionNumber = versionEntry?.versionNumber ?? versionEntry?.bindingRevision;
  const versionOptions = history.data?.pages.flatMap(page => page.items ?? []) ?? [];
  const sourceName = imported.data?.source?.originalName;
  const sourceMeta = sourceName ? <><FileTypeBadge format={sourceName.split('.').at(-1)} variant="inline" /><SourceButton appearance="filename" source={{ bindingId: id, versionId: versionId! }} name={sourceName} /></> : null;
  function selectVersion(value: string) {
    setTopic(null); setHistoricalLink(false); setExpanded({}); setAllExpanded(false);
    setParams(old => { const next = new URLSearchParams(old); if (Number(value) === b.versionId) next.delete('version'); else next.set('version', value); next.delete('period'); return next; });
  }
  function clearConfirmation() { setParams(old => { const next = new URLSearchParams(old); next.delete('confirmed'); return next; }, { replace: true }); }
  function openInitial() { setParams(old => { const next = new URLSearchParams(old); next.delete('confirmed'); next.set('progress', 'initial'); return next; }); }
  function closeInitial() { setParams(old => { const next = new URLSearchParams(old); next.delete('progress'); return next; }, { replace: true }); }
  if (!archived && params.get('progress') === 'initial') return <div className="planning-page gap-5"><WorkspacePageHeader title="Проверка прогресса по темам КТП" backTo={ktpPaths.list} backLabel="К списку КТП" meta={<><strong className="text-planning-ink">{assignment?.subject}</strong><span>{assignment?.academicYear?.replace('/', '–')} · {assignment?.className}</span>{sourceMeta}<Badge appearance="label" tone={allowed ? 'green' : 'amber'}>{bindingStateLabel(b.state)}</Badge></>} actions={<SourceButton source={{ bindingId: id, versionId: versionId! }} name={sourceName} />} />
    <SegmentedTabs appearance="planning" ariaLabel="Классы" value={String(id)} options={related.map(value => ({ value: String(value.id), label: `${assignments.find(a => a.classId === value.classId && a.subjectId === value.subjectId && a.academicYearId === value.academicYearId)?.className ?? ''} класс` }))} onChange={value => { setExpanded({}); navigate(`${ktpPaths.binding(Number(value))}?progress=initial`); }} />
    <KtpInitialSyncModal key={id} id={id} content={content} distribution={distribution.data} classLabel={assignment?.className} presentation="page" onClose={closeInitial} />
  </div>;
  if (!archived && params.get('confirmed')) return <div className="planning-page gap-8"><WorkspacePageHeader section title="КТП" backTo={ktpPaths.list} backLabel="К списку КТП" />
    <ResultCard tone="success" title="КТП подтверждён и активен" description={`${assignment?.subject ?? ''} · ${assignment?.className ?? ''} · ${assignment?.academicYear?.replace('/', '–') ?? ''} · ${ktpCount(b.totals?.topicCount ?? 0, ['тема', 'темы', 'тем'])}, ${b.totals?.knownAnnualHours ?? 0} ч`}
      actions={b.state === 'READY' ? <><Link className={buttonClassName({ variant: 'secondary' })} to={ktpPaths.list}>К списку КТП</Link><Button variant="primary" onClick={clearConfirmation}>Открыть КТП</Button></> : <Button variant="primary" onClick={() => { if (needsVersionSync) { clearConfirmation(); setSync('version'); } else openInitial(); }}>Проверить прогресс КТП</Button>}>
      <p>{b.state === 'READY' ? 'Темы подставятся в уроки расписания по порядку, начиная с темы № 1. Проведённых уроков пока нет — проверять прогресс не нужно.' : needsVersionSync ? 'Новая версия подтверждена. Сверьте перенос прогресса каждого класса. Проведённые уроки и ручные изменения сохранятся.' : 'Учебный год уже идёт — проверьте, с какой темы продолжать. Система предложит прогресс по проведённым урокам из расписания, вы подтвердите или поправите. У каждого класса прогресс свой.'}</p>
    </ResultCard>
  </div>;
  return <div className="planning-page gap-5"><WorkspacePageHeader title={`${assignment?.subject ?? b.content?.header?.subject ?? ''} · КТП`} backTo={ktpPaths.list} backLabel="К списку КТП"
    meta={<><span>{assignment?.academicYear?.replace('/', '–')} · {related.map(value => assignments.find(a => a.classId === value.classId && a.subjectId === value.subjectId && a.academicYearId === value.academicYearId)?.className).join(', ') || assignment?.className}</span>{sourceMeta}{versionOptions.length > 1 ? <Select variant="status" aria-label="История версий" value={versionId} onChange={event => selectVersion(event.target.value)}>{versionOptions.map(item => <option key={item.id} value={item.versionId}>{`Версия ${item.versionNumber ?? item.bindingRevision}${item.versionId === b.versionId ? ' · текущая' : ''}`}</option>)}</Select> : versionNumber != null && <span>Версия {versionNumber}</span>}<Badge appearance="label" tone={archived ? 'gray' : allowed ? 'green' : 'amber'}>{oldVersion ? 'Предыдущая версия' : bindingStateLabel(b.state)}</Badge></>}
    actions={<><SourceButton source={{ bindingId: id, versionId: versionId! }} name={sourceName} /><Button variant="secondary" size="sm" disabled={b.state === 'AWAITING_VERSION_SYNC'} onClick={() => setUpload(true)}>Загрузить новую версию</Button><ActionMenu appearance="compact" placement="viewport" label="Действия КТП" items={[
      { label: 'Управление версиями', onSelect: () => setVersionsOpen(true) },
      { label: 'Удалить КТП класса', danger: true, disabled: archived, onSelect: () => setRemoving({ kind: 'plan', targets: [{ bindingId: id, expectedRevision: b.revision! }], label: `${assignment?.subject ?? 'КТП'} · ${assignment?.className ?? ''} · ${assignment?.academicYear?.replace('/', '–') ?? ''}` }) },
    ]} /></>} />
    <div className="flex flex-wrap items-center gap-3"><SegmentedTabs appearance="planning" ariaLabel="Классы" value={String(id)} options={related.map(value => ({ value: String(value.id), label: `${assignments.find(a => a.classId === value.classId && a.subjectId === value.subjectId && a.academicYearId === value.academicYearId)?.className ?? ''} класс` }))} onChange={value => { setTopic(null); setSync(null); setExpanded({}); setAllExpanded(false); navigate(ktpPaths.binding(Number(value))); }} />
      <div className="contents"><Select className="w-auto" aria-label="Период" value={selectedPeriod} onChange={event => setParams(old => { const next = new URLSearchParams(old); if (event.target.value) next.set('period', event.target.value); else next.delete('period'); return next; })}><option value="">Период: Весь год</option>{content?.periods?.map(period => <option key={period.order} value={period.order}>{period.title}</option>)}</Select>
        <Button variant="ghost" size="text" className="ml-auto" onClick={() => { const next = !allExpanded; setAllExpanded(next); setExpanded(Object.fromEntries((content?.periods ?? []).map(period => [period.order!, next]))); }}>{allExpanded ? 'Свернуть все четверти' : 'Развернуть все четверти'}</Button>
      </div>
    </div>
    {bindings.hasNextPage && <Button variant="ghost" size="sm" loading={bindings.isFetchingNextPage} onClick={() => void bindings.fetchNextPage()}>Показать ещё классы</Button>}
    {archived && <StatusNotice>КТП удалён из рабочего списка. Автоматическое назначение тем остановлено; проведённые уроки, ручные изменения и история сохранены. Можно загрузить новую версию.</StatusNotice>}
    {!archived && !oldVersion && b.state !== 'READY' && <StatusNotice tone="warning">{b.state === 'AWAITING_VERSION_SYNC' ? 'Новая версия подтверждена. Сверьте перенос прогресса этого класса.' : 'Учебный год уже идёт — проверьте, с какой темы продолжать. У каждого класса прогресс свой.'}<div className="mt-3"><Button variant="primary" size="sm" onClick={() => { if (needsVersionSync) setSync('version'); else openInitial(); }}>{b.state === 'AWAITING_VERSION_SYNC' ? 'Сверить версии' : 'Проверить прогресс'}</Button></div></StatusNotice>}
    {distribution.isError && <ErrorBlock message={ktpError(distribution.error)} onRetry={() => void distribution.refetch()} />}
    {distribution.data?.executionEnabled === false && <StatusNotice tone="warning">Автоматическое распределение тем пока недоступно. КТП сохранён; темы появятся в расписании после включения распределения.</StatusNotice>}
    {!!distribution.data?.diagnostics?.includes('SUBGROUP_POLICY_REQUIRED') && <StatusNotice tone="warning">В расписании есть уроки подгрупп. Для них требуется согласовать правила распределения КТП.</StatusNotice>}
    {(distribution.data?.diagnostics ?? []).filter(code => allocationMessages[code] && code !== 'PARTIAL_SCHEDULE_HORIZON').map(code => <StatusNotice key={code} tone="warning">{allocationMessages[code]}</StatusNotice>)}
    {oldVersion && <StatusNotice>Показана предыдущая версия. Прогресс класса относится к текущей версии.</StatusNotice>}

    {history.isError && <ErrorBlock message={ktpError(history.error)} onRetry={() => void history.refetch()} />}
    {reconcile.isError && <StatusNotice tone="error">{ktpError(reconcile.error)}</StatusNotice>}
    {!oldVersion && <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-3 text-13">
      <p className="text-planning-subtle">План <strong className="text-planning-ink">{b.totals?.knownAnnualHours} ч</strong> · {b.totals?.topicCount} тем</p>
      <p className="text-planning-subtle">Проведено <strong className="text-planning-ink">{ktpCount(p.physicalLessonCount ?? 0, ['урок', 'урока', 'уроков'])}</strong></p>
      <p className="text-muted">{needsVersionSync ? 'Сверьте новую версию' : <>Пройдено <strong className="text-ink">{completed} из {p.topics?.length} тем</strong></>}</p>{!needsVersionSync && <ProgressBar tone="navy" value={completed} max={p.topics?.length ?? 0} label="Пройденные темы" className="w-32" />}
    </section>}
    {!oldVersion && ['READY', 'AWAITING_INITIAL_SYNC'].includes(b.state ?? '') && <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" size="sm" onClick={() => setHistoricalLink(true)}>Связать проведённый урок</Button>
      <p className="text-xs text-muted">Укажите фактические темы уже состоявшегося занятия, сохранив его историю.</p>
    </div>}
    <DataTable appearance="planning" label="Темы и прогресс КТП"><colgroup><col className="w-16" /><col className="w-4/12" /><col className="w-2/12" /><col className="w-16" /><col className="w-40" /><col className="w-40" /></colgroup><thead><tr>{['№', 'Тема урока', 'Цели обучения', 'Часы', 'Уроки в расписании', 'Прогресс темы'].map(label => <TableHead key={label}>{label}</TableHead>)}</tr></thead>
    {content?.periods?.filter(period => !selectedPeriod || String(period.order) === selectedPeriod).map(period => {
      const opened = expanded[period.order!] ?? (period.order === firstPendingPeriod || period.order === highlightedPeriod || !!selectedPeriod);
      return <tbody key={period.order}><TableGroupRow columns={6} expanded={opened} onToggle={() => setExpanded(previous => ({ ...previous, [period.order!]: !opened }))}>{period.title}<span className="ml-3 text-xs font-normal text-planning-subtle">{ktpCount(rows.filter(row => row.period.order === period.order).length, ['тема', 'темы', 'тем'])} · {ktpHours(rows.filter(row => row.period.order === period.order).reduce((sum, row) => sum + (row.topic.plannedHours ?? 0), 0))} ч</span></TableGroupRow>
        {opened && period.sections?.map(section => <Fragment key={section.order}><TableSectionRow columns={6}>{section.code} {section.title}</TableSectionRow>{section.topics?.map(value => {
        const current = !oldVersion ? p.topics?.find(t => t.order === value.order) : undefined;
        const links = current ? distribution.data?.assignments?.filter(a => a.topicId === current.topicId) ?? [] : [];
        const unassigned = current && distribution.data?.unassigned?.find(t => t.topicId === current.topicId);
        return <tr key={value.order} id={`topic-${current?.topicId ?? value.order}`} className={String(current?.topicId) === params.get('topic') ? 'bg-info-bg' : ''}><TableCell>{value.sourceNumber ?? value.order}</TableCell><TableCell><div className="mb-1 flex flex-wrap gap-1">{ktpWorkLabels(value.title).map(label => <Badge key={label} appearance="label" tone="gray">{label}</Badge>)}</div><p className="line-clamp-2" title={value.title}>{value.title}</p><p className="mt-1 text-xs text-planning-subtle">{value.plannedDates}</p></TableCell><TableCell><p className="line-clamp-3 text-xs text-planning-muted" title={value.learningObjectives}>{value.learningObjectives || 'Не указаны'}</p></TableCell><TableCell>{value.plannedHours}</TableCell><TableCell className="min-w-40"><div className="space-y-2">{links.map((a, index) => <Link key={`${a.lessonId}-${index}`} to={`/lesson-schedule/lessons/${a.lessonId}`} className="block text-xs text-navy-700 hover:underline">{formatDateTime(a.startsAt)} · {a.lessonStatus === 'CANCELLED' ? 'отменён' : a.lessonStatus === 'SUPERSEDED' ? 'перенесён' : 'открыть урок'} ›</Link>)}{unassigned && <p className="text-xs text-amber-700">Пока не распределено: {unassigned.hours} ч</p>}{!links.length && !unassigned && <span className="text-muted">—</span>}</div></TableCell><TableCell className="min-w-40">{current ? <div className="space-y-2"><Button variant={current.status === 'COMPLETED' ? 'success-soft' : current.status === 'IN_PROGRESS' ? 'warning-soft' : 'neutral-soft'} size="badge" disabled={!allowed} aria-label={`Изменить прогресс: ${current.title}`} onClick={() => setTopic(current)} endIcon={<ChevronDown className="size-3" />}>{needsVersionSync ? 'Сверьте новую версию' : topicStatusLabel(current.status)}</Button>{!needsVersionSync && <p className="text-xs text-muted">{current.coveredHours} из {current.plannedHours} ч пройдено</p>}{current.manualStatus && current.manualStatus !== 'NONE' && <p className="text-xs text-muted">Отмечено вручную</p>}</div> : <span className="text-muted">—</span>}</TableCell></tr>;
      })}</Fragment>)}
      </tbody>;
    })}</DataTable>
    {distribution.data?.diagnostics?.includes('PARTIAL_SCHEDULE_HORIZON') && <p className="text-xs text-planning-muted">{allocationMessages.PARTIAL_SCHEDULE_HORIZON}</p>}
    <details className="text-xs text-planning-muted"><summary className="cursor-pointer">История версий и распределение</summary><div className="mt-3 flex flex-wrap items-end gap-4">
      {history.hasNextPage && <Button variant="secondary" loading={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>Ранние версии</Button>}
      {!oldVersion && allowed && <Button variant="secondary" icon={<RefreshCw className="size-4" />} disabled={distribution.data?.executionEnabled === false} loading={reconcile.isPending} onClick={async () => { try { await reconcile.mutateAsync({ id, body: { expectedRevision: b.revision! } }); await distribution.refetch(); } catch { /* Visible below. */ } }}>Обновить распределение</Button>}
    </div></details>
    {!oldVersion && allowed && <div><Button variant="secondary" size="sm" onClick={openInitial}>Проверить начальный прогресс</Button></div>}
    {upload && <KtpUploadModal initial={{ academicYearId: b.academicYearId!, subjectId: b.subjectId!, classIds: archived ? [b.classId!] : related.filter(value => value.versionId === b.versionId).map(value => value.classId!) }} onClose={() => setUpload(false)} />}
    {sync === 'version' && <KtpVersionSyncModal id={id} onClose={() => setSync(null)} />}
    {topic && <KtpAdjustmentModal bindingId={id} progress={p} topic={topic} onClose={() => setTopic(null)} />}
    {historicalLink && !oldVersion && ['READY', 'AWAITING_INITIAL_SYNC'].includes(b.state ?? '') && <KtpHistoricalLinkModal key={id}
      bindingId={id} classLabel={assignment?.className} subjectLabel={assignment?.subject} yearLabel={assignment?.academicYear}
      onClose={() => setHistoricalLink(false)} />}
    {versionsOpen && <KtpVersionsDialog bindingId={id} currentVersionId={b.versionId!} classLabel={assignment?.className} onClose={() => setVersionsOpen(false)} onView={value => { selectVersion(String(value)); setVersionsOpen(false); }} onRemoved={value => { if (versionId === value) selectVersion(String(b.versionId)); }} />}
    {removing && <KtpRemovalDialog target={removing} onClose={() => setRemoving(null)} onRemoved={() => navigate(ktpPaths.list)} />}
  </div>;
}
