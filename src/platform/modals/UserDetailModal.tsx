import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/format';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from '../labels';
import type { PlatformUser } from '../types';

export function UserDetailModal({
  open,
  onClose,
  user,
  onEdit,
  onBlock,
  onUnblock,
  onArchive,
}: {
  open: boolean;
  onClose: () => void;
  user: PlatformUser | null;
  onEdit: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onArchive: () => void;
}) {
  if (!user) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user.fullName}
      subtitle={ROLE_LABELS[user.role]}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
          <Button variant="ghost" onClick={onEdit}>
            Редактировать
          </Button>
          {user.status === 'BLOCKED' ? (
            <Button onClick={onUnblock}>Разблокировать</Button>
          ) : user.status !== 'ARCHIVED' ? (
            <Button variant="danger" onClick={onBlock}>
              Заблокировать
            </Button>
          ) : null}
          {user.status !== 'ARCHIVED' && (
            <Button variant="ghost" onClick={onArchive}>
              Архив
            </Button>
          )}
        </>
      }
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Статус</dt>
          <dd className="mt-1 font-medium text-slate-800">{ACCOUNT_STATUS_LABELS[user.status]}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Связи</dt>
          <dd className="mt-1 font-medium text-slate-800">{user.relationLabel ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Телефон</dt>
          <dd className="mt-1 font-medium text-slate-800">{user.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
          <dd className="mt-1 font-medium text-slate-800">{user.email ?? '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-400">Создан</dt>
          <dd className="mt-1 font-medium text-slate-800">{formatDateTime(user.createdAt)}</dd>
        </div>
      </dl>
    </Modal>
  );
}
