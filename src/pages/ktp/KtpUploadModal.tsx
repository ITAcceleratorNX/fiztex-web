import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { LoadingBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useKtpCommand, useKtpContext } from '@/hooks/queries';
import { ktpApi } from '@/lib/ktpApi';
import { ktpPaths } from '@/lib/ktpModel';
import type { Schema } from '@/lib/apiSchemas';
import { ktpError } from './KtpShared';

export function KtpUploadModal({ onClose, initial }: { onClose: () => void; initial?: Schema<'KtpUploadContext'> }) {
  const context = useKtpContext();
  const upload = useKtpCommand(ktpApi.upload);
  const navigate = useNavigate();
  const [year, setYear] = useState(String(initial?.academicYearId ?? ''));
  const [subject, setSubject] = useState(String(initial?.subjectId ?? ''));
  const [classes, setClasses] = useState((initial?.classIds ?? []).map(String));
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const assignments = context.data?.assignments ?? [];
  const years = [...new Map(assignments.map(a => [String(a.academicYearId), a.academicYear])).entries()];
  const selectedYear = year || years[0]?.[0] || '';
  const available = assignments.filter(a => String(a.academicYearId) === selectedYear);
  const subjects = [...new Map(available.map(a => [String(a.subjectId), a.subject])).entries()];
  const classOptions = available.filter(a => String(a.subjectId) === subject).map(a => ({ value: String(a.classId), label: a.className ?? '' }));
  const valid = !!file && !fileError && !!selectedYear && !!subject && classes.length > 0;
  function choose(next: File | null) {
    setFile(next);
    setFileError(next && !/\.(docx|xlsx)$/i.test(next.name) ? 'Загрузите .docx или .xlsx с таблицей: № · Раздел · Тема урока · Кол-во часов.'
      : next && next.size > (context.data?.maxFileBytes ?? 0) ? `Максимальный размер файла — ${Math.floor((context.data?.maxFileBytes ?? 0) / 1024 / 1024)} МБ` : '');
  }
  async function save() {
    if (!valid || !file) return;
    try {
      const result = await upload.mutateAsync({ file, context: { academicYearId: Number(selectedYear), subjectId: Number(subject), classIds: classes.map(Number) } });
      if (result.id) { onClose(); navigate(ktpPaths.import(result.id)); }
    } catch { /* Keep the selected file and idempotency key for retry. */ }
  }
  return <Modal open onClose={() => { if (!upload.isPending) onClose(); }} title={initial ? 'Загрузить новую версию КТП' : 'Загрузить КТП'} size={initial ? 'planning-version-upload' : 'planning'} appearance={initial ? 'planning-wide' : 'planning'} scrollable
    footer={<><Button variant="ghost" disabled={upload.isPending} onClick={onClose}>Отмена</Button><Button variant="primary" disabled={!valid} loading={upload.isPending} onClick={() => void save()}>Загрузить файл</Button></>}>
    {context.isPending ? <LoadingBlock /> : context.isError ? <ErrorBlock message={ktpError(context.error)} onRetry={() => void context.refetch()} /> : <div className="space-y-4 [&_.input-base]:min-h-12">
      {initial ? <><p className="text-sm leading-relaxed text-planning-muted">Текущая версия продолжит работать, пока вы не подтвердите новую.</p><div className="grid gap-3 sm:grid-cols-3">
        <Field label="Предмет"><TextInput disabled value={subjects.find(([id]) => id === subject)?.[1] ?? ''} /></Field>
        <Field label="Классы"><TextInput disabled value={classOptions.filter(value => classes.includes(value.value)).map(value => value.label).join(', ')} /></Field>
        <Field label="Учебный год"><TextInput disabled value={years.find(([id]) => id === selectedYear)?.[1] ?? ''} /></Field>
      </div></> : <>
        <Field label="Учебный год" required><Select value={selectedYear} disabled={upload.isPending} onChange={event => { setYear(event.target.value); setSubject(''); setClasses([]); }}>{years.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></Field>
        <Field label="Предмет" required hint="Только предметы, которые вы ведёте"><Select value={subject} disabled={upload.isPending} onChange={event => { setSubject(event.target.value); setClasses([]); }}><option value="">Выберите предмет</option>{subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></Field>
        <Field label="Класс(ы)" required hint="Один файл можно применить к нескольким классам. Прогресс у каждого класса будет свой."><MultiSelect options={classOptions} value={classes} onChange={setClasses} disabled={!subject || upload.isPending} placeholder={subject ? 'Выберите классы' : 'Сначала выберите предмет'} /></Field>
      </>}
      <Field label="Файл КТП (DOCX или XLSX)" required error={fileError} hint="Исходный файл сохранится отдельно — правки при проверке его не меняют."><FileDropzone appearance="planning" file={file} onChange={choose} accept=".docx,.xlsx" formatsLabel="DOCX, XLSX" disabled={upload.isPending} error={!!fileError} /></Field>
      {initial && <p className="text-xs leading-relaxed text-planning-muted">Файл пройдёт ту же проверку, что и при первой загрузке. После неё вы увидите, что изменилось.</p>}
      {!assignments.length && <StatusNotice tone="warning">Только предметы, которые вы ведёте</StatusNotice>}
      {upload.isError && <StatusNotice tone="error">{ktpError(upload.error)}</StatusNotice>}
    </div>}
  </Modal>;
}
