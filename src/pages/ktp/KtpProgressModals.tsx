import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { ContextSummaryCard } from '@/components/ui/ContextSummaryCard';
import { Badge } from '@/components/ui/Badge';
import { StickyActionBar } from '@/components/ui/StickyActionBar';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { DataTable, TableHead, TableCell, TableGroupRow, TableSectionRow } from '@/components/ui/DataTable';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useKtpCommand, useKtpInitialPreview, useKtpTransition } from '@/hooks/queries';
import { ktpApi, type KtpContent, type KtpProgress } from '@/lib/ktpApi';
import type { Schema } from '@/lib/apiSchemas';
import { ktpError } from './KtpShared';
import { ktpCount, ktpHours, ktpRows } from '@/lib/ktpModel';
import { formatDateTime } from '@/lib/format';

export function KtpAdjustmentModal({ bindingId, progress, topic, onClose }: { bindingId: number; progress: KtpProgress; topic: Schema<'KtpTopicProgress'>; onClose: () => void }) {
  const change = useKtpCommand(ktpApi.adjustment);
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<Schema<'KtpTopicAdjustmentRequest'>['action']>('COMPLETE');
  const [coverage, setCoverage] = useState('0');
  async function save() {
    try { await change.mutateAsync({ id: bindingId, topicId: topic.topicId!, body: { action, reason: reason.trim(), expectedBindingRevision: progress.bindingRevision!, expectedProgressRevision: progress.progressRevision!, ...(action === 'ADJUST_COVERAGE' ? { coverageAdjustment: Number(coverage) } : {}) } }); onClose(); } catch { /* Visible below. */ }
  }
  return <Modal open onClose={() => { if (!change.isPending) onClose(); }} title="Прогресс темы" subtitle={topic.title} appearance="planning" size="planning" scrollable footer={<><Button variant="secondary" disabled={change.isPending} onClick={onClose}>Отмена</Button><Button variant="navy" disabled={reason.trim().length < 3 || (action === 'ADJUST_COVERAGE' && !Number.isFinite(Number(coverage)))} loading={change.isPending} onClick={() => void save()}>Сохранить изменения</Button></>}><div className="space-y-4">
    <StatusNotice>По урокам пройдено {topic.linkedCoverage ?? 0} из {topic.plannedHours} ч. Отметка меняет только прогресс темы, проведённый час не добавляется.</StatusNotice>
    <Field label="Действие"><Select value={action} onChange={e => setAction(e.target.value as typeof action)}><option value="COMPLETE">Отметить тему пройденной</option><option value="REOPEN">Вернуть в работу</option><option value="RESET">Снять ручные изменения прогресса</option><option value="ADJUST_COVERAGE">Скорректировать покрытие</option></Select></Field>
    {action === 'ADJUST_COVERAGE' && <Field label="Поправка часов" hint="Отдельная поправка к проведённым часам и начальному прогрессу"><TextInput type="number" step="1" value={coverage} onChange={e => setCoverage(e.target.value)} /></Field>}
    <Field label="Причина" required><TextArea value={reason} rows={3} minLength={3} maxLength={1000} onChange={e => setReason(e.target.value)} /></Field>
    {change.isError && <StatusNotice tone="error">{ktpError(change.error)}</StatusNotice>}
  </div></Modal>;
}
type InitialContext = { content?: KtpContent; distribution?: Schema<'KtpDistribution'>; classLabel?: string };
export function KtpInitialSyncModal({ id, onClose, presentation = 'modal', content, distribution, classLabel }: { id: number; onClose: () => void; presentation?: 'modal' | 'page' } & InitialContext) {
  const query = useKtpInitialPreview(id, true);
  const [busy, setBusy] = useState(false);
  const body = query.isPending || query.isFetching ? <LoadingBlock /> : query.isError ? <ErrorBlock message={ktpError(query.error)} onRetry={() => void query.refetch()} /> : <InitialForm key={`${id}-${query.data.cutoff}`} id={id} preview={query.data} content={content} distribution={distribution} classLabel={classLabel} page={presentation === 'page'} onClose={onClose} onBusy={setBusy} reload={() => void query.refetch()} />;
  return presentation === 'page' ? body : <Modal open onClose={() => { if (!busy) onClose(); }} title="Проверка прогресса по темам КТП" size="xl" appearance="planning" scrollable>{body}</Modal>;
}
function InitialForm({ id, preview, content, distribution, classLabel, page, onClose, onBusy, reload }: { onBusy: (busy: boolean) => void; id: number; preview: Schema<'KtpInitialSyncPreview'>; page: boolean; onClose: () => void; reload: () => void } & InitialContext) {
  const [values, setValues] = useState<Record<number, string>>(Object.fromEntries((preview.topics ?? []).map(topic => [topic.topicId!, String(preview.suggestedBaselines?.find(b => b.topicId === topic.topicId)?.additionalHours ?? 0)])));
  const [accepted, setAccepted] = useState(false);
  const [editingTopic, setEditingTopic] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const sync = useKtpCommand(ktpApi.initialSync);
  const topics = preview.topics ?? [];
  const invalid = topics.some(t => !/^\d+(\.\d{1,4})?$/.test(values[t.topicId!] ?? '') || Number(values[t.topicId!]) + (t.linkedCoverage ?? 0) > (t.plannedHours ?? 0));
  const planRows = ktpRows(content);
  const mapped = topics.map(topic => ({ topic, row: planRows.find(row => row.topic.order === topic.order) }));
  const periodKeys = [...new Set(mapped.map(item => item.row?.pi ?? -1))];
  const firstUnfinished = mapped.find(item => Number(values[item.topic.topicId!]) + (item.topic.linkedCoverage ?? 0) < (item.topic.plannedHours ?? 0))?.row?.pi ?? periodKeys[0];
  const nextLesson = distribution?.assignments?.filter(value => value.lessonStatus === 'ACTIVE' && value.startsAt && Date.parse(value.startsAt) > Date.now()).sort((left, right) => Date.parse(left.startsAt!) - Date.parse(right.startsAt!))[0];
  async function save() {
    onBusy(true);
    try { await sync.mutateAsync({ id, body: { cutoff: preview.cutoff!, historyFingerprint: preview.historyFingerprint!, expectedBindingRevision: preview.bindingRevision!, expectedProgressRevision: preview.progressRevision!, baselines: topics.map(t => ({ topicId: t.topicId, additionalHours: Number(values[t.topicId!]) })) } }); onClose(); } catch { /* Visible below. */ } finally { onBusy(false); }
  }
  const accept = <label className="flex items-start gap-3 text-13 text-planning-muted"><input type="checkbox" className="mt-0.5 size-4 accent-navy-700" checked={accepted} onChange={e => setAccepted(e.target.checked)} />Я проверил(а) прогресс этого класса</label>;
  const actions = <><Button variant="secondary" disabled={sync.isPending} onClick={onClose}>Назад</Button><Button variant="primary" loading={sync.isPending} disabled={invalid || !accepted || !!preview.unresolvedSubgroupLessonCount || sync.isError} onClick={() => void save()}>Подтвердить прогресс КТП</Button></>;
  return <div className="space-y-5">
    <ContextSummaryCard marker={classLabel ?? 'КТП'} eyebrow={nextLesson ? `Следующий урок · ${formatDateTime(nextLesson.startsAt)}` : 'Прогресс класса'} title={nextLesson ? <Link className="hover:text-navy-700" to={`/lesson-schedule/lessons/${nextLesson.lessonId}`}>{nextLesson.topicTitle}</Link> : 'Проверьте прогресс по темам КТП'}>
      <p>{nextLesson ? 'Тема назначена уроку по действующему КТП.' : 'Ближайший урок с темой КТП пока не назначен.'} Проведено уроков: {preview.physicalLessonCount}.</p>
    </ContextSummaryCard>
    {!!preview.unresolvedSubgroupLessonCount && <StatusNotice tone="warning">Есть уроки подгрупп ({preview.unresolvedSubgroupLessonCount}). Согласуйте их распределение перед подтверждением прогресса.</StatusNotice>}
    <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-planning-ink">Прогресс по темам</p><Button variant="ghost" size="text" onClick={() => setExpanded(Object.fromEntries(periodKeys.map(key => [key, true])))}>Развернуть все четверти</Button></div>
    <DataTable appearance="planning" label="Начальный прогресс"><colgroup><col className="w-16" /><col className="w-5/12" /><col className="w-20" /><col className="w-56" /><col className="w-44" /></colgroup>
      <thead><tr>{['№', 'Тема урока', 'Часы', 'Уроки в расписании', 'Прогресс темы'].map(label => <TableHead key={label}>{label}</TableHead>)}</tr></thead>
      {periodKeys.map(pi => {
        const periodTopics = mapped.filter(item => (item.row?.pi ?? -1) === pi), period = content?.periods?.[pi];
        const opened = expanded[pi] ?? pi === firstUnfinished;
        const complete = periodTopics.filter(item => Number(values[item.topic.topicId!]) + (item.topic.linkedCoverage ?? 0) >= (item.topic.plannedHours ?? 0)).length;
        return <tbody key={pi}><TableGroupRow columns={5} expanded={opened} summary={complete === periodTopics.length ? <Badge appearance="label" tone="green">Все {periodTopics.length} пройдены</Badge> : `Пройдено ${complete} из ${periodTopics.length}`} onToggle={() => setExpanded(old => ({ ...old, [pi]: !opened }))}>{period?.title ?? 'Темы КТП'}<span className="ml-3 text-xs font-normal text-planning-subtle">{ktpCount(periodTopics.length, ['тема', 'темы', 'тем'])} · {ktpHours(periodTopics.reduce((sum, item) => sum + (item.topic.plannedHours ?? 0), 0))} ч</span></TableGroupRow>
          {opened && periodTopics.map(({ topic, row }, index) => {
            const previous = periodTopics[index - 1];
            const additional = values[topic.topicId!] ?? '0', covered = Number(additional) + (topic.linkedCoverage ?? 0), remaining = Math.max(0, (topic.plannedHours ?? 0) - (topic.linkedCoverage ?? 0));
            const status = covered >= (topic.plannedHours ?? 0) ? 'completed' : covered > 0 || editingTopic === topic.topicId ? 'partial' : 'none';
            return <Fragment key={topic.topicId}>
              {row && (!previous?.row || previous.row.si !== row.si) && <TableSectionRow columns={5}>{row.section.code} {row.section.title}</TableSectionRow>}
              <tr><TableCell className="text-planning-subtle">{row?.topic.sourceNumber ?? topic.order}</TableCell><TableCell><p className="line-clamp-2" title={topic.title}>{topic.title}</p></TableCell><TableCell className="font-bold">{topic.plannedHours}</TableCell><TableCell className="text-xs text-planning-muted"><div className="space-y-1">{distribution?.assignments?.filter(value => value.topicId === topic.topicId).map((value, index) => <Link key={`${value.lessonId}-${index}`} className={value.lessonStatus === 'CANCELLED' ? 'block text-red-500' : 'block text-navy-700 hover:underline'} to={`/lesson-schedule/lessons/${value.lessonId}`}>{formatDateTime(value.startsAt)}{value.lessonStatus === 'CANCELLED' ? ' · отменён' : ' ›'}</Link>)}<p>{topic.linkedCoverage ? `По урокам: ${ktpHours(topic.linkedCoverage)} ч` : '—'}</p></div></TableCell><TableCell>
                <Select variant="status" tone={status === 'completed' ? 'success' : status === 'partial' ? 'warning' : 'neutral'} aria-label={`Прогресс: ${topic.title}`} value={status} onChange={event => {
                  if (event.target.value === 'partial') setEditingTopic(topic.topicId!);
                  else { setValues(old => ({ ...old, [topic.topicId!]: String(event.target.value === 'completed' ? remaining : 0) })); setEditingTopic(null); }
                }}><option value="none" disabled={(topic.linkedCoverage ?? 0) > 0}>Не пройдена</option><option value="partial">Частично</option><option value="completed">Пройдена</option></Select>
                <p className="mt-1 text-xs text-planning-subtle">{ktpHours(covered)} из {topic.plannedHours} ч</p>
                {editingTopic === topic.topicId && <div className="mt-2"><Field label="Дополнительно пройдено"><TextInput aria-label={`Дополнительно пройдено: ${topic.title}`} type="number" min="0" max={remaining} step="1" value={additional} onChange={event => setValues(old => ({ ...old, [topic.topicId!]: event.target.value }))} /></Field><Button variant="ghost" size="text" onClick={() => setEditingTopic(null)}>Готово</Button></div>}
              </TableCell></tr>
            </Fragment>;
          })}
        </tbody>;
      })}
    </DataTable>
    <p className="text-xs text-planning-subtle">Отметки меняют только прогресс тем. Дополнительные часы не связаны с уроками КТП; проведённые уроки считаются отдельно. План КТП не меняется.</p>
    {sync.isError && <ErrorBlock message={ktpError(sync.error)} onRetry={reload} />}
    {page ? <StickyActionBar message={accept}>{actions}</StickyActionBar> : <>{accept}<div className="flex justify-end gap-3">{actions}</div></>}
  </div>;
}
export function KtpVersionSyncModal({ id, onClose }: { id: number; onClose: () => void }) {
  const query = useKtpTransition(id, true);
  const [busy, setBusy] = useState(false);
  return <Modal open onClose={() => { if (!busy) onClose(); }} title="Сверка новой версии КТП" size="xl" appearance="planning" scrollable>
    {query.isPending || query.isFetching ? <LoadingBlock /> : query.isError ? <ErrorBlock message={ktpError(query.error)} onRetry={() => void query.refetch()} /> : <VersionForm key={query.data.historyFingerprint} id={id} transition={query.data} onClose={onClose} onBusy={setBusy} reload={() => void query.refetch()} />}
  </Modal>;
}
function VersionForm({ id, transition: t, onClose, onBusy, reload }: { onBusy: (busy: boolean) => void; id: number; transition: Schema<'KtpVersionTransition'>; onClose: () => void; reload: () => void }) {
  const [matches, setMatches] = useState<Record<number, string>>(Object.fromEntries((t.previousTopics ?? []).map(old => [old.id!, String(t.suggestedCorrespondences?.find(e => e.fromTopicId === old.id)?.toTopicId ?? '')])));
  const [statuses, setStatuses] = useState<Record<number, string>>(Object.fromEntries((t.currentTopics ?? []).map(current => [current.id!, t.previousTopics?.find(old => t.suggestedCorrespondences?.some(e => e.fromTopicId === old.id && e.toTopicId === current.id) && old.manualStatus && old.manualStatus !== 'NONE')?.manualStatus ?? 'NONE'])));
  const [reason, setReason] = useState('');
  const [overage, setOverage] = useState(false);
  const preview = useKtpCommand(ktpApi.versionPreview, false);
  const confirm = useKtpCommand(ktpApi.versionSync);
  const [review, setReview] = useState<{ request: Schema<'KtpVersionSyncRequest'>; preview: Schema<'KtpVersionSyncPreview'> } | null>(null);
  const missing = (t.previousTopics ?? []).some(old => !matches[old.id!]);
  function edited() { setReview(null); setOverage(false); preview.reset(); confirm.reset(); }
  async function calculate() {
    const request: Schema<'KtpVersionSyncRequest'> = { expectedBindingRevision: t.bindingRevision!, expectedProgressRevision: t.progressRevision!, fromVersionId: t.fromVersionId!, toVersionId: t.toVersionId!, historyFingerprint: t.historyFingerprint!, cutoff: t.cutoff!,
      correspondences: (t.previousTopics ?? []).filter(old => matches[old.id!] !== 'discard').map(old => ({ fromTopicId: old.id!, toTopicId: Number(matches[old.id!]), share: 1 })),
      discardedOldTopicIds: (t.previousTopics ?? []).filter(old => matches[old.id!] === 'discard').map(old => old.id!),
      targetStatuses: (t.currentTopics ?? []).map(current => ({ topicId: current.id!, status: statuses[current.id!] as 'NONE' | 'FORCE_COMPLETED' | 'FORCE_IN_PROGRESS' })),
    };
    try { const result = await preview.mutateAsync({ id, body: request }); setReview({ request, preview: result }); } catch { /* Visible below. */ }
  }
  async function save() {
    if (!review) return;
    onBusy(true);
    try { await confirm.mutateAsync({ id, body: { request: review.request, previewFingerprint: review.preview.previewFingerprint!, acceptOverage: overage, reason: reason.trim() } }); onClose(); } catch { /* Visible below. */ } finally { onBusy(false); }
  }
  return <div className="space-y-5"><StatusNotice>Сопоставьте каждую тему предыдущей версии. Проведённые уроки и ручные решения сохранятся. Прогресс переносится только после вашего подтверждения.</StatusNotice>
    <DataTable appearance="planning" label="Соответствие тем версий"><thead><tr><TableHead>Предыдущая версия</TableHead><TableHead>Прогресс</TableHead><TableHead>Тема новой версии</TableHead></tr></thead><tbody>{t.previousTopics?.map(old => <tr key={old.id}><TableCell>{old.sourceNumber} {old.title}</TableCell><TableCell>{(old.linkedCoverage ?? 0) + (old.baseline ?? 0) + (old.adjustment ?? 0)} / {old.plannedHours} ч</TableCell><TableCell><Select aria-label={`Соответствие: ${old.title}`} value={matches[old.id!] ?? ''} onChange={e => { setMatches(previous => ({ ...previous, [old.id!]: e.target.value })); edited(); }}><option value="">Выберите соответствие</option><option value="discard">Не переносить прогресс этой темы</option>{t.currentTopics?.map(current => <option key={current.id} value={current.id}>{`${current.sourceNumber ?? ''} ${current.title ?? ''}`.trim()}</option>)}</Select></TableCell></tr>)}</tbody></DataTable>
    <details className="rounded-xl border border-line p-4"><summary className="cursor-pointer text-sm font-semibold">Ручные отметки тем новой версии</summary><div className="mt-4 space-y-3">{t.currentTopics?.map(current => <Field key={current.id} label={current.title ?? ''}><Select value={statuses[current.id!] ?? 'NONE'} onChange={e => { setStatuses(previous => ({ ...previous, [current.id!]: e.target.value })); edited(); }}><option value="NONE">По пройденным часам</option><option value="FORCE_COMPLETED">Пройдена вручную</option><option value="FORCE_IN_PROGRESS">В работе вручную</option></Select></Field>)}</div></details>
    <Button variant="secondary" disabled={missing} loading={preview.isPending} onClick={() => void calculate()}>Проверить перенос прогресса</Button>
    {review && <><StatusNotice tone="success">Сохранится уроков: {review.preview.preservedLessonIds?.length ?? 0}. Будет перераспределено будущих уроков: {review.preview.replaceableFutureLessonIds?.length ?? 0}.</StatusNotice>
      <DataTable appearance="planning" label="Предпросмотр переноса прогресса"><thead><tr><TableHead>Тема новой версии</TableHead><TableHead>Перенос часов</TableHead><TableHead>По плану</TableHead></tr></thead><tbody>{review.preview.coverage?.map(c => <tr key={c.topicId}><TableCell>{t.currentTopics?.find(topic => topic.id === c.topicId)?.title}</TableCell><TableCell>{c.total}</TableCell><TableCell>{c.planned}{!!c.overage && <p className="text-red-600">Превышение: {c.overage} ч</p>}</TableCell></tr>)}</tbody></DataTable>
      {review.preview.hasOverage && <label className="flex gap-3 text-sm"><input className="size-4 accent-navy-700" type="checkbox" checked={overage} onChange={e => setOverage(e.target.checked)} />Я принимаю превышение часов в новой версии</label>}</>}
    <Field label="Причина переноса" required><TextArea maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></Field>
    {(preview.isError || confirm.isError) && <ErrorBlock message={ktpError(preview.error ?? confirm.error)} onRetry={reload} />}
    <div className="flex justify-end gap-3"><Button variant="secondary" disabled={confirm.isPending} onClick={onClose}>Назад</Button><Button variant="navy" loading={confirm.isPending} disabled={!review || reason.trim().length < 3 || (!!review?.preview.hasOverage && !overage) || confirm.isError} onClick={() => void save()}>Подтвердить перенос</Button></div>
  </div>;
}
