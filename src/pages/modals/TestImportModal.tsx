import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FileUp } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { Spinner } from '@/components/ui/StateBlock';
import { useImportQuestions, useGenerationJob, keys } from '@/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { pluralRu } from '@/lib/format';
import type { GenerationJobStatus, Test } from '@/lib/types';

const STATUS_LABELS: Record<GenerationJobStatus, string> = {
  PENDING: 'Файл в очереди…',
  RUNNING: 'Распознаём вопросы…',
  DONE: 'Готово',
  FAILED: 'Ошибка импорта',
};

export function TestImportModal({
  open,
  onClose,
  test,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  test: Test;
  onComplete?: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const importQuestions = useImportQuestions();

  const [file, setFile] = useState<File | null>(null);
  const [useAiReader, setUseAiReader] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const handledJobRef = useRef<number | null>(null);

  // Картинку нечем прочитать, кроме разбора страницы: выбора здесь нет, и переключатель
  // только сбивал бы с толку. У Word разбор не нужен вовсе — его структура и так всё несёт.
  const extension = file?.name.split('.').pop()?.toLowerCase() ?? '';
  const isImage = ['png', 'jpg', 'jpeg'].includes(extension);
  const isPdf = extension === 'pdf';

  const { data: job } = useGenerationJob(open ? jobId : null);
  const isImporting = jobId != null && job?.status !== 'DONE' && job?.status !== 'FAILED';

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setUseAiReader(true);
    setError(null);
    setJobId(null);
    handledJobRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!job || handledJobRef.current === job.id) return;
    if (job.status === 'DONE') {
      handledJobRef.current = job.id;
      void qc.invalidateQueries({ queryKey: keys.test(test.id) });
      void qc.invalidateQueries({ queryKey: ['tests'] });
      void qc.invalidateQueries({ queryKey: keys.generationJobs(test.id) });
      const added = job.addedQuestionCount ?? 0;
      const imported = `Импортировано ${added} ${pluralRu(added, ['вопрос', 'вопроса', 'вопросов'])}`;
      if (job.warningMessage) {
        toast.success(`${imported}. ${job.warningMessage}`);
      } else {
        toast.success(imported);
      }
      onComplete?.();
      onClose();
    }
    if (job.status === 'FAILED') {
      handledJobRef.current = job.id;
      setError(job.errorMessage ?? 'Не удалось импортировать вопросы');
      setJobId(null);
    }
  }, [job, test.id, qc, toast, onComplete, onClose]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Выберите файл');
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const created = await importQuestions.mutateAsync({
        testId: test.id,
        formData,
        useAiReader: isImage || (isPdf && useAiReader),
      });
      setJobId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить файл');
    }
  }

  const pending = importQuestions.isPending || isImporting;

  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onClose}
      title="Импорт вопросов из файла"
      subtitle="Готовый тест из Word, PDF, скана или фотографии: вопросы переносятся дословно."
      footer={
        pending ? undefined : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button form="test-import-form" type="submit" icon={<FileUp className="h-4 w-4" />}>
              Импортировать
            </Button>
          </>
        )
      }
    >
      {pending ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Spinner />
          <p className="text-sm font-medium text-slate-700">
            {job ? STATUS_LABELS[job.status] : 'Загружаем файл…'}
          </p>
          <p className="text-xs text-slate-400">
            Обычно 1–3 минуты. Не закрывайте окно.
          </p>
        </div>
      ) : (
        <form id="test-import-form" onSubmit={onSubmit} className="space-y-4">
          <Field label="Файл теста" required hint="DOCX, DOC, RTF, ODT, PDF, TXT, PNG или JPG">
            <input
              type="file"
              accept=".docx,.doc,.rtf,.odt,.pdf,.txt,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </Field>

          {isPdf && (
            <Toggle
              checked={useAiReader}
              onChange={setUseAiReader}
              label="Читать страницы через AI"
              description="Переносит формулы и степени. Без него текст берётся из PDF напрямую — быстрее, но «16³» может приехать как «163»."
            />
          )}

          {isImage && (
            <p className="text-xs text-slate-500">
              Фотографию и скан читает AI — это единственный способ достать из них текст.
            </p>
          )}

          <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-amber-100">
            <p className="font-medium">Правильные ответы придётся отметить вручную.</p>
            <p className="mt-1">
              Если в файле они не размечены, вопросы придут черновиками с пустыми ответами.
              Рисунки и схемы не переносятся: в текст вопроса попадёт их описание, остальное
              дополните руками.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
