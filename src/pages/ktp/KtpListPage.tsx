import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { BookOpen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { WorkspacePageHeader } from '@/components/ui/WorkspacePageHeader';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { Badge } from '@/components/ui/Badge';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Field, Select } from '@/components/ui/Field';
import { DataTable, TableHead, TableCell } from '@/components/ui/DataTable';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useKtpBindings, useKtpContext, useKtpImports, useKtpProgress } from '@/hooks/queries';
import { ktpPaths, bindingStateLabel, copiedFromLabel, runningKtp } from '@/lib/ktpModel';
import { KtpAccess, ktpError } from './KtpShared';
import { KtpUploadModal } from './KtpUploadModal';
import { KtpRemovalDialog } from './KtpRemovalDialog';
import { KtpCopyDialog } from './KtpCopyDialog';
import { useListSearchParams } from '@/hooks/useListNavigation';
import { parsePositiveInteger } from '@/lib/listNavigation';
import type { KtpListFilters, KtpRemovalTarget } from '@/lib/ktpApi';

const statusOptions = [
  ['ACTIVE', 'Активные'], ['DRAFT', 'Черновики'], ['PROCESSING', 'Распознавание'],
  ['FAILED', 'Ошибки'], ['REVIEW', 'Проверка прогресса'],
] as const;
const filterKeys = ['academicYearId', 'subjectId', 'classId', 'status'] as const;

