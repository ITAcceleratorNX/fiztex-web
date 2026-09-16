import { useEffect, useState } from 'react';
import { Check, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useEquipmentRecipients, useIssueEquipment, useTransferEquipment } from '@/hooks/queries';
import { ROLE_LABELS } from '@/platform/labels';
import { cx } from '@/lib/format';
import { conflictRows, errorMessage } from './equipmentModel';

/**
 * Выдача и передача — одно окно (ТЗ §7.2, §7.4).
 *
 * <p>Вопрос у них общий и единственный: кому. Передача отличается тем, что прежний
 * держатель из списка убран — «передать тому же» сервер отклонит, и предлагать это в
 * интерфейсе незачем.
 *
 * <p>Комментарий необязателен: в нём указывают срок возврата и назначение — отдельного
 * поля срока в MVP нет (§12).
 */
export function EquipmentIssueModal({
  open,
  onClose,
  mode,
  unitIds,
  subtitle,
  excludeAccountId,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'issue' | 'transfer';
  unitIds: number[];
  subtitle: string;
  /** Текущий держатель при передаче — ему же передавать нечего. */
  excludeAccountId?: number;
}) {
  const toast = useToast();
  const issue = useIssueEquipment();
  const transfer = useTransferEquipment();

  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim());
  const [holderId, setHolderId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recipients = useEquipmentRecipients(search, open);
  const rows = (recipients.data ?? []).filter((row) => row.accountId !== excludeAccountId);
  const pending = issue.isPending || transfer.isPending;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHolderId(null);
    setComment('');
    setError(null);
  }, [open]);

  async function submit() {
    if (holderId == null || unitIds.length === 0) return;
    setError(null);
    const body = { unitIds, holderAccountId: holderId, comment: comment.trim() || undefined };
    try {
      if (mode === 'transfer') {
        await transfer.mutateAsync(body);
        toast.success('Техника передана');
      } else {
        await issue.mutateAsync(body);
        toast.success(unitIds.length === 1 ? 'Техника выдана' : `Выдано экземпляров: ${unitIds.length}`);
      }
      onClose();
    } catch (err) {
      // Пакет проходит целиком или не проходит вовсе — показываем, что именно помешало,
      // а не «попробуйте ещё раз»: у строк разные поводы и разные следующие шаги.
      const conflicts = conflictRows(err);
      setError(
        conflicts.length > 0
          ? conflicts.map((row) => `${row.inventoryNumber ?? ''}: ${row.message ?? ''}`).join('; ')
          : errorMessage(err, 'Не удалось выдать технику'),
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={pending ? () => undefined : onClose}
      title={mode === 'transfer' ? 'Передать другому сотруднику' : 'Выдать технику'}
      subtitle={subtitle}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={pending} disabled={holderId == null}>
            {mode === 'transfer' ? 'Передать' : 'Выдать'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <NoticeBar tone="warning">{error}</NoticeBar>}

        <SearchInput value={query} onChange={setQuery} placeholder="Поиск сотрудника" />

        <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
          {recipients.isPending ? (
            <LoadingBlock />
          ) : recipients.isError ? (
            <ErrorBlock
              message={errorMessage(recipients.error, 'Не удалось загрузить сотрудников')}
              onRetry={() => void recipients.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyBlock
              icon={<User className="h-7 w-7" />}
              title="Никого не нашли"
              description="Технику выдают только активным сотрудникам школы."
            />
          ) : (
            rows.map((row) => {
              const selected = row.accountId === holderId;
              return (
                <button
                  key={row.accountId}
                  type="button"
                  onClick={() => setHolderId(row.accountId ?? null)}
                  className={cx(
                    'flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0',
                    selected ? 'bg-brand-50' : 'hover:bg-slate-50',
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {row.fullName}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {ROLE_LABELS[row.role as keyof typeof ROLE_LABELS] ?? row.role}
                    </span>
                  </span>
                  {selected && <Check className="h-4 w-4 text-brand-500" />}
                </button>
              );
            })
          )}
        </div>

        <Field label="Комментарий" hint="Срок возврата, назначение или условия — необязательно">
          <TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            placeholder="Например: вернуть до 20 сентября"
          />
        </Field>
      </div>
    </Modal>
  );
}
