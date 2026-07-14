import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { formatDateTime } from '@/lib/format';
import { CREDENTIAL_STATUS_LABELS, ROLE_LABELS } from '../labels';
import {
  exportAccessCodesCsv,
  listAccessCodes,
  reissueCode,
  resetAccess,
  resetPin,
} from '../services';
import type { AccessCodeRow } from '../types';

type PendingAction = {
  type: 'resetPin' | 'reissue' | 'resetAccess';
  code: AccessCodeRow;
};

const ACTION_COPY: Record<
  PendingAction['type'],
  { title: string; message: string; confirm: string; danger?: boolean }
> = {
  resetPin: {
    title: 'Сбросить PIN?',
    message: 'Пользователю потребуется новый PIN при следующем входе. Это mock-действие.',
    confirm: 'Сбросить PIN',
  },
  reissue: {
    title: 'Перевыпустить код?',
    message: 'Текущий код станет «Перевыпущен», будет создан новый активный код (mock).',
    confirm: 'Перевыпустить',
  },
  resetAccess: {
    title: 'Сбросить доступ?',
    message: 'Код будет заблокирован. Пользователь не сможет войти, пока код не перевыпустят.',
    confirm: 'Сбросить доступ',
    danger: true,
  },
};

export function AccessCodesPage() {
  const toast = useToast();
  const [codes, setCodes] = useState<AccessCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCodes(await listAccessCodes());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить коды');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function confirmAction() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.type === 'resetPin') {
        await resetPin(pending.code.id);
        toast.success('PIN сброшен (mock)');
      } else if (pending.type === 'reissue') {
        await reissueCode(pending.code.id);
        toast.success('Код перевыпущен (mock)');
      } else {
        await resetAccess(pending.code.id);
        toast.success('Доступ сброшен, код заблокирован (mock)');
      }
      setPending(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Действие не выполнено');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    try {
      const { fileName, content } = await exportAccessCodesCsv();
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('CSV экспортирован (заготовка под backend-экспорт)');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось экспортировать');
    }
  }

  const copy = pending ? ACTION_COPY[pending.type] : null;

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Коды доступа и статусы на mock data. Действия меняют локальный store — без реального
        backend.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="h-4 w-4" />}
          onClick={() => void handleExport()}
          disabled={loading || codes.length === 0}
        >
          Экспорт кодов
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reload()} />}
      {!loading && !error && codes.length === 0 && (
        <div className="card">
          <EmptyBlock
            title="Кодов доступа пока нет"
            description="Коды появятся после создания учеников и родителей."
          />
        </div>
      )}
      {!loading && !error && codes.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Пользователь</th>
                <th className="px-4 py-3 font-semibold">Роль</th>
                <th className="px-4 py-3 font-semibold">Код</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Выдан</th>
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <tr key={code.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{code.userFullName}</td>
                  <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[code.role]}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{code.codeHint}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {CREDENTIAL_STATUS_LABELS[code.status]}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(code.issuedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPending({ type: 'resetPin', code })}
                        disabled={code.status === 'BLOCKED'}
                      >
                        Сбросить PIN
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPending({ type: 'reissue', code })}
                      >
                        Перевыпустить
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPending({ type: 'resetAccess', code })}
                        disabled={code.status === 'BLOCKED'}
                      >
                        Сбросить доступ
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => !busy && setPending(null)}
        onConfirm={() => void confirmAction()}
        title={copy?.title ?? ''}
        message={
          pending ? (
            <>
              {copy?.message}
              <br />
              <span className="mt-2 inline-block font-medium text-slate-800">
                {pending.code.userFullName} · {pending.code.codeHint}
              </span>
            </>
          ) : null
        }
        confirmLabel={copy?.confirm}
        danger={copy?.danger}
        loading={busy}
      />
    </div>
  );
}
