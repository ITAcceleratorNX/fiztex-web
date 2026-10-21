import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Fragment, useState, type SetStateAction } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GripVertical, Pencil, Plus } from 'lucide-react';
import { WorkspacePageHeader } from '@/components/ui/WorkspacePageHeader';
import { StickyActionBar } from '@/components/ui/StickyActionBar';
import { FileTypeBadge } from '@/components/ui/FileTypeBadge';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { DataTable, TableHead, TableCell, TableGroupRow, TableSectionRow } from '@/components/ui/DataTable';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useKtpBindings, useKtpCommand, useKtpDraft, useKtpContext, useKtpImport } from '@/hooks/queries';
import { useFormDraft } from '@/context/FormDraftContext';
import { ktpApi, type KtpContent, type KtpDraft, type KtpTopic } from '@/lib/ktpApi';
import { ktpCount, ktpHours, ktpPaths, ktpRows, ktpWorkLabels, updateKtpTopic, issueMatchesTopic } from '@/lib/ktpModel';
import { isOptionalKtpIssue, ktpIssueTopic } from '@/lib/ktpIssues';
import type { Schema } from '@/lib/apiSchemas';
import { KtpAccess, ktpError, SourceButton } from './KtpShared';
import { KtpTopicEditor, type KtpEditableField } from './KtpTopicEditor';
import { KtpActivationModal } from './KtpActivationModal';
import { KtpIssues } from './KtpIssues';
import { KtpRemovalDialog } from './KtpRemovalDialog';
import { KtpReparseModal } from './KtpReparseModal';

