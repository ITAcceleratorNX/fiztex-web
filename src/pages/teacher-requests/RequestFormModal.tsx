import { useEffect, useState } from 'react';
import { CalendarDays, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DateRangePicker, rangesOverlap } from '@/components/ui/DateRangePicker';
import { Field, TextArea } from '@/components/ui/Field';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Modal } from '@/components/ui/Modal';
import { useCreateTeacherRequest, useTeacherRequestOccupiedRanges, useUpdateTeacherRequest, useUploadTeacherRequestDocument } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { isSupportedTeacherRequestFile, TEACHER_REQUEST_FILE_ACCEPT, TEACHER_REQUEST_MAX_FILE_SIZE, TEACHER_REQUEST_TYPE, type TeacherRequest, type TeacherRequestInput, type TeacherRequestType } from '@/lib/teacherRequestsApi';

export function RequestFormModal({
  open,
  request,
  onClose,
  onSaved,
}: {
  open: boolean;
  request?: TeacherRequest;
  onClose: () => void;
  onSaved: (saved: TeacherRequest) => void;
}) {
  const toast = useToast();
  const create = useCreateTeacherRequest();
  const update = useUpdateTeacherRequest();
  const upload = useUploadTeacherRequestDocument();
  const isEditing = request != null;
  const occupiedQuery = useTeacherRequestOccupiedRanges(open && !isEditing);
  const [type, setType] = useState<TeacherRequestType>('RELEASE');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const pending = create.isPending || update.isPending || upload.isPending;
  const occupiedRanges = (occupiedQuery.data ?? [])
    .filter((range) => range.id !== request?.id)
    .map(({ from, to }) => ({ from, to }));
  const overlaps = rangesOverlap(dateFrom, dateTo || dateFrom, occupiedRanges);

  useEffect(() => {
    if (!open) return;
    setType(request?.type ?? 'RELEASE');
    setDateFrom(request?.dateFrom ?? '');
    setDateTo(request?.dateTo ?? '');
    setReason(request?.reason ?? '');
    setFile(null);
    setError('');
  }, [open, request]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const normalizedReason = reason.trim();
    if (!dateFrom || !dateTo || !normalizedReason) {
      setError('Заполните тип, даты отсутствия и причину.');
      return;
    }
    if (dateFrom > dateTo) {
      setError('Дата начала должна быть не позже даты окончания.');
      return;
    }
    if (file && !isSupportedTeacherRequestFile(file)) {
      setError(file.size > TEACHER_REQUEST_MAX_FILE_SIZE
        ? 'Размер файла не должен превышать 10 МБ.'
        : 'Поддерживаются PDF, JPG, PNG и HEIC.');
      return;
    }
    if (overlaps) {
      setError('Выбранный период пересекается с другой активной заявкой. Выберите другие даты.');
      return;
    }
    const input: TeacherRequestInput = { type, dateFrom, dateTo, reason: normalizedReason };
    try {
      const saved = isEditing
        ? await update.mutateAsync({ id: request.id!, input })
        : await create.mutateAsync(input);
      if (file && saved.id != null) {
        try {
          await upload.mutateAsync({ id: saved.id, file });
        } catch (uploadCause) {
          toast.error(uploadCause instanceof Error ? uploadCause.message : 'Заявка сохранена, но документ загрузить не удалось');
        }
      }
      if (isEditing) toast.success('Изменения сохранены');
      else toast.success('Заявка отправлена', 'Администратор рассмотрит её и пришлёт уведомление.');
      onSaved(saved);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Не удалось сохранить заявку';
      setError(message);
      toast.error(message);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!pending) onClose(); }}
      title={isEditing ? 'Редактировать заявку' : 'Новая заявка'}
      subtitle="Освобождение или больничный"
      size="md"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Отмена</Button>
          <Button type="submit" form="teacher-request-form" loading={pending} disabled={pending || (occupiedQuery.isPending && !occupiedQuery.isError) || overlaps}>
            {isEditing ? 'Сохранить изменения' : 'Отправить заявку'}
          </Button>
        </div>
      )}
    >
      <form id="teacher-request-form" className="space-y-4" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={pending}>
          <legend className="label-base mb-2">Тип заявки</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['RELEASE', 'SICK_LEAVE'] as const).map((value) => {
              const selected = type === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setType(value)}
                  className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${selected ? 'border-navy-700 bg-indigo-50 text-navy-700' : 'border-line bg-white text-ink hover:bg-slate-50'}`}
                >
                  {value === 'RELEASE' ? <CalendarDays className="size-4" aria-hidden /> : <Stethoscope className="size-4" aria-hidden />}
                  {TEACHER_REQUEST_TYPE[value]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="Даты отсутствия" required>
          <DateRangePicker value={{ from: dateFrom, to: dateTo }} onChange={(value) => { setDateFrom(value.from); setDateTo(value.to); setError(''); }} occupiedRanges={occupiedRanges} error={overlaps} disabled={occupiedQuery.isPending && !occupiedQuery.isError} />
          {overlaps && <p role="alert" className="mt-1 text-xs text-red-600">Даты пересекаются с другой активной заявкой.</p>}
          {occupiedQuery.isError && <p role="status" className="mt-1 text-xs text-muted">Занятые даты проверить не удалось. Сервер проверит пересечение при отправке.</p>}
        </Field>
        <Field label="Причина" required>
          <TextArea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Например: семейные обстоятельства" rows={3} />
        </Field>
        <Field label="Документы" hint="Необязательно. Документ можно добавить и позже, в том числе после согласования.">
          <FileDropzone file={file} onChange={setFile} accept={TEACHER_REQUEST_FILE_ACCEPT} formatsLabel="PDF, JPG, PNG, HEIC · до 10 МБ" appearance="planning" />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}
