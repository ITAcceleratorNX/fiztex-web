import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronRight, FileText, Stethoscope } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, TableCell, TableHead } from '@/components/ui/DataTable';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useAdminTeacherRequests } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ROUTES } from '@/lib/routes';
import { TEACHER_REQUEST_STATUS, TEACHER_REQUEST_TYPE, type TeacherRequestStatus, type TeacherRequestSummary } from '@/lib/teacherRequestsApi';
import { formatDate, formatPeriod, inclusiveDays, pluralDays, pluralFiles } from './TeacherRequestsPage';

type StatusTab = TeacherRequestStatus | 'ALL';
const TABS: { value: StatusTab; label: string }[] = [
  { value: 'PENDING', label: 'На рассмотрении' },
  { value: 'APPROVED', label: 'Согласованы' },
  { value: 'REJECTED', label: 'Отклонены' },
  { value: 'CANCELLED', label: 'Отменены' },
  { value: 'ALL', label: 'Все' },
];

export function AdminTeacherRequestsPage() {
  useDocumentTitle('Освобождения учителей');
  const [params, setParams] = useSearchParams();
  const selected = (TABS.some((tab) => tab.value.toLowerCase() === params.get('tab'))
    ? TABS.find((tab) => tab.value.toLowerCase() === params.get('tab'))?.value
    : 'PENDING') as StatusTab;
  const [page, setPage] = useState(0);
  const query = useAdminTeacherRequests(selected);
  const pendingCountQuery = useAdminTeacherRequests('PENDING');
  const rows = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const visible = useMemo(() => rows.slice(page * 50, page * 50 + 50), [rows, page]);

  return (
    <div className="space-y-6">
      <h1 className="text-28 font-bold text-ink">Освобождения учителей</h1>
      <Tabs value={selected} onValueChange={(value) => {
        setPage(0);
        setParams(value === 'PENDING' ? {} : { tab: value.toLowerCase() }, { replace: true });
      }}>
        <TabsList>{TABS.map((tab) => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}{tab.value === 'PENDING' && pendingCountQuery.data?.totalElements ? ` · ${pendingCountQuery.data.totalElements}` : ''}</TabsTrigger>)}</TabsList>
      </Tabs>
      {query.isPending ? <LoadingBlock label="Загружаем заявки…" /> : query.isError ? (
        <ErrorBlock message={query.error instanceof Error ? query.error.message : 'Не удалось загрузить заявки'} onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyBlock title={selected === 'PENDING' ? 'Новых заявок нет' : 'Заявок нет'} description="В этом разделе пока нет заявок учителей." />
      ) : (
        <div className="space-y-4">
          <DataTable label="Заявки учителей" appearance="registry">
            <thead><tr><TableHead>Учитель</TableHead><TableHead>Тип заявки</TableHead><TableHead>Период</TableHead><TableHead>Документы</TableHead><TableHead>Статус</TableHead><TableHead>Подана</TableHead><TableHead><span className="sr-only">Открыть</span></TableHead></tr></thead>
            <tbody>{visible.map((request) => <AdminRequestRow key={request.id} request={request} />)}</tbody>
          </DataTable>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <p>Страница {page + 1} из {Math.max(1, totalPages)} · Всего заявок: {query.data?.totalElements ?? rows.length}</p>
            {totalPages > 1 && <div className="flex gap-2"><Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Назад</Button><Button variant="secondary" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Дальше</Button></div>}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminRequestRow({ request }: { request: TeacherRequestSummary }) {
  const days = inclusiveDays(request.dateFrom, request.dateTo);
  const tone = request.status === 'APPROVED' ? 'green' : request.status === 'PENDING' ? 'amber' : request.status === 'REJECTED' ? 'red' : 'gray';
  return <tr className="hover:bg-slate-50">
    <TableCell><span className="font-semibold text-ink">{request.teacherName ?? '—'}</span></TableCell>
    <TableCell><span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-ink">{request.type === 'SICK_LEAVE' ? <Stethoscope className="size-3.5" aria-hidden /> : <CalendarDays className="size-3.5" aria-hidden />}{request.type ? TEACHER_REQUEST_TYPE[request.type] : 'Заявка'}</span></TableCell>
    <TableCell><span className="block font-semibold text-ink">{formatPeriod(request.dateFrom, request.dateTo)}</span><span className="text-xs text-subtle">{days} {pluralDays(days)}</span></TableCell>
    <TableCell>{request.documentCount ? <span className="inline-flex items-center gap-1.5 text-ink"><FileText className="size-4 text-muted" aria-hidden />{request.documentCount} {pluralFiles(request.documentCount)}</span> : <span className="text-muted">—</span>}</TableCell>
    <TableCell><Badge tone={tone} appearance="label">{request.status ? TEACHER_REQUEST_STATUS[request.status] : '—'}</Badge></TableCell>
    <TableCell className="whitespace-nowrap text-muted">{formatDate(request.createdAt)}</TableCell>
    <TableCell><Link aria-label="Открыть заявку" to={ROUTES.adminTeacherRequest(request.id ?? 0)} className="inline-flex rounded p-1 text-subtle hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"><ChevronRight className="size-4" aria-hidden /></Link></TableCell>
  </tr>;
}