export function KtpDraftPage() { return <KtpAccess><DraftLoader /></KtpAccess>; }
function DraftLoader() {
  useDocumentTitle('Проверка КТП');
  const id = Number(useParams().draftId);
  const query = useKtpDraft(id);
  if (!Number.isSafeInteger(id) || id <= 0) return <ErrorBlock message="Не найдено. Возможно, страницу уже удалили." />;
  if (query.isPending) return <LoadingBlock />;
  if (!query.data) return <ErrorBlock message={ktpError(query.error)} onRetry={() => void query.refetch()} />;
  return <DraftEditor key={id} initial={query.data} reload={async () => {
    const result = await query.refetch({ throwOnError: true });
    if (!result.data) throw new Error('Черновик не загружен');
    return result.data;
  }} />;
}
type EditorDraft = { saved: KtpDraft; content: KtpContent; decisions: Schema<'KtpCandidateDecision'>[]; sourceDecisions: Schema<'KtpSourceDecision'>[] };
function isDirtyDraft(value: EditorDraft) {
  return JSON.stringify(value.content) !== JSON.stringify(value.saved.content) || JSON.stringify(value.decisions) !== JSON.stringify(value.saved.candidateDecisions ?? []) || JSON.stringify(value.sourceDecisions) !== JSON.stringify(value.saved.sourceDecisions ?? []);
}
function DraftEditor({ initial, reload }: { initial: KtpDraft; reload: () => Promise<KtpDraft> }) {
  const { draft: form, setDraft: setForm, clear } = useFormDraft<EditorDraft>(`ktp-editor-${initial.id}`, () => ({ saved: initial, content: initial.content ?? { periods: [], issues: [], candidates: [] }, decisions: initial.candidateDecisions ?? [], sourceDecisions: initial.sourceDecisions ?? [] }), isDirtyDraft);
  const navigate = useNavigate();
  const [removing, setRemoving] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string>();
  const [structureOpen, setStructureOpen] = useState(() => !ktpRows(initial.content).length);
  const { saved, content, decisions, sourceDecisions } = form;
  function setSaved(saved: KtpDraft) { setForm(old => ({ ...old, saved })); }
  function setContent(next: SetStateAction<KtpContent>) { setSaveNotice(undefined); setForm(old => ({ ...old, content: typeof next === 'function' ? next(old.content) : next })); }
  function setDecisions(next: SetStateAction<EditorDraft['decisions']>) { setSaveNotice(undefined); setForm(old => ({ ...old, decisions: typeof next === 'function' ? next(old.decisions) : next })); }
  function setSourceDecisions(next: SetStateAction<EditorDraft['sourceDecisions']>) { setSaveNotice(undefined); setForm(old => ({ ...old, sourceDecisions: typeof next === 'function' ? next(old.sourceDecisions) : next })); }
  const [editing, setEditing] = useState<{ pi: number; si: number; ti: number; topic: KtpTopic; field?: KtpEditableField } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [attention, setAttention] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [dragging, setDragging] = useState<{ pi: number; si: number; ti: number } | null>(null);
  const save = useKtpCommand(ktpApi.save);
  const context = useKtpContext();
  const imported = useKtpImport(saved.importId!);
  const targetAssignments = context.data?.assignments?.filter(a => a.academicYearId === imported.data?.academicYearId && a.subjectId === imported.data?.subjectId && saved.classIds?.includes(a.classId!)) ?? [];
  const bindings = useKtpBindings(saved.status === 'CONFIRMED');
  const dirty = isDirtyDraft(form);
  const editable = saved.status === 'DRAFT';
  const rows = ktpRows(content);
  const errors = (saved.content?.issues ?? []).filter(i => i.severity === 'ERROR');
  const warnings = (saved.content?.issues ?? []).filter(i => i.severity === 'WARNING' && !isOptionalKtpIssue(i));
  const attentionIssues = [...errors, ...warnings];
  const attentionRows = rows.filter(row => attentionIssues.some(issue => issueMatchesTopic(issue, row.topic)));
  function openEditor(row: NonNullable<typeof editing>) {
    setSaveNotice(undefined);
    setExpanded(old => ({ ...old, [row.pi]: true })); setAttention(false); setEditing(row);
  }
  async function persist(targets?: Schema<'KtpTargetExpectation'>[]) {
    let order = 0;
    const newOrders = new Map<number, number>();
    const normalized = { ...content, periods: content.periods?.map((p, pi) => ({ ...p, order: pi + 1, sections: p.sections?.map((s, si) => ({ ...s, order: si + 1, topics: s.topics?.map(t => { newOrders.set(t.order!, ++order); return { ...t, order }; }) ?? [] })) ?? [] })) ?? [] };
    const result = await save.mutateAsync({ id: saved.id!, body: { expectedRevision: saved.revision!, content: normalized, classIds: saved.classIds ?? [], candidateDecisions: decisions.filter(d => d.topicOrder != null || !!d.ignoreReason?.trim()).map(d => d.topicOrder == null ? d : { ...d, topicOrder: newOrders.get(d.topicOrder) }), sourceDecisions: sourceDecisions.filter(d => d.reason?.trim()), targetExpectations: targets ?? [] } });
    setSaved(result); setContent(result.content!); setDecisions(result.candidateDecisions ?? []); setSourceDecisions(result.sourceDecisions ?? []);
    setSaveNotice('Черновик сохранён. Проверьте ошибки и предупреждения перед подтверждением КТП.');
  }
  async function refreshAfterReparse(applied: boolean) {
    const latest = await reload();
    setForm({ saved: latest, content: latest.content ?? { periods: [], issues: [], candidates: [] }, decisions: latest.candidateDecisions ?? [], sourceDecisions: latest.sourceDecisions ?? [] });
    setStructureOpen(!ktpRows(latest.content).length); setExpanded({}); setAttention(false);
    setSaveNotice(applied ? 'Новое распознавание применено. Проверьте темы, часы и замечания перед подтверждением КТП.' : undefined);
    setReparsing(false);
  }
  function sectionTopics(pi: number, si: number, transform: (topics: KtpTopic[]) => KtpTopic[]) {
    setContent(old => ({ ...old, periods: old.periods?.map((p, pIndex) => pIndex !== pi ? p : { ...p, sections: p.sections?.map((s, sIndex) => sIndex !== si ? s : { ...s, topics: transform(s.topics ?? []) }) }) }));
  }
  const activeBinding = bindings.data?.pages.flatMap(p => p.items ?? []).find(b => b.versionId === saved.id);
  function topicEditor() {
    return editing && <KtpTopicEditor inline key={`${editing.pi}-${editing.si}-${editing.ti}-${editing.field ?? ''}`} initialField={editing.field} topic={editing.topic} onClose={() => setEditing(null)} onSave={topic => {
      if (editing.ti >= (content.periods?.[editing.pi]?.sections?.[editing.si]?.topics?.length ?? 0)) sectionTopics(editing.pi, editing.si, topics => [...topics, topic]);
      else setContent(old => updateKtpTopic(old, editing.pi, editing.si, editing.ti, topic)); setEditing(null);
    }} onDelete={editing.ti < (content.periods?.[editing.pi]?.sections?.[editing.si]?.topics?.length ?? 0) ? () => setDeleting(true) : undefined} />;
  }
  function moveTopic(pi: number, si: number, from: number, to: number) {
    sectionTopics(pi, si, topics => { if (to < 0 || to >= topics.length) return topics; const next = [...topics]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
  }
  return <div className="planning-page"><WorkspacePageHeader title="Проверка КТП" backTo={ktpPaths.list} backLabel="К списку КТП" actions={editable && <ActionMenu appearance="compact" placement="viewport" label="Действия черновика КТП" items={[{ label: 'Повторно распознать файл', disabled: dirty || !!editing || save.isPending, onSelect: () => setReparsing(true) }, { label: 'Удалить загрузку и черновик', danger: true, disabled: save.isPending, onSelect: () => setRemoving(true) }]} />}
    meta={<><strong className="text-planning-ink">{targetAssignments[0]?.subject ?? content.header?.subject}</strong><span>{targetAssignments.map(a => a.className).join(', ')}</span><span>{targetAssignments[0]?.academicYear?.replace('/', '–')}</span><FileTypeBadge format={imported.data?.source?.originalName?.split('.').at(-1)} variant="inline" /><SourceButton appearance="filename" source={{ importId: saved.importId! }} name={imported.data?.source?.originalName} /></>}
    status={<Badge appearance="label" tone={editable ? 'gray' : 'green'}>{editable ? dirty ? 'Есть несохранённые изменения' : `Черновик · сохранён${saved.updatedAt ? ` ${new Date(saved.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}` : 'Подтверждён'}</Badge>} />
    {(context.isError || imported.isError) && <ErrorBlock message={ktpError(context.error ?? imported.error)} onRetry={() => { void context.refetch(); void imported.refetch(); }} />}
    {!editable && <StatusNotice tone="success">КТП подтверждён. {activeBinding && <Link className="font-semibold underline" to={ktpPaths.binding(activeBinding.id!)}>Открыть КТП</Link>}</StatusNotice>}
    {save.isError && <StatusNotice tone="error">{ktpError(save.error)}<p>Скопируйте несохранённые правки перед обновлением страницы.</p></StatusNotice>}
    <div className="mt-2 grid gap-3.5 sm:grid-cols-3">{[
      { title: 'Распознано', value: ktpCount(rows.length, ['тема', 'темы', 'тем']), hint: `${ktpCount(content.periods?.length ?? 0, ['период', 'периода', 'периодов'])}, ${ktpCount(content.periods?.reduce((n, p) => n + (p.sections?.length ?? 0), 0) ?? 0, ['раздел', 'раздела', 'разделов'])}`, tone: 'border-planning-line bg-info-bg text-navy-700' },
      { title: 'Ошибок', value: errors.length, hint: 'Исправьте прямо здесь, чтобы подтвердить КТП', tone: 'border-planning-danger-border bg-planning-danger text-red-600' },
      { title: 'Предупреждения', value: warnings.length, hint: 'Проверьте перед сохранением', tone: 'border-planning-warning-border bg-planning-warning text-amber-700' },
    ].map(card => <div key={card.title} className={`rounded-planning-panel border px-5 py-4 ${card.tone}`}><p className="text-11 font-bold uppercase tracking-wide text-planning-subtle">{card.title}</p><p className="mt-1 text-2xl font-extrabold leading-tight">{card.value}</p><p className="mt-1 text-xs text-planning-muted">{card.hint}</p></div>)}</div>
    {dirty && <StatusNotice>Сохраните черновик, чтобы повторно проверить ошибки и предупреждения.</StatusNotice>}
    {editable && !rows.length && <StatusNotice><p>Начните с раздела «Структура плана»: добавьте период и раздел, затем темы с положительным количеством часов. После заполнения сохраните черновик.</p><Button variant="secondary" size="sm" className="mt-3" onClick={() => { setStructureOpen(true); requestAnimationFrame(() => document.getElementById('ktp-plan-structure')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })); }}>Заполнить структуру плана</Button></StatusNotice>}
    <KtpIssues appearance="review" issues={saved.content?.issues ?? []} content={saved.content} onShowIssue={issue => {
      const order = Number(issue.fieldPath?.match(/^periods\[(\d+)\]/)?.[1]);
      const pi = content.periods?.findIndex(period => period.order === order) ?? -1;
      if (pi >= 0) { setExpanded(old => ({ ...old, [pi]: true })); setAttention(false); requestAnimationFrame(() => document.getElementById(`ktp-period-${order}`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })); }
    }} onEditTopic={editable && !dirty ? issue => {
      const row = ktpIssueTopic(issue, content);
      const field = issue.fieldPath?.split('.').at(-1);
      if (row) openEditor({ ...row, field: ['title', 'learningObjectives', 'recommendations', 'notes', 'plannedDates', 'plannedHours', 'sourceNumber'].includes(field ?? '') ? field as KtpEditableField : undefined });
    } : undefined} />
    {editable && (saved.rawContent?.candidates ?? []).map(candidate => <div key={candidate.id} className="space-y-3 rounded-xl border border-amber-200 bg-surface p-4"><p className="font-medium text-sm">{candidate.message}</p><p className="text-13 text-muted">{candidate.rawCells?.join(' · ')}</p>
      <Field label="Причина исключения строки (не менее 3 символов)"><TextArea rows={2} value={decisions.find(d => d.id === candidate.id)?.ignoreReason ?? ''} onChange={e => setDecisions(old => [...old.filter(d => d.id !== candidate.id), { id: candidate.id, ignoreReason: e.target.value }])} /></Field>
      <Button variant="secondary" size="sm" disabled={!content.periods?.[0]?.sections?.[0]} onClick={() => { const nextOrder = Math.max(0, ...rows.map(r => r.topic.order ?? 0)) + 1; sectionTopics(0, 0, topics => [...topics, { order: nextOrder, source: candidate.source, title: candidate.rawCells?.join(' ') ?? '', plannedHours: 1 }]); setDecisions(old => [...old.filter(d => d.id !== candidate.id), { id: candidate.id, topicOrder: nextOrder }]); }}>Добавить строку как тему в первый раздел</Button>
    </div>)}
    {editable && (saved.rawContent?.issues ?? []).filter(i => ['SOURCE_MAPPING_REQUIRED', 'FORMULA_CACHE_REQUIRED'].includes(i.code ?? '')).map((issue, i) => <Field key={i} label={issue.message ?? ''} hint="Укажите, как проверили исходную строку"><TextInput value={sourceDecisions.find(d => d.code === issue.code && JSON.stringify(d.source) === JSON.stringify(issue.source))?.reason ?? ''} onChange={e => setSourceDecisions(old => [...old.filter(d => d.code !== issue.code || JSON.stringify(d.source) !== JSON.stringify(issue.source)), { code: issue.code, source: issue.source, reason: e.target.value }])} /></Field>)}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SegmentedTabs appearance="planning" ariaLabel="Фильтр тем" value={attention ? 'attention' : 'all'} options={[{ value: 'all', label: `Все темы · ${rows.length}` }, { value: 'attention', label: `Требуют внимания · ${attentionRows.length}` }]} onChange={value => setAttention(value === 'attention')} />
    </div>
    {attention && !attentionRows.length && <StatusNotice>Нет тем с ошибками или предупреждениями. Необязательные поля можно дополнить отдельно.</StatusNotice>}
    <DataTable appearance="planning" label="Темы КТП">
      <colgroup><col className="w-16" /><col className="w-5/12" /><col className="w-1/4" /><col className="w-20" /><col className="w-40" /><col className="w-8" /></colgroup>
      <thead><tr>{['№', 'Тема урока', 'Цели обучения', 'Часы', 'Плановые сроки', ''].map((label, i) => <TableHead key={i}>{label}</TableHead>)}</tr></thead>
      {content.periods?.map((period, pi) => {
        const periodRows = rows.filter(row => row.pi === pi);
        if (attention && !attentionRows.some(row => row.pi === pi)) return null;
        const opened = expanded[pi] ?? (pi === 0 || attention);
        const periodIssues = attentionIssues.filter(issue => periodRows.some(row => issueMatchesTopic(issue, row.topic)) || issue.fieldPath?.startsWith(`periods[${period.order}]`));
        return <tbody key={pi} id={`ktp-period-${period.order}`}>
          <TableGroupRow columns={6} expanded={opened} onToggle={() => setExpanded(old => ({ ...old, [pi]: !opened }))}>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">{period.title}<span className="text-xs font-normal text-planning-subtle">{ktpCount(periodRows.length, ['тема', 'темы', 'тем'])} · {ktpHours(periodRows.reduce((sum, row) => sum + (row.topic.plannedHours ?? 0), 0))} ч</span>
              {!!periodIssues.length && <Badge appearance="label" tone={periodIssues.some(issue => issue.severity === 'ERROR') ? 'red' : 'amber'}>{ktpCount(periodIssues.length, ['замечание', 'замечания', 'замечаний'])}</Badge>}
            </span>
          </TableGroupRow>
          {opened && period.sections?.map((section, si) => {
            if (attention && !attentionRows.some(row => row.pi === pi && row.si === si)) return null;
            const total = (section.topics ?? []).reduce((sum, topic) => sum + (topic.plannedHours ?? 0), 0);
            return <Fragment key={si}>
              <TableSectionRow columns={6}><span>{section.code} {section.title}</span><span className="ml-3 text-xs font-normal text-planning-subtle">{section.declaredHours != null && `в документе ${ktpHours(section.declaredHours)} ч · `}по темам {ktpHours(total)} ч</span>{section.declaredHours != null && section.declaredHours !== total && <span className="ml-3"><Badge appearance="label" tone="amber">Расхождение часов</Badge></span>}</TableSectionRow>
              {section.topics?.map((topic, ti) => {
                if (attention && !attentionRows.some(row => row.pi === pi && row.si === si && row.ti === ti)) return null;
                const editingHere = editing?.pi === pi && editing.si === si && editing.ti === ti;
                const hasError = errors.some(issue => issueMatchesTopic(issue, topic));
                return <tr key={ti} id={`topic-${topic.order}`} className={editingHere ? 'border-l-2 border-l-navy-700 bg-planning-head' : hasError ? 'bg-planning-danger' : ''}
                  onDragOver={event => { if (dragging?.pi === pi && dragging.si === si) event.preventDefault(); }}
                  onDrop={event => { event.preventDefault(); if (dragging?.pi === pi && dragging.si === si) moveTopic(pi, si, dragging.ti, ti); setDragging(null); }}>
                  <TableCell className="text-planning-subtle"><div className="flex items-center gap-1">{editable && <button type="button" draggable={!editing} disabled={!!editing} aria-label={`Переместить тему ${topic.sourceNumber ?? topic.order}`} title="Перетащите тему или используйте стрелки вверх и вниз"
                    className="rounded text-slate-300 hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
                    onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(topic.order)); setDragging({ pi, si, ti }); }} onDragEnd={() => setDragging(null)}
                    onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); moveTopic(pi, si, ti, ti + (event.key === 'ArrowUp' ? -1 : 1)); } }}><GripVertical className="size-3" /></button>}{topic.sourceNumber ?? topic.order}</div></TableCell>
                  {editingHere ? <TableCell colSpan={5} className="p-0">{topicEditor()}</TableCell> : <>
                    <TableCell><div className="mb-1 flex flex-wrap gap-1">{ktpWorkLabels(topic.title).map(label => <Badge key={label} appearance="label" tone={label.startsWith('СОР') || label === 'СОЧ' ? 'blue' : 'gray'}>{label}</Badge>)}</div><p className="line-clamp-2" title={topic.title}>{topic.title}</p></TableCell>
                    <TableCell><p className="line-clamp-3 text-xs text-planning-muted" title={topic.learningObjectives}>{topic.learningObjectives || <span className="text-planning-subtle">Не указаны</span>}</p></TableCell>
                    <TableCell className="font-bold">{topic.plannedHours ?? <Badge appearance="label" tone="red">Не указаны</Badge>}</TableCell>
                    <TableCell className="text-xs text-planning-muted">{topic.plannedDates || '—'}</TableCell>
                    <TableCell>{editable && <Button variant="ghost" size="icon-sm" aria-label={`Редактировать тему ${topic.sourceNumber ?? topic.order}`} icon={<Pencil className="size-3.5 text-planning-subtle" />} onClick={() => openEditor({ pi, si, ti, topic })} />}</TableCell>
                  </>}
                </tr>;
              })}
              {editing?.pi === pi && editing.si === si && editing.ti === (section.topics?.length ?? 0) && <tr className="border-l-2 border-l-navy-700 bg-planning-head"><TableCell>+</TableCell><TableCell colSpan={5} className="p-0">{topicEditor()}</TableCell></tr>}
              {editable && <tr><TableCell /><TableCell colSpan={5} className="py-2"><Button variant="ghost" size="text" icon={<Plus className="size-3.5" />} onClick={() => openEditor({ pi, si, ti: section.topics?.length ?? 0, topic: { order: Math.max(0, ...rows.map(row => row.topic.order ?? 0)) + 1 } })}>Добавить тему в раздел</Button></TableCell></tr>}
            </Fragment>;
          })}
        </tbody>;
      })}
    </DataTable>
    {editable && <details className="rounded-xl border border-line bg-surface p-4"><summary className="cursor-pointer text-sm font-medium">Данные из шапки документа</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{(['subject', 'academicYear', 'teacherName', 'declaredAnnualHours', 'declaredWeeklyHours', 'classNames'] as const).map((key, index) => <Field key={key} label={['Предмет', 'Учебный год', 'Учитель', 'Часы за год', 'Часов в неделю', 'Классы в документе'][index]}><TextInput type={key.startsWith('declared') ? 'number' : 'text'} value={key === 'classNames' ? content.header?.classNames?.join(', ') ?? '' : content.header?.[key] ?? ''} onChange={e => setContent(old => ({ ...old, header: { ...old.header, [key]: key === 'classNames' ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : key.startsWith('declared') ? e.target.value ? Number(e.target.value) : undefined : e.target.value } }))} /></Field>)}</div></details>}
    {editable && <details id="ktp-plan-structure" open={structureOpen} onToggle={event => setStructureOpen(event.currentTarget.open)} className="text-13 text-planning-muted"><summary className="cursor-pointer">Структура плана</summary><div className="mt-3 space-y-3">
      {content.periods?.map((period, pi) => <div key={pi} className="rounded-xl border border-planning-line bg-white p-4"><Field label="Название периода"><TextInput value={period.title ?? ''} onChange={event => setContent(old => ({ ...old, periods: old.periods?.map((p, index) => index === pi ? { ...p, title: event.target.value } : p) }))} /></Field>
        <div className="mt-3 space-y-3">{period.sections?.map((section, si) => <Field key={si} label="Название раздела"><TextInput value={section.title ?? ''} onChange={event => setContent(old => ({ ...old, periods: old.periods?.map((p, index) => index !== pi ? p : { ...p, sections: p.sections?.map((s, index) => index === si ? { ...s, title: event.target.value } : s) }) }))} /></Field>)}</div>
        <Button variant="ghost" size="sm" onClick={() => setContent(old => ({ ...old, periods: old.periods?.map((p, index) => index === pi ? { ...p, sections: [...(p.sections ?? []), { order: (p.sections?.length ?? 0) + 1, title: 'Новый раздел', topics: [] }] } : p) }))}>Добавить раздел</Button>
      </div>)}
      <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => setContent(old => ({ ...old, periods: [...(old.periods ?? []), { order: (old.periods?.length ?? 0) + 1, title: 'Новый период', sections: [{ order: 1, title: 'Новый раздел', topics: [] }] }] }))}>Добавить период</Button>
    </div></details>}
    <p className="text-xs text-planning-subtle">Плановые сроки из документа — ориентир. Реальные даты уроков берутся из расписания.</p>
    {editable && saveNotice && !dirty && !editing && <StatusNotice tone="success">{saveNotice}</StatusNotice>}
    {editable && <StickyActionBar message={editing ? 'Сохраните или отмените правку темы' : errors.length ? <><strong className="text-red-600">Исправьте {ktpCount(errors.length, ['ошибку', 'ошибки', 'ошибок'])}</strong>, чтобы подтвердить КТП</> : dirty ? 'Есть несохранённые изменения' : 'Черновик сохранён'}>
      <Button variant="secondary" loading={save.isPending} disabled={!dirty || !!editing} onClick={() => void persist().catch(() => {})}>Сохранить черновик</Button>
      <Button variant="primary" disabled={dirty || errors.length > 0 || save.isPending || !!editing} onClick={() => setConfirming(true)}>Подтвердить КТП</Button>
    </StickyActionBar>}
    <ConfirmDialog open={deleting} title="Удалить тему?" message="Тема будет удалена из черновика. Исходный файл останется без изменений." danger confirmLabel="Удалить" onClose={() => setDeleting(false)} onConfirm={() => { if (editing) sectionTopics(editing.pi, editing.si, topics => topics.filter((_, i) => i !== editing.ti)); setDeleting(false); setEditing(null); }} />
    {confirming && <KtpActivationModal draft={saved} onClose={() => setConfirming(false)} refreshTargets={persist} />}
    {removing && <KtpRemovalDialog target={{ kind: 'import', id: saved.importId!, label: imported.data?.source?.originalName ?? 'Черновик КТП' }} onClose={() => setRemoving(false)} onRemoved={() => { clear(); navigate(ktpPaths.list); }} />}
    {reparsing && <KtpReparseModal draft={saved} sourceName={imported.data?.source?.originalName} onRefresh={refreshAfterReparse} onClose={applied => { setReparsing(false); if (applied) { clear(); navigate(ktpPaths.list); } }} />}
  </div>;
}
