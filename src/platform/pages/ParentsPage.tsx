import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { SCHOOL_STATUS_LABELS } from '../labels';
import { CreateParentModal } from '../modals/CreateParentModal';
import { LinkStudentModal } from '../modals/LinkStudentModal';
import { ParentDetailModal } from '../modals/ParentDetailModal';
import { listParents } from '../services';
import type { ParentProfile } from '../types';
import { formatPersonName } from '../types';

export function ParentsPage() {
  const [query, setQuery] = useState('');
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<ParentProfile | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listParents({ name: query.trim() || undefined });
      setParents(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить родителей');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const handle = window.setTimeout(() => void reload(), query ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [reload, query]);

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Родитель создаётся с аккаунтом (нужен телефон). Затем привяжите учеников.
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder="Поиск по ФИО"
        />
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Создать
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reload()} />}
      {!loading && !error && parents.length === 0 && (
        <div className="card">
          <EmptyBlock title="Родителей нет" description="Создайте родителя или импортируйте." />
        </div>
      )}
      {!loading && !error && parents.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">ФИО</th>
                <th className="px-4 py-3 font-semibold">Телефон</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <button
                      type="button"
                      className="text-left hover:text-brand-600"
                      onClick={() => {
                        setSelected(p);
                        setDetailOpen(true);
                      }}
                    >
                      {formatPersonName(p.lastName, p.firstName, p.middleName)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{SCHOOL_STATUS_LABELS[p.status]}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="secondary"
                      className="!h-8 !px-2.5 !text-xs"
                      onClick={() => {
                        setSelected(p);
                        setLinkOpen(true);
                      }}
                    >
                      Привязать
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateParentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void reload()}
      />
      <LinkStudentModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        parent={selected}
        onSaved={() => void reload()}
      />
      <ParentDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        parent={selected}
        onLink={() => {
          setDetailOpen(false);
          setLinkOpen(true);
        }}
        onChanged={() => void reload()}
      />
    </div>
  );
}