export function KtpListPage() { return <KtpAccess><KtpList /></KtpAccess>; }
export function KtpSectionRedirect() { return <Navigate replace to={ktpPaths.list} />; }
function KtpList() {
  useDocumentTitle('КТП');
  const navigate = useNavigate();
  const [params, setParams] = useListSearchParams('ktp', filterKeys);
  const filters: KtpListFilters = {
    academicYearId: parsePositiveInteger(params.get('academicYearId')) ?? undefined,
    subjectId: parsePositiveInteger(params.get('subjectId')) ?? undefined,
    classId: parsePositiveInteger(params.get('classId')) ?? undefined,
    status: statusOptions.some(([value]) => value === params.get('status')) ? params.get('status')! : undefined,
  };
  const filtered = filterKeys.some(key => params.has(key));
  function changeFilter(key: typeof filterKeys[number], value: string) {
    setParams(old => { const next = new URLSearchParams(old); if (value) next.set(key, value); else next.delete(key); if (key === 'academicYearId' || key === 'subjectId') next.delete('classId'); if (key === 'academicYearId') next.delete('subjectId'); return next; });
  }
  function resetFilters() { setParams(old => { const next = new URLSearchParams(old); filterKeys.forEach(key => next.delete(key)); return next; }); }
  const context = useKtpContext();
  // КТП-COPY: архивный год виден только ради копирования. Его КТП — отдельный список (`archived=true`),
  // загрузок и статусов у него нет, имена классов и предметов — из `context.archive`.
  const current = context.data?.assignments ?? [];
  const archive = context.data?.archive ?? [];
  const archivedYear = filters.academicYearId != null && !current.some(a => a.academicYearId === filters.academicYearId) && archive.some(a => a.academicYearId === filters.academicYearId);
  // Год из адреса может оказаться архивным — до ответа контекста неизвестно, какой список спрашивать.
  const ready = !filters.academicYearId || context.isSuccess;
  const imports = useKtpImports({ ...filters, unconfirmedOnly: true }, ready && !archivedYear);
  const bindings = useKtpBindings(ready, archivedYear ? { ...filters, status: undefined, archived: true } : filters);
  const [upload, setUpload] = useState(false);
  const [removing, setRemoving] = useState<KtpRemovalTarget | null>(null);
  const [copying, setCopying] = useState<{ bindingId: number; versionId: number } | null>(null);
  const items = archivedYear ? [] : imports.data?.pages.flatMap(p => p.items ?? []) ?? [];
  const active = bindings.data?.pages.flatMap(p => p.items ?? []) ?? [];
  const assignments = archivedYear ? archive : current;
  const archivedYearIds = new Set(archive.filter(a => !current.some(c => c.academicYearId === a.academicYearId)).map(a => a.academicYearId!));
  const years = [...new Map([...current, ...archive].map(value => [value.academicYearId!, `${value.academicYear?.replace('/', '–')}${archivedYearIds.has(value.academicYearId!) ? ' · архив' : ''}`])).entries()];
  const subjects = [...new Map(assignments.filter(value => !filters.academicYearId || value.academicYearId === filters.academicYearId).map(value => [value.subjectId!, value.subject])).entries()];
  const classes = [...new Map(assignments.filter(value => (!filters.academicYearId || value.academicYearId === filters.academicYearId) && (!filters.subjectId || value.subjectId === filters.subjectId)).map(value => [value.classId!, value.className])).entries()].sort((left, right) => (left[1] ?? '').localeCompare(right[1] ?? '', 'ru', { numeric: true }));
  const pending = context.isPending || (!archivedYear && imports.isPending) || bindings.isPending;
  const error = imports.error || bindings.error || context.error;
  const activeVersionIds = new Set(active.map(b => b.versionId));
  const groups = new Map<string, typeof active>();
  for (const binding of active) {
    const key = `${binding.academicYearId}-${binding.subjectId}-${binding.versionId}-${binding.state}`;
    const group = groups.get(key); if (group) group.push(binding); else groups.set(key, [binding]);
  }
  const uploads = items.filter(item => item.versionStatus !== 'CONFIRMED' && (!item.draftId || !activeVersionIds.has(item.draftId)));
  const action = <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setUpload(true)}>Загрузить КТП</Button>;
  return <div className="planning-page gap-8">
    <WorkspacePageHeader title="КТП" section backTo="/workspace" backLabel="К рабочему пространству" actions={action} description="Календарно-тематическое планирование по вашим предметам и классам" />
    {!!(current.length || archive.length) && (pending || filtered || active.length > 0 || uploads.length > 0) && <div className="flex flex-wrap items-end gap-3" aria-label="Фильтры КТП">
      <Field label="Учебный год" className="min-w-40 flex-1"><Select value={filters.academicYearId ?? ''} onChange={event => changeFilter('academicYearId', event.target.value)}><option value="">Все учебные годы</option>{years.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></Field>
      <Field label="Предмет" className="min-w-40 flex-1"><Select value={filters.subjectId ?? ''} onChange={event => changeFilter('subjectId', event.target.value)}><option value="">Все предметы</option>{subjects.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></Field>
      <Field label="Класс" className="min-w-32 flex-1"><Select value={filters.classId ?? ''} onChange={event => changeFilter('classId', event.target.value)}><option value="">Все классы</option>{classes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></Field>
      {!archivedYear && <Field label="Статус" className="min-w-44 flex-1"><Select value={filters.status ?? ''} onChange={event => changeFilter('status', event.target.value)}><option value="">Все статусы</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>}
      {filtered && <Button variant="ghost" onClick={resetFilters}>Сбросить</Button>}
    </div>}
    {context.data?.allocationEnabled === false && <StatusNotice tone="warning">Распределение тем в уроки не подключено. КТП можно загружать, проверять и хранить. Для автоматической подстановки тем обратитесь к ответственному за подключение школы.</StatusNotice>}
    {pending ? <LoadingBlock /> : error ? <ErrorBlock message={ktpError(error)} onRetry={() => { void imports.refetch(); void bindings.refetch(); void context.refetch(); }} /> : !active.length && !uploads.length && filtered ? <EmptyBlock title="Ничего не найдено" description="Попробуйте изменить фильтры." action={<Button variant="secondary" onClick={resetFilters}>Сбросить фильтры</Button>} /> : !active.length && !uploads.length ? <section className="rounded-planning-panel border border-planning-line bg-surface px-6">
      <EmptyBlock appearance="planning" icon={<BookOpen className="size-7" />} title="КТП пока не загружен" description="Загрузите календарно-тематическое планирование в Word или Excel. После проверки и утверждения проверьте распределение тем и прогресс классов." action={action} />
      <div className="mx-auto grid max-w-4xl gap-6 border-t border-planning-line py-8 sm:grid-cols-3">{[
        ['Загрузите файл', 'DOCX или XLSX, выберите предмет и классы'],
        ['Проверьте и подтвердите', 'Исправьте ошибки распознавания прямо на странице'],
        ['Работайте в уроках', 'Проверьте распределение тем по опубликованному расписанию'],
      ].map(([title, description], index) => <div key={title} className="text-center"><span className="mx-auto mb-2 flex size-7 items-center justify-center rounded-full bg-planning-period text-xs font-semibold text-navy-700">{index + 1}</span><p className="text-13 font-semibold text-planning-ink">{title}</p><p className="mt-1 text-xs text-planning-muted">{description}</p></div>)}</div>
    </section> : <DataTable appearance="planning-list" label="Календарно-тематические планы"><colgroup><col className="w-1/4" /><col className="w-32" /><col className="w-32" /><col className="w-32" /><col className="w-1/4" /><col className="w-12" /></colgroup><thead><tr>{['Предмет', 'Классы', 'Учебный год', 'Статус', 'Прохождение', ''].map((label, i) => <TableHead key={i}>{label}</TableHead>)}</tr></thead><tbody>
      {[...groups.values()].map(group => { const binding = group[0]; const a = assignments.find(a => a.classId === binding.classId && a.subjectId === binding.subjectId && a.academicYearId === binding.academicYearId); const classes = group.map(value => assignments.find(a => a.classId === value.classId && a.subjectId === value.subjectId && a.academicYearId === value.academicYearId)?.className ?? ''); const copiedFrom = copiedFromLabel(binding.origin); const sourceName = copiedFrom ? `Копия ${copiedFrom}` : binding.sourceName ?? items.find(item => item.draftId === binding.versionId)?.source?.originalName; const inArchive = !!binding.archived; return <tr key={`b-${binding.id}`}>
        <TableCell>{inArchive ? <p className="text-sm font-bold text-planning-ink">{a?.subject}</p> : <Link className="text-sm font-bold text-planning-ink hover:text-navy-700" to={ktpPaths.binding(binding.id!)}>{a?.subject}</Link>}<p className="mt-1 max-w-64 truncate text-xs text-planning-subtle">{sourceName && `${sourceName} · `}версия {binding.versionNumber ?? binding.revision}</p></TableCell><TableCell>{classes.join(', ')}</TableCell><TableCell>{a?.academicYear?.replace('/', '–')}</TableCell><TableCell>{inArchive ? <Badge appearance="label" tone="gray">Архив</Badge> : <Badge appearance="label" tone={binding.state === 'READY' ? 'green' : 'amber'}>{bindingStateLabel(binding.state)}</Badge>}</TableCell><TableCell>{inArchive ? <span className="text-xs text-planning-subtle">Учебный год завершён — только для копирования</span> : binding.state === 'READY' ? <div className="space-y-2">{group.map((value, index) => <ProgressDisclosure key={value.id} id={value.id!} classLabel={group.length > 1 ? classes[index] : undefined} />)}</div> : <span className="text-xs text-planning-subtle">{bindingStateLabel(binding.state)}</span>}</TableCell><TableCell><ActionMenu appearance="compact" placement="viewport" label={`Действия КТП: ${a?.subject} · ${classes.join(', ')}`} items={inArchive ? [
          { label: 'Копировать КТП', description: 'Черновик на другой год или класс', onSelect: () => setCopying({ bindingId: binding.id!, versionId: binding.versionId! }) },
        ] : [
          { label: 'Открыть КТП', onSelect: () => navigate(ktpPaths.binding(binding.id!)) },
          { label: 'Копировать КТП', description: 'Черновик на другой год или класс', onSelect: () => setCopying({ bindingId: binding.id!, versionId: binding.versionId! }) },
          { label: 'Удалить КТП', danger: true, onSelect: () => setRemoving({ kind: 'plan', targets: group.map(value => ({ bindingId: value.id!, expectedRevision: value.revision! })), label: `${a?.subject ?? 'КТП'} · ${classes.join(', ')} · ${a?.academicYear?.replace('/', '–') ?? ''}` }) },
        ]} /></TableCell>
      </tr>; })}
      {uploads.map(item => { const a = assignments.find(a => a.subjectId === item.subjectId && a.academicYearId === item.academicYearId); const copiedFrom = copiedFromLabel(item.origin); const label = copiedFrom ? `Копия ${copiedFrom}` : item.source?.originalName; const open = copiedFrom && item.draftId ? ktpPaths.draft(item.draftId) : ktpPaths.import(item.id!); return <tr key={`i-${item.id}`}>
        <TableCell><Link className="text-sm font-bold text-planning-ink hover:text-navy-700" to={open}>{a?.subject}</Link><p className="mt-1 max-w-64 truncate text-xs text-planning-subtle" title={label}>{label}</p></TableCell>
        <TableCell>{assignments.filter(a => a.subjectId === item.subjectId && a.academicYearId === item.academicYearId && item.classIds?.includes(a.classId!)).map(a => a.className).join(', ')}</TableCell><TableCell>{a?.academicYear?.replace('/', '–')}</TableCell>
        <TableCell><Badge appearance="label" tone={item.status === 'FAILED' ? 'red' : 'gray'}>{runningKtp(item.status) ? 'Распознаём КТП' : item.draftId ? 'Черновик' : item.status === 'FAILED' ? 'Ошибка распознавания' : 'Файл сохранён'}</Badge></TableCell><TableCell><span className="text-xs text-planning-subtle">{item.draftId ? 'Не подтверждён — в уроках не используется' : '—'}</span></TableCell><TableCell><ActionMenu appearance="compact" placement="viewport" label={`Действия КТП: ${label ?? a?.subject}`} items={[
          { label: item.draftId ? 'Продолжить проверку' : 'Открыть загрузку', onSelect: () => navigate(open) },
          { label: copiedFrom ? 'Удалить черновик' : 'Удалить загрузку', danger: true, onSelect: () => setRemoving({ kind: 'import', id: item.id!, label: label ?? a?.subject ?? 'КТП' }) },
        ]} /></TableCell>
      </tr>; })}
    </tbody></DataTable>}
    {(imports.hasNextPage || bindings.hasNextPage) && <Button variant="secondary" loading={imports.isFetchingNextPage || bindings.isFetchingNextPage} onClick={() => { if (imports.hasNextPage) void imports.fetchNextPage(); if (bindings.hasNextPage) void bindings.fetchNextPage(); }}>Показать ещё</Button>}
    <p className="text-xs text-muted">Показаны только ваши предметы и классы. Один КТП на учебный год + класс + предмет; прогресс каждого класса считается отдельно.</p>
    {upload && <KtpUploadModal onClose={() => setUpload(false)} />}
    {removing && <KtpRemovalDialog target={removing} onClose={() => setRemoving(null)} />}
    {copying && <KtpCopyDialog bindingId={copying.bindingId} versionId={copying.versionId} onClose={() => setCopying(null)} />}
  </div>;
}

function ProgressDisclosure({ id, classLabel }: { id: number; classLabel?: string }) {
  const query = useKtpProgress(id);
  if (query.isPending) return <span role="status" className="text-xs text-muted">Загрузка…</span>;
  if (query.isError) return <Button variant="secondary" size="sm" title={ktpError(query.error)} onClick={() => void query.refetch()}>Повторить</Button>;
  const completed = query.data.topics?.filter(topic => topic.status === 'COMPLETED').length ?? 0;
  const total = query.data.topics?.length ?? 0;
  return <div className="flex min-w-40 items-center gap-3"><ProgressBar tone="navy" value={completed} max={total} label={classLabel ? `Пройденные темы: ${classLabel}` : 'Пройденные темы'} className="w-28" /><p className="text-xs text-planning-subtle">{classLabel && `${classLabel}: `}{completed} из {total}<br />тем</p></div>;
}
