import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { useUploadMaterial } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';

export function MaterialUploadModal({
  open,
  onClose,
  subjectId,
}: {
  open: boolean;
  onClose: () => void;
  subjectId: number;
}) {
  const upload = useUploadMaterial(subjectId);
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [visibleToStudents, setVisibleToStudents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setTitle('');
      setTopic('');
      setDescription('');
      setVisibleToStudents(false);
      setError(null);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Выберите файл');
      return;
    }
    if (!title.trim()) {
      setError('Укажите название материала');
      return;
    }

    const formData = new FormData();
    formData.append('subjectId', String(subjectId));
    formData.append('file', file);
    formData.append('title', title.trim());
    if (topic.trim()) formData.append('topic', topic.trim());
    if (description.trim()) formData.append('description', description.trim());
    formData.append('visibleToStudents', String(visibleToStudents));

    try {
      await upload.mutateAsync(formData);
      toast.success('Материал загружен');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить материал');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Загрузить материал"
      subtitle="Поддерживаются PDF, DOCX, PPTX и TXT до 50 МБ."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={upload.isPending}>
            Отмена
          </Button>
          <Button form="material-upload-form" type="submit" loading={upload.isPending}>
            Загрузить
          </Button>
        </>
      }
    >
      <form id="material-upload-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Файл" required error={error && !file ? error : undefined}>
          <input
            type="file"
            accept=".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
        </Field>
        <Field label="Название" required error={error && file && !title.trim() ? error : undefined}>
          <TextInput
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Лекция 1. Кинематика"
            error={Boolean(error && file && !title.trim())}
          />
        </Field>
        <Field label="Тема" hint="Необязательно">
          <TextInput
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Раздел или тема урока"
          />
        </Field>
        <Field label="Описание" hint="Необязательно">
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание материала"
          />
        </Field>
        <Toggle
          checked={visibleToStudents}
          onChange={setVisibleToStudents}
          label="Виден ученикам"
          description="Материал появится в ученической библиотеке после публикации API."
        />
        {error && file && title.trim() && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </form>
    </Modal>
  );
}
