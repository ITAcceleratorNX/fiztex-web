import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { SCHOOL_STATUS_LABELS } from '../labels';
import { mergeSearchParams } from '@/lib/listNavigation';
import { useSchoolSubjects, useSaveSchoolSubject, useArchiveSchoolSubject } from '@/hooks/queries';
import type { SchoolRecordStatus, SchoolSubject } from '../types';
import { useListSearchParams } from '@/hooks/useListNavigation';
import { FORMULA_PROFILES, type FormulaProfile } from '@/lib/formulaProfiles';

export function SchoolSubjectsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useListSearchParams('school-subjects', ['status']);
  const rawStatus = searchParams.get('status');
  const status: SchoolRecordStatus | 'ALL' = rawStatus === 'ALL' || rawStatus === 'ARCHIVED'
    ? rawStatus
    : 'ACTIVE';
  const query = useSchoolSubjects(status);
  const saveSubject = useSaveSchoolSubject();
  const archiveSubject = useArchiveSchoolSubject();
  const items = query.data ?? [];
  const loading = query.isPending;
  const error = query.isError ? 'Не удалось загрузить предметы' : null;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolSubject | null>(null);
  const [name, setName] = useState('');
  const [formulaProfile, setFormulaProfile] = useState<FormulaProfile>('GENERAL');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const next = mergeSearchParams(searchParams, { status: status === 'ACTIVE' ? null : status });
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, status]);

  function openCreate() {
    setEditing(null);
    setName('');
    setFormulaProfile('GENERAL');
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: SchoolSubject) {
    setEditing(item);
    setName(item.name);
    setFormulaProfile(item.formulaProfile ?? 'GENERAL');
    setFormError(null);
    setFormOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    try {
      if (editing) {
        await saveSubject.mutateAsync({id:editing.id,name,formulaProfile});
        toast.success('Предмет обновлён');
      } else {
        await saveSubject.mutateAsync({name,formulaProfile});
        toast.success('Предмет создан');
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setPending(false);
    }
  }

  async function handleArchive(item: SchoolSubject) {
    if (!window.confirm(`Архивировать «${item.name}»?`)) return;
    try {
      await archiveSubject.mutateAsync(item.id);
      toast.success('Предмет архивирован');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось архивировать');
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Единый список предметов школы: используется в расписании, назначениях учителей, а также во
        вступительных тестах и учебных материалах.
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-44">
          <Select
            value={status}
            onChange={(e) => setSearchParams(mergeSearchParams(searchParams, {
              status: e.target.value === 'ACTIVE' ? null : e.target.value,
            }))}
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
      {error && !loading && <ErrorBlock message={error} onRetry={() => void query.refetch()} />}
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
                <th className="px-4 py-3 font-semibold">Формулы</th>
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">{SCHOOL_STATUS_LABELS[item.status]}</td>
                  <td className="px-4 py-3 text-muted">{FORMULA_PROFILES[item.formulaProfile ?? 'GENERAL']}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} disabled={item.status === 'ARCHIVED'}>
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
          <Field label="Профиль формул">
            <Select value={formulaProfile} onChange={(event) => setFormulaProfile(event.target.value as FormulaProfile)}>
              {Object.entries(FORMULA_PROFILES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}
