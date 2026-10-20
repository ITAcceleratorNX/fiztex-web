import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { LoadingBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useKtpActivation, useKtpCommand, useKtpContext } from '@/hooks/queries';
import { ktpApi, type KtpDraft } from '@/lib/ktpApi';
import { ktpPaths } from '@/lib/ktpModel';
import type { Schema } from '@/lib/apiSchemas';
import { ktpError } from './KtpShared';
import { KtpIssues } from './KtpIssues';

export function KtpActivationModal({ draft, onClose, refreshTargets }: { draft: KtpDraft; onClose: () => void; refreshTargets: (targets: Schema<'KtpTargetExpectation'>[]) => Promise<void> }) {
  const context = useKtpContext();
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const query = useKtpActivation(draft.id!, true);
  const confirm = useKtpCommand(ktpApi.confirm);
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [mapping, setMapping] = useState<Record<number, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const preview = query.data;
  const errors = preview?.issues?.filter(i => i.severity === 'ERROR') ?? [];
  const codes = preview?.warningCodes ?? [];
  const conflict = preview?.targets?.some(t => t.conflict);
  const replacing = preview?.targets?.some(t => t.currentVersionId != null);
  const periods = (draft.content?.periods ?? []).map(p => ({ planPeriodOrder: p.order!, academicPeriodId: mapping[p.order!] ?? preview?.suggestedPeriodMapping?.find(m => m.planPeriodOrder === p.order)?.academicPeriodId }));
  const missing = periods.some(p => !p.academicPeriodId) || new Set(periods.map(p => p.academicPeriodId)).size !== periods.length;
  async function save() {
    if (!preview || missing) return;
    try {
      const result = await confirm.mutateAsync({ id: draft.id!, body: { expectedRevision: preview.revision!, periodMapping: periods as Schema<'KtpPeriodMapping'>[], targets: preview.targets?.map(t => t.expected!) ?? [], confirmedWarningCodes: codes } });
      if (result.bindingIds?.[0]) navigate(`${ktpPaths.binding(result.bindingIds[0])}?confirmed=1`, { replace: true });
    } catch { /* The user must refresh a stale preview explicitly. */ }
  }
  return <Modal open onClose={() => { if (!confirm.isPending && !refreshing) onClose(); }} title={replacing ? 'Подтвердить новую версию КТП?' : 'Подтвердить КТП?'} size={replacing ? 'planning-confirm' : 'planning'} appearance="planning" scrollable footer={<>
    <Button variant="ghost" disabled={confirm.isPending || refreshing} onClick={onClose}>{replacing ? 'Оставить текущую версию' : 'Отмена'}</Button><Button variant="primary" disabled={!preview || !context.data || !!conflict || !!errors.length || missing || (codes.length > 0 && !accepted) || query.isFetching || confirm.isError} loading={confirm.isPending} onClick={() => void save()}>Подтвердить КТП</Button>
  </>}>
    {query.isPending || context.isPending ? <LoadingBlock /> : query.isError || context.isError ? <ErrorBlock message={ktpError(query.error ?? context.error)} onRetry={() => { void query.refetch(); void context.refetch(); }} /> : <div className="space-y-4">
      <p className="text-sm leading-relaxed text-planning-muted">{replacing ? 'Предыдущая версия останется в истории. После подтверждения сверьте перенос прогресса каждого класса; проведённые уроки и ручные изменения сохранятся.' : 'Темы подставятся в уроки расписания. Если учебный год уже идёт, проверьте прогресс каждого класса.'}</p>
      <p className="text-sm font-semibold">{preview?.totals?.topicCount} тем · {preview?.totals?.knownAnnualHours} ч</p>
      {preview?.targets?.map(target => <div key={target.expected?.classId} className="flex justify-between gap-3 rounded-xl border border-line p-3 text-13"><span>{context.data?.assignments?.find(a => a.classId === target.expected?.classId)?.className}</span><span>{target.previousTotals?.knownAnnualHours ?? 0} → {preview.totals?.knownAnnualHours} ч · изменение тем: {target.topicCountDelta ?? 0}</span></div>)}
      {conflict && <StatusNotice tone="warning">Привязки классов изменились. Проверьте текущие версии перед подтверждением.<Button variant="secondary" size="sm" loading={refreshing} onClick={async () => {
        setRefreshing(true);
        try { await refreshTargets(preview?.targets?.map(t => ({ classId: t.expected?.classId!, bindingRevision: t.currentRevision!, ...(t.currentVersionId != null ? { baseVersionId: t.currentVersionId } : {}) })) ?? []); await query.refetch(); confirm.reset(); setRefreshError(null); } catch (error) { setRefreshError(error); } finally { setRefreshing(false); }
      }}>Обновить привязки</Button></StatusNotice>}
      <details open={missing} className="rounded-xl border border-planning-line p-3"><summary className="cursor-pointer text-sm font-semibold">Учебный календарь{missing ? ' · выберите периоды' : ' · периоды сопоставлены'}</summary><div className="mt-3 space-y-3">
        {draft.content?.periods?.map(period => <Field key={period.order} label={period.title ?? ''} required><Select value={periods.find(p => p.planPeriodOrder === period.order)?.academicPeriodId ?? ''} onChange={e => setMapping(old => ({ ...old, [period.order!]: Number(e.target.value) }))}><option value="">Выберите период</option>{preview?.availablePeriods?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>)}
      </div></details>
      <KtpIssues issues={preview?.issues ?? []} content={draft.content} />
      {codes.length > 0 && <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1 size-4 accent-navy-700" />Я проверил(а) предупреждения и принимаю указанные расхождения</label>}
      {!!refreshError && <StatusNotice tone="error">{ktpError(refreshError)}</StatusNotice>}
      {confirm.isError && <ErrorBlock message={ktpError(confirm.error)} onRetry={() => { confirm.reset(); setAccepted(false); void query.refetch(); }} />}
    </div>}
  </Modal>;
}
