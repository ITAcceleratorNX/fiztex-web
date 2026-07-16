import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ACCOUNT_STATUS_LABELS, PARENT_RELATION_LABELS, SCHOOL_STATUS_LABELS } from '../labels';
import { getParent, unlinkStudent, updateParent } from '../services';
import type { ParentProfile, ParentProfileDetail } from '../types';
import { formatPersonName } from '../types';

export function ParentDetailModal({
  open,
  onClose,
  parent,
  onLink,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  parent: ParentProfile | null;
  onLink: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [detail, setDetail] = useState<ParentProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open || !parent) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEditing(false);
    void getParent(parent.id)
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setLastName(d.lastName);
          setFirstName(d.firstName);
          setMiddleName(d.middleName ?? '');
          setPhone(d.phone);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, parent]);

  async function handleUnlink(studentProfileId: number) {
    if (!parent) return;
    if (!window.confirm('Отвязать ученика?')) return;
    try {
      await unlinkStudent(parent.id, studentProfileId);
      toast.success('Ученик отвязан');
      const next = await getParent(parent.id);
      setDetail(next);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось отвязать');
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!parent) return;
    setPending(true);
    try {
      const updated = await updateParent(parent.id, {
        lastName,
        firstName,
        middleName: middleName || null,
        phone,
      });
      setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditing(false);
      toast.success('Профиль обновлён');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setPending(false);
    }
  }

  const title = parent
    ? formatPersonName(parent.lastName, parent.firstName, parent.middleName)
    : 'Родитель';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
          {!editing && (
            <Button variant="secondary" onClick={() => setEditing(true)} disabled={!detail}>
              Изменить
            </Button>
          )}
          <Button onClick={onLink}>Привязать ученика</Button>
        </>
      }
    >
      {loading && <LoadingBlock label="Загрузка…" />}
      {error && !loading && <ErrorBlock message={error} />}
      {detail && !loading && (
        <div className="space-y-4 text-sm">
          {editing ? (
            <form onSubmit={onSave} className="space-y-3">
              <Field label="Фамилия" required>
                <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </Field>
              <Field label="Имя" required>
                <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </Field>
              <Field label="Отчество">
                <TextInput value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
              </Field>
              <Field label="Телефон" required>
                <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" loading={pending} size="sm">
                  Сохранить
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  Отмена
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-slate-400">Телефон</dt>
                <dd>{detail.phone}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Профиль</dt>
                <dd>{SCHOOL_STATUS_LABELS[detail.status]}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Вход</dt>
                <dd>{ACCOUNT_STATUS_LABELS[detail.accountStatus]}</dd>
              </div>
            </dl>
          )}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Дети
            </h3>
            {detail.linkedStudents.length === 0 ? (
              <EmptyBlock title="Нет привязок" description="Привяжите ученика к родителю." />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {detail.linkedStudents.map((link) => (
                  <li
                    key={`${link.studentProfileId}-${link.relationType}`}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">
                        {formatPersonName(link.lastName, link.firstName, link.middleName)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {PARENT_RELATION_LABELS[link.relationType]} ·{' '}
                        {SCHOOL_STATUS_LABELS[link.linkStatus]}
                      </div>
                    </div>
                    {link.linkStatus === 'ACTIVE' && (
                      <Button
                        variant="secondary"
                        className="!h-8 !px-2.5 !text-xs"
                        onClick={() => void handleUnlink(link.studentProfileId)}
                      >
                        Отвязать
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
