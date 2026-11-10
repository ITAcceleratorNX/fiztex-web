import { useRef, useState, type ChangeEvent, type ReactNode, type Ref } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDownToLine, Check, ChevronRight, FileText, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { Field, TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { useApproveTeacherRequest, useCancelTeacherRequest, useDeleteTeacherRequestDocument, useRejectTeacherRequest, useTeacherRequest, useUploadTeacherRequestDocument } from '@/hooks/queries';
import { teacherRequestsApi, TEACHER_REQUEST_FILE_ACCEPT, TEACHER_REQUEST_MAX_FILE_SIZE, TEACHER_REQUEST_STATUS, TEACHER_REQUEST_TYPE, type TeacherRequest, type TeacherRequestDocument, type TeacherRequestHistory } from '@/lib/teacherRequestsApi';
import { ROUTES } from '@/lib/routes';
import { formatDateTime, formatPeriod, inclusiveDays, pluralDays } from './TeacherRequestsPage';
import { RequestFormModal } from './RequestFormModal';

export function RequestDetailPage({ admin }: { admin: boolean }) {
  const params = useParams();
  const requestId = Number(params.requestId);
  const navigate = useNavigate();
  const toast = useToast();
  const query = useTeacherRequest(Number.isSafeInteger(requestId) && requestId > 0 ? requestId : null, admin ? 'admin' : 'teacher');
  const cancel = useCancelTeacherRequest();
  const approve = useApproveTeacherRequest();
  const reject = useRejectTeacherRequest();
  const upload = useUploadTeacherRequestDocument();
  const remove = useDeleteTeacherRequestDocument();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [fileError, setFileError] = useState('');
  const request = query.data;
  const busy = cancel.isPending || approve.isPending || reject.isPending || upload.isPending || remove.isPending;

  async function download(document: TeacherRequestDocument) {
    if (!request?.id || !document.id) return;
    try {
      const blob = admin
        ? await teacherRequestsApi.adminDocument(request.id, document.id)
        : await teacherRequestsApi.teacherDocument(request.id, document.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.fileName ?? 'document';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось скачать документ');
    }
  }

  async function onFile(file: File | undefined) {
    setFileError('');
    if (!file || !request?.id) return;
    if (file.size > TEACHER_REQUEST_MAX_FILE_SIZE) {
      setFileError('Размер файла не должен превышать 10 МБ.');
      return;
    }
    if (!/\.(pdf|jpe?g|png|heic)$/i.test(file.name)) {
      setFileError('Поддерживаются PDF, JPG, PNG и HEIC.');
      return;
    }
    try {
      await upload.mutateAsync({ id: request.id, file });
      toast.success('Документ добавлен');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить документ');
    }
  }

  async function runAction(action: 'approve' | 'cancel') {
    if (!request?.id) return;
    try {
      if (action === 'approve') await approve.mutateAsync(request.id);
      else await cancel.mutateAsync(request.id);
      toast.success(action === 'approve' ? 'Заявка согласована' : 'Заявка отменена');
      if (action === 'cancel') navigate(ROUTES.teacherRequests);
      setCancelOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось выполнить действие');
      void query.refetch();
    }
  }

  async function submitRejection() {
    if (!request?.id || !rejectionReason.trim()) return;
    try {
      await reject.mutateAsync({ id: request.id, reason: rejectionReason.trim() });
      toast.success('Заявка отклонена');
      setRejectOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось отклонить заявку');
      void query.refetch();
    }
  }

  if (query.isPending) return <LoadingBlock label="Загружаем заявку…" />;
  if (query.isError || !request) return <ErrorBlock message={query.error instanceof Error ? query.error.message : 'Заявка не найдена'} onRetry={() => void query.refetch()} />;
  return (
      <RequestDetailContent
      request={request}
      admin={admin}
      busy={busy}
      fileError={fileError}
      inputRef={inputRef}
      onUploadClick={() => inputRef.current?.click()}
      onFile={(event) => void onFile(event.currentTarget.files?.[0])}
      onDownload={(document) => void download(document)}
      onRemove={(documentId) => void remove.mutateAsync({ requestId: request.id!, documentId }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Не удалось удалить документ'))}
      onEdit={() => setEditOpen(true)}
      onCancel={() => setCancelOpen(true)}
      onApprove={() => void runAction('approve')}
      onReject={() => { setRejectionReason(''); setRejectOpen(true); }}
      onBack={() => navigate(admin ? ROUTES.adminTeacherRequests : ROUTES.teacherRequests)}
      footer={(
        <>
          <ConfirmDialog open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={() => void runAction('cancel')} title="Отменить заявку?" message="Заявка перейдёт в историю и не будет рассмотрена." confirmLabel="Отменить заявку" danger loading={cancel.isPending} />
          <RequestFormModal open={editOpen} request={request} onClose={() => setEditOpen(false)} onSaved={() => setEditOpen(false)} />
          <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Отклонить заявку" subtitle={`${request.teacherName ?? 'Учитель'} · ${request.type ? TEACHER_REQUEST_TYPE[request.type] : 'Заявка'}, ${formatPeriod(request.dateFrom, request.dateTo)}`} size="md" footer={<div className="flex justify-between"><Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={reject.isPending}>Отмена</Button><Button variant="danger" onClick={() => void submitRejection()} loading={reject.isPending} disabled={!rejectionReason.trim()}>Отклонить заявку</Button></div>}>
            <Field label="Причина отказа" required hint="Учитель увидит эту причину в своей заявке."><TextArea autoFocus value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} maxLength={1000} /></Field>
          </Modal>
        </>
      )}
    />
  );
}

function RequestDetailContent({
  request, admin, busy, fileError, inputRef, onUploadClick, onFile, onDownload, onRemove, onEdit, onCancel, onApprove, onReject, onBack, footer,
}: {
  request: TeacherRequest; admin: boolean; busy: boolean; fileError: string; inputRef: Ref<HTMLInputElement>;
  onUploadClick: () => void; onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownload: (document: TeacherRequestDocument) => void; onRemove: (documentId: number) => void;
  onEdit: () => void; onCancel: () => void; onApprove: () => void; onReject: () => void; onBack: () => void; footer: ReactNode;
}) {
  const statusTone = request.status === 'APPROVED' ? 'green' : request.status === 'PENDING' ? 'amber' : request.status === 'REJECTED' ? 'red' : 'gray';
  const decision = request.history?.find((event) => event.action === 'APPROVED' || event.action === 'REJECTED');
  const actions = request.availableActions ?? [];
  const canUpload = !admin && actions.includes('UPLOAD_DOCUMENT');
  const canDelete = !admin && request.status === 'PENDING';
  const documents = request.documents ?? [];
  return (
    <div className="space-y-5">
      <nav aria-label="Хлебные крошки" className="flex items-center gap-1.5 text-13 text-subtle">
        <button type="button" onClick={onBack} className="hover:text-navy-700">{admin ? 'Освобождения учителей' : 'Освобождения'}</button><ChevronRight className="size-3.5" aria-hidden /><span className="font-semibold text-link">Заявка</span>
      </nav>
      <header>
        <h1 className="text-28 font-bold text-ink">{admin ? request.teacherName : request.type ? TEACHER_REQUEST_TYPE[request.type] : 'Заявка'}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={statusTone} appearance="label">{request.status ? TEACHER_REQUEST_STATUS[request.status] : '—'}</Badge>
          <Badge tone="gray" appearance="label">{request.type ? TEACHER_REQUEST_TYPE[request.type] : 'Заявка'}</Badge>
          <span className="font-semibold text-ink">{formatPeriod(request.dateFrom, request.dateTo)}</span>
          <span className="text-xs text-subtle">{inclusiveDays(request.dateFrom, request.dateTo)} {pluralDays(inclusiveDays(request.dateFrom, request.dateTo))}</span>
        </div>
      </header>
      {request.status === 'CANCELLED' && admin && <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-navy-700">Учитель отменил заявку до решения. Рассматривать её не нужно.</div>}
      <section className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
        <div><h2 className="text-sm font-semibold text-ink">Причина</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{request.reason}</p></div>
        <div>
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-ink">Документы</h2>
            {canUpload && <><input ref={inputRef} className="hidden" type="file" accept={TEACHER_REQUEST_FILE_ACCEPT} onChange={onFile} disabled={busy} /><Button variant="secondary" size="sm" onClick={onUploadClick} loading={busy}><Plus className="mr-1 size-4" aria-hidden />Добавить документ</Button></>}
          </div>
          {documents.length ? <ul className="mt-3 space-y-2">{documents.map((document) => <li key={document.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
            <FileText className="size-4 shrink-0 text-subtle" aria-hidden /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{document.fileName}</p><p className="text-xs text-subtle">{fileSize(document.sizeBytes)} · {document.contentType}</p></div>
            <Button variant="ghost" size="icon-sm" aria-label={`Скачать ${document.fileName}`} onClick={() => onDownload(document)}><ArrowDownToLine className="size-4" aria-hidden /></Button>
            {canDelete && document.id != null && <Button variant="danger-ghost" size="icon-sm" aria-label={`Удалить ${document.fileName}`} onClick={() => onRemove(document.id!)}><Trash2 className="size-4" aria-hidden /></Button>}
          </li>)}</ul> : <p className="mt-2 text-sm text-muted">Документы не прикреплены</p>}
          {fileError && <p role="alert" className="mt-2 text-sm text-red-600">{fileError}</p>}
        </div>
        {request.status === 'REJECTED' && request.rejectionReason && <div className="rounded-lg bg-red-50 p-3"><p className="text-xs font-semibold text-red-700">Причина отказа</p><p className="mt-1 text-sm text-red-800">{request.rejectionReason}</p></div>}
        <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          {admin && <DetailValue label="Учитель" value={request.teacherName ?? '—'} />}
          <DetailValue label="Подана" value={formatDateTime(request.createdAt)} />
          {request.decidedAt && <DetailValue label={request.status === 'REJECTED' ? 'Отклонена' : 'Согласована'} value={formatDateTime(request.decidedAt)} />}
          {decision?.actorName && <DetailValue label="Администратор" value={decision.actorName} />}
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        {!admin && actions.includes('EDIT') && <Button variant="secondary" onClick={onEdit}><Pencil className="mr-1.5 size-4" aria-hidden />Редактировать</Button>}
        {!admin && actions.includes('CANCEL') && <Button variant="danger-outline" onClick={onCancel}><X className="mr-1.5 size-4" aria-hidden />Отменить заявку</Button>}
        {admin && actions.includes('APPROVE') && <Button onClick={onApprove} disabled={busy}><Check className="mr-1.5 size-4" aria-hidden />Согласовать</Button>}
        {admin && actions.includes('REJECT') && <Button variant="secondary" onClick={onReject}><X className="mr-1.5 size-4 text-red-500" aria-hidden />Отклонить</Button>}
      </div>
      <section>
        <h2 className="text-base font-bold text-ink">История</h2>
        <RequestHistory history={request.history ?? []} />
      </section>
      {footer}
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-subtle">{label}</p><p className="mt-0.5 text-sm font-semibold text-ink">{value}</p></div>;
}

function RequestHistory({ history }: { history: TeacherRequestHistory[] }) {
  if (!history.length) return <EmptyBlock title="История пуста" />;
  return <ol className="mt-3 space-y-3">{[...history].reverse().map((entry) => <li key={entry.id} className="flex gap-3">
    <span className="mt-1 size-3 shrink-0 rounded-full border-2 border-brand-500 bg-white" aria-hidden />
    <div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-2"><p className="text-sm font-semibold text-ink">{historyTitle(entry.action)}</p><time className="text-xs text-subtle">{formatDateTime(entry.createdAt)}</time></div><p className="text-xs text-muted">{entry.actorName ?? actorRoleLabel(entry.actorRole)}</p>{entry.action === 'REJECTED' && typeof entry.payload?.rejectionReason === 'string' && <p className="mt-1 text-sm text-ink">{entry.payload.rejectionReason}</p>}{entry.action === 'DOCUMENT_ADDED' && typeof entry.payload?.fileName === 'string' && <p className="mt-1 text-sm text-muted">{entry.payload.fileName}</p>}</div>
  </li>)}</ol>;
}

function historyTitle(action?: string) {
  return ({ CREATED: 'Заявка отправлена', EDITED: 'Заявка изменена', CANCELLED: 'Заявка отменена учителем', APPROVED: 'Заявка согласована', REJECTED: 'Заявка отклонена', DOCUMENT_ADDED: 'Документ добавлен', DOCUMENT_REMOVED: 'Документ удалён' } as Record<string, string>)[action ?? ''] ?? 'Событие заявки';
}
function actorRoleLabel(role?: string) { return role === 'TEACHER' ? 'Учитель' : role === 'ADMIN' || role === 'SUPER_ADMIN' ? 'Администратор' : role ?? 'Пользователь'; }
function fileSize(size?: number) { return size == null ? '' : size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} КБ` : `${(size / (1024 * 1024)).toFixed(1)} МБ`; }
