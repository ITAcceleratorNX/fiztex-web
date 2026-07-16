import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { SCHOOL_STATUS_LABELS } from '../labels';
import {
  archiveSchoolSubject,
  createSchoolSubject,
  listSchoolSubjects,
  updateSchoolSubject,
} from '../services';
import type { SchoolRecordStatus, SchoolSubject } from '../types';

export function SchoolSubjectsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<SchoolRecordStatus | 'ALL'>('ACTIVE');
  const [items, setItems] = useState<SchoolSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolSubject | null>(null);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listSchoolSubjects({ status }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить предметы');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openCreate() {
    setEditing(null);
    setName('');
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: SchoolSubject) {
    setEditing(item);
    setName(item.name);
    setFormError(null);
    setFormOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    try {
      if (editing) {
        await updateSchoolSubject(editing.id, name);
        toast.success('Предмет обновлён');
      } else {
        await createSchoolSubject(name);
        toast.success('Предмет создан');
      }
      setFormOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setPending(false);
    }
  }

  async function handleArchive(item: SchoolSubject) {
    if (!window.confirm(`Архивировать «${item.name}»?`)) return;
    try {
      await archiveSchoolSubject(item.id);
      toast.success('Предмет архивирован');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось архивировать');
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Школьные предметы (`school_subjects`) для назначений учителей и расписания. Не путать с
        предметами вступительных на `/subjects`.
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-44">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as SchoolRecordStatus | 'ALL')}
          >
            <option value="ALL">Все</option>
            <option value="ACTIVE">Активные</option>
            <option value="ARCHIVED">Архив</option>
          </Select>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Создать предмет
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reload()} />}
      {!loading && !error && items.length === 0 && (
        <div className="card">
          <EmptyBlock
            title="Предметов нет"
            description="Создайте «Физика», «Математика» и т.д. — они появятся в назначении учителя."
          />
        </div>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Название</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">{SCHOOL_STATUS_LABELS[item.status]}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                        Изменить
                      </Button>
                      {item.status === 'ACTIVE' && (
                        <Button variant="ghost" size="sm" onClick={() => void handleArchive(item)}>
                          Архив
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Редактировать предмет' : 'Создать предмет'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={pending}>
              Отмена
            </Button>
            <Button onClick={onSubmit} loading={pending}>
              Сохранить
            </Button>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Название" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}
