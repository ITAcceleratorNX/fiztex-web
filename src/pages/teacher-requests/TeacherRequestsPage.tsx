import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, FileText, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, TableCell, TableHead } from '@/components/ui/DataTable';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTeacherRequests } from '@/hooks/queries';
import { ROUTES } from '@/lib/routes';
import { TEACHER_REQUEST_STATUS, TEACHER_REQUEST_TYPE, type TeacherRequestSummary } from '@/lib/teacherRequestsApi';
import { RequestFormModal } from './RequestFormModal';

type Section = 'ACTIVE' | 'HISTORY';

export function TeacherRequestsPage() {
  useDocumentTitle('Освобождения');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section: Section = params.get('tab') === 'history' ? 'HISTORY' : 'ACTIVE';
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(0);
  const query = useTeacherRequests(section);
  const requests = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const visible = useMemo(() => requests.slice(page * 50, page * 50 + 50), [requests, page]);

  function changeSection(value: string) {
    setPage(0);
    setParams(value === 'HISTORY' ? { tab: 'history' } : {}, { replace: true });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-28 font-bold text-ink">Освобождения</h1>
        <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 size-4" aria-hidden />Создать заявку</Button>
      </header>
      <Tabs value={section} onValueChange={changeSection}>
        <TabsList>
          <TabsTrigger value="ACTIVE">Мои заявки</TabsTrigger>
          <TabsTrigger value="HISTORY">История</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isPending ? <LoadingBlock label="Загружаем заявки…" /> : query.isError ? (
        <ErrorBlock message={query.error instanceof Error ? query.error.message : 'Не удалось загрузить заявки'} onRetry={() => void query.refetch()} />
      ) : requests.length === 0 ? (
        <EmptyBlock
          title={section === 'ACTIVE' ? 'Заявок пока нет' : 'История пуста'}
          description={section === 'ACTIVE' ? 'Создайте заявку, если не сможете провести урок.' : 'Здесь будут отображаться решённые и отменённые заявки.'}
          action={section === 'ACTIVE' ? <Button onClick={() => setCreateOpen(true)}>Создать заявку</Button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          <DataTable label="Заявки на освобождение" appearance="registry">
            <thead><tr>
              <TableHead>Тип заявки</TableHead><TableHead>Даты отсутствия</TableHead><TableHead>Документы</TableHead><TableHead>Статус</TableHead><TableHead>Отправлена</TableHead><TableHead><span className="sr-only">Открыть</span></TableHead>
            </tr></thead>
            <tbody>{visible.map((request) => <TeacherRequestRow key={request.id} request={request} />)}</tbody>
          </DataTable>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <p>Страница {page + 1} из {Math.max(1, totalPages)} · Всего заявок: {query.data?.totalElements ?? requests.length}</p>
            {totalPages > 1 && <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Назад</Button>
              <Button variant="secondary" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Дальше</Button>
            </div>}
          </div>
        </div>
      )}

      <RequestFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={(saved) => {
        setCreateOpen(false);
        if (saved.id != null) navigate(ROUTES.teacherRequest(saved.id));
      }} />
    </div>
  );
}

export function TeacherRequestRow({ request }: { request: TeacherRequestSummary }) {
  const days = inclusiveDays(request.dateFrom, request.dateTo);
  const statusTone = request.status === 'APPROVED' ? 'green' : request.status === 'PENDING' ? 'amber' : request.status === 'REJECTED' ? 'red' : 'gray';
  return (
    <tr className="group hover:bg-slate-50">
      <TableCell><span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-ink"><FileText className="size-3.5" aria-hidden />{request.type ? TEACHER_REQUEST_TYPE[request.type] : 'Заявка'}</span></TableCell>
      <TableCell><strong className="block text-ink">{formatPeriod(request.dateFrom, request.dateTo)}</strong><span className="text-xs text-muted">{days} {pluralDays(days)}</span></TableCell>
      <TableCell>{request.documentCount ? <span className="inline-flex items-center gap-1.5 text-ink"><FileText className="size-4 text-muted" aria-hidden />{request.documentCount} {pluralFiles(request.documentCount)}</span> : <span className="text-muted">—</span>}</TableCell>
      <TableCell><Badge tone={statusTone} appearance="label">{request.status ? TEACHER_REQUEST_STATUS[request.status] : '—'}</Badge></TableCell>
      <TableCell className="whitespace-nowrap text-muted">{formatDate(request.createdAt)}</TableCell>
      <TableCell><Link aria-label="Открыть заявку" to={ROUTES.teacherRequest(request.id ?? 0)} className="inline-flex rounded p-1 text-slate-400 hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"><ChevronRight className="size-4" aria-hidden /></Link></TableCell>
    </tr>
  );
}

export function formatPeriod(from?: string | null, to?: string | null) {
  if (!from) return '—';
  return from === to ? formatDateOnly(from) : `${formatDateOnly(from)} — ${formatDateOnly(to)}`;
}
export function inclusiveDays(from?: string | null, to?: string | null) {
  if (!from || !to) return 0;
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
export function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}
export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
export function formatDateOnly(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
export function pluralDays(value: number) { return value % 10 === 1 && value % 100 !== 11 ? 'день' : value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 12 || value % 100 > 14) ? 'дня' : 'дней'; }
export function pluralFiles(value: number) { return value === 1 ? 'файл' : value >= 2 && value <= 4 ? 'файла' : 'файлов'; }
