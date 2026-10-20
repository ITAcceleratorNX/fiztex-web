import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { SearchInput } from '@/components/ui/SearchInput';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useKtpCommand, useKtpProgress, useKtpTeaching, useKtpTeachingHistory } from '@/hooks/queries';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ktpApi, type KtpChange, type KtpTeaching } from '@/lib/ktpApi';
import { ktpPaths } from '@/lib/ktpModel';
import { formatDateTime } from '@/lib/format';
import type { Schema } from '@/lib/apiSchemas';
import { ktpError } from './KtpShared';
import { KtpAdjustmentModal } from './KtpProgressModals';

type Operation = KtpChange['operation'];
export function LessonKtpTopicField({ id, editable, canView, cancelled, fallback }: { id: number; editable: boolean; canView: boolean; cancelled: boolean; fallback: ReactNode }) {
  const { admin } = useAuth();
  const scope = admin?.role === 'TEACHER' ? 'teacher' : 'admin';
  const query = useKtpTeaching(id, canView, scope);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustmentTopicId, setAdjustmentTopicId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useKtpTeachingHistory(id, canView && historyOpen, scope);
  const progress = useKtpProgress(adjusting ? query.data?.bindingId : undefined);
  if (!canView) return <>{fallback}</>;
  if (query.isPending) return <LoadingBlock label="Загрузка темы урока…" />;
  if (query.isError) return <ErrorBlock message={ktpError(query.error)} onRetry={() => void query.refetch()} />;
  const teaching = query.data;
  if (!teaching.bindingId) return <>{fallback}</>;
  const links = teaching.mode === 'OVERRIDE' ? teaching.actual ?? [] : teaching.planned ?? [];
  const modified = teaching.mode === 'OVERRIDE';
  const archived = teaching.bindingState === 'ARCHIVED';
  const canEdit = editable && !cancelled && ['READY', 'AWAITING_INITIAL_SYNC', 'ARCHIVED'].includes(teaching.bindingState ?? '') && admin?.role === 'TEACHER';
  const topic = progress.data?.topics?.find(t => t.topicId === (adjustmentTopicId ?? (links.length === 1 ? links[0]?.topicId : undefined)));
  return <section className="space-y-3" aria-label="Тема урока из КТП">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xs font-bold uppercase tracking-wide text-muted">Тема урока</h2>{canEdit && <ActionMenu appearance="link" placement="viewport" label="Изменить тему" triggerLabel="Изменить тему" items={[
      ...(!archived ? [{ label: 'Заменить тему', description: 'Провести вместо неё другую тему из КТП', onSelect: () => setOperation('REPLACE') },
      { label: 'Добавить ещё одну тему', description: 'Две темы за один урок — час засчитывается один раз', onSelect: () => setOperation('MERGE') },
      { label: 'Продолжить незавершённую тему', description: 'Выбрать тему, которая пройдена не полностью', onSelect: () => setOperation('CONTINUE') },
      { label: 'Отметить тему пройденной', description: 'Меняет только прогресс темы, час не добавляется', disabled: !links[0]?.topicId, onSelect: () => { setAdjustmentTopicId(null); setAdjusting(true); } }] : []),
      { label: 'Указать свободную тему', onSelect: () => setOperation('FREE_TEXT') },
      { label: 'Без темы КТП', onSelect: () => setOperation('NO_KTP') },
    ]} />}</div>
    {modified && teaching.planned?.length ? <div className="rounded-xl bg-neutral-bg p-3"><p className="text-11 font-semibold uppercase text-muted">По КТП</p>{teaching.planned.map((link, i) => <p key={i} className="mt-1 text-13 text-muted">{link.title}</p>)}</div> : null}
    <div className="flex flex-wrap items-center gap-2">{(modified || links.length > 0) && <Badge appearance="label" tone={modified ? 'amber' : 'blue'}>{modified ? 'Фактически · изменено учителем' : 'из КТП'}</Badge>}
      {links.length === 1 && links[0].partNumber != null && <span className="text-xs text-muted">{links[0].partNumber}-й час темы</span>}
    </div>
    {links.length ? links.map((link, i) => <div key={i} className="space-y-2"><p className="text-base font-semibold leading-relaxed text-ink">{link.title}</p>{link.learningObjectives && <p className="text-13 text-muted">Цели обучения: {link.learningObjectives}</p>}</div>) : teaching.actualText ? <p className="whitespace-pre-wrap text-base font-semibold text-ink">{teaching.actualText}</p> : <p className="text-sm text-muted">Тема не указана</p>}
    {admin?.role === 'TEACHER' && <Link className="inline-block text-13 font-semibold text-navy-700 hover:underline" to={`${ktpPaths.binding(teaching.bindingId)}${links[0]?.topicId ? `?topic=${links[0].topicId}` : ''}`}>Открыть в КТП ›</Link>}
    {modified && canEdit && !archived && <Button variant="ghost" size="sm" onClick={() => setOperation('RESTORE_PLAN')}>Вернуть тему по КТП</Button>}
    {cancelled && <StatusNotice tone="warning">Урок отменён — час не засчитан. Темы автоматически не сдвигаются.</StatusNotice>}
    <div><Button variant="ghost" size="sm" aria-expanded={historyOpen} onClick={() => setHistoryOpen(value => !value)}>История темы</Button></div>
    {historyOpen && (history.isPending ? <LoadingBlock /> : history.isError ? <ErrorBlock message={ktpError(history.error)} onRetry={() => void history.refetch()} /> : <div className="rounded-xl border border-line p-4"><ul className="space-y-3 text-13 text-muted">{!history.data?.pages.some(page => page.items?.length) && <li>Изменений пока не было</li>}{history.data?.pages.flatMap(page => page.items ?? []).map(entry => <li key={entry.id}><p className="font-medium text-ink">{historyTitles[entry.action as Operation] ?? 'Изменена тема урока'}</p><p>{entry.reason}</p><p className="mt-1 text-xs">{formatDateTime(entry.createdAt)}</p></li>)}</ul>{history.hasNextPage && <Button variant="ghost" size="sm" loading={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>Показать ещё</Button>}</div>)}
    {operation && <TeachingChangeModal key={operation} id={id} teaching={teaching} operation={operation} onClose={() => setOperation(null)} />}
    {adjusting && <>{progress.isPending ? <Modal open onClose={() => setAdjusting(false)} title="Прогресс темы"><LoadingBlock /></Modal> : progress.isError || !progress.data ? <Modal open onClose={() => setAdjusting(false)} title="Прогресс темы"><ErrorBlock message={ktpError(progress.error)} onRetry={() => void progress.refetch()} /></Modal> : topic ? <KtpAdjustmentModal bindingId={teaching.bindingId} progress={progress.data} topic={topic} onClose={() => setAdjusting(false)} /> : <Modal open onClose={() => setAdjusting(false)} title="Выберите тему текущей версии КТП"><div className="space-y-2">{progress.data.topics?.map(value => <Button key={value.topicId} variant="secondary" className="h-auto w-full justify-start py-3 text-left" onClick={() => setAdjustmentTopicId(value.topicId!)}>{value.title}</Button>)}</div></Modal>}</>}
  </section>;
}
const historyTitles: Record<Operation, string> = { REPLACE: 'Тема заменена', MERGE: 'Добавлена ещё одна тема', CONTINUE: 'Продолжена незавершённая тема', FREE_TEXT: 'Указана свободная тема', NO_KTP: 'Урок без темы КТП', RESTORE_PLAN: 'Возвращена тема по КТП' };
const operationTitles: Record<Operation, string> = { REPLACE: 'Заменить тему урока', MERGE: 'Добавить ещё одну тему', CONTINUE: 'Продолжить незавершённую тему', FREE_TEXT: 'Указать свободную тему', NO_KTP: 'Без темы КТП', RESTORE_PLAN: 'Вернуть тему по КТП' };
function TeachingChangeModal({ id, teaching, operation, onClose }: { id: number; teaching: KtpTeaching; operation: Operation; onClose: () => void }) {
  const selectable = ['REPLACE', 'MERGE', 'CONTINUE'].includes(operation);
  const progress = useKtpProgress(selectable ? teaching.bindingId : undefined);
  const previewCommand = useKtpCommand(ktpApi.teachingPreview, false);
  const change = useKtpCommand(ktpApi.teachingChange);
  const toast = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [units, setUnits] = useState('1');
  const [search, setSearch] = useState('');
  const [freeText, setFreeText] = useState('');
  const [reason, setReason] = useState('');
  const [acceptBaseline, setAcceptBaseline] = useState(false);
  const [review, setReview] = useState<{ body: KtpChange; preview: Schema<'KtpTeachingPreview'> } | null>(null);
  const currentIds = new Set((teaching.mode === 'OVERRIDE' ? teaching.actual : teaching.planned)?.map(t => t.topicId));
  const topics = progress.data?.topics?.filter(t => (operation !== 'CONTINUE' || (t.remainingHours ?? 0) > 0) && (operation !== 'MERGE' || !currentIds.has(t.topicId)) && (!search.trim() || t.title?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))) ?? [];
  const valid = reason.trim().length >= 3 && (!selectable || selected != null && Number(units) > 0 && Number(units) <= 1) && (operation !== 'FREE_TEXT' || !!freeText.trim());
  function resetReview() { setReview(null); previewCommand.reset(); change.reset(); setAcceptBaseline(false); }
  async function preview() {
    const body: KtpChange = { expectedBindingRevision: teaching.bindingRevision, expectedProgressRevision: teaching.progressRevision!, expectedAssignmentRevision: teaching.assignmentRevision!, operation,
      topics: selectable && selected != null ? [{ topicId: selected, units: Number(units) }] : [], ...(operation === 'FREE_TEXT' ? { freeText: freeText.trim() } : {}), reason: reason.trim() };
    try { const result = await previewCommand.mutateAsync({ id, body }); setReview({ body, preview: result }); } catch { /* Visible below. */ }
  }
  async function save() {
    if (!review) return;
    try { await change.mutateAsync({ id, body: { request: review.body, previewFingerprint: review.preview.previewFingerprint, acceptBaselineAdjustment: acceptBaseline } }); toast.success('Изменения сохранены'); onClose(); } catch { /* A changed revision requires reopening the dialog. */ }
  }
  return <Modal open onClose={() => { if (!change.isPending) onClose(); }} title={operationTitles[operation]} size="planning-topic" appearance="planning-wide" scrollable footer={<><Button variant="secondary" disabled={change.isPending} onClick={onClose}>Отмена</Button>{review ? <Button variant="primary" loading={change.isPending} disabled={change.isError || (!!review.preview.baselineChanges?.length && !acceptBaseline)} onClick={() => void save()}>Подтвердить изменение</Button> : <Button variant="primary" disabled={!valid || (selectable && !progress.data)} loading={previewCommand.isPending} onClick={() => void preview()}>Проверить изменение</Button>}</>}><div className="space-y-4">
    {selectable && <>{progress.isPending ? <LoadingBlock /> : progress.isError ? <ErrorBlock message={ktpError(progress.error)} onRetry={() => void progress.refetch()} /> : <>
      <SearchInput value={search} onChange={setSearch} placeholder="Поиск по темам КТП" />
      <div className="max-h-72 overflow-y-auto rounded-xl border border-line">{topics.map(topic => <label key={topic.topicId} className="flex cursor-pointer items-start gap-3 border-b border-line p-4 last:border-b-0 hover:bg-neutral-bg"><input type="radio" name="ktp-topic" checked={selected === topic.topicId} onChange={() => { setSelected(topic.topicId!); resetReview(); }} className="mt-1 size-4 accent-navy-700" /><span className="text-sm"><span className="font-medium">{topic.order}. {topic.title}</span><span className="mt-1 block text-xs text-muted">{topic.coveredHours} из {topic.plannedHours} ч пройдено</span></span></label>)}</div>
      <Field label="Часы этой темы в уроке" required><TextInput type="number" min="0" max="1" step="1" value={units} onChange={e => { setUnits(e.target.value); resetReview(); }} /></Field>
    </>}</>}
    {operation === 'FREE_TEXT' && <Field label="Тема урока" required><TextArea maxLength={20000} value={freeText} rows={4} onChange={e => { setFreeText(e.target.value); resetReview(); }} /></Field>}
    <StatusNotice>{teaching.bindingState === 'ARCHIVED' ? 'КТП удалён из рабочего списка. Свободная тема сохранится отдельно; она не добавляет покрытие тем КТП.' : operation === 'MERGE' ? 'Две темы за один урок — физический урок считается один раз. Покрытие каждой темы проверяется отдельно.' : 'Тема по плану остаётся в КТП. На другие уроки она автоматически не переносится. Продолжить её можно через «Продолжить незавершённую тему».'}</StatusNotice>
    <Field label="Причина изменения" required><TextArea maxLength={1000} rows={2} value={reason} onChange={e => { setReason(e.target.value); resetReview(); }} /></Field>
    {review && <StatusNotice tone="success">Тема после изменения: {review.preview.proposedText || 'Тема не указана'}</StatusNotice>}
    {!!review?.preview.baselineChanges?.length && <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 accent-navy-700" checked={acceptBaseline} onChange={e => setAcceptBaseline(e.target.checked)} />Подтверждаю пересчёт начального прогресса для этого урока, чтобы часы не учитывались дважды</label>}
    {(previewCommand.isError || change.isError) && <StatusNotice tone="error">{ktpError(previewCommand.error ?? change.error)}<p>Закройте окно и повторите действие с актуальными данными.</p></StatusNotice>}
  </div></Modal>;
}
