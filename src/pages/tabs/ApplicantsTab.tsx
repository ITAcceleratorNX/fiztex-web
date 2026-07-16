import { useMemo, useState } from 'react';
import { Plus, Pencil, Copy, Check, Users } from 'lucide-react';
import { useApplicants } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ApplicantFormModal } from '@/pages/modals/ApplicantFormModal';
import { formatDate, pluralRu } from '@/lib/format';
import { ApiError, api } from '@/lib/api';
import type { Applicant } from '@/lib/types';

function CopyCode({ code }: { code: string | null }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  if (!code) return <span className="text-sm text-slate-300">—</span>;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code as string);
      setCopied(true);
      toast.success('Код скопирован');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Не удалось скопировать код');
    }
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm font-medium text-slate-700 transition hover:bg-slate-200"
      title="Скопировать код"
    >
      {code}
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
    </button>
  );
}

export function ApplicantsTab() {
  const { data, isLoading, isError, error, refetch, isSuccess } = useApplicants();

  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Applicant | null>(null);

  const grades = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((a) => a.grade && set.add(a.grade));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((a) => {
      const matchQ =
        !q ||
        a.childFullName.toLowerCase().includes(q) ||
        (a.accessCode ?? '').toLowerCase().includes(q);
      const matchGrade = grade === 'ALL' || a.grade === grade;
      return matchQ && matchGrade;
    });
  }, [data, search, grade]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  async function openEdit(a: Applicant) {
    try {
      const fresh = await api.getApplicant(a.id);
      setEditing(fresh);
    } catch {
      setEditing(a);
    }
    setFormOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Поиск по ФИО или коду…" className="w-full max-w-xs" />
        <Select value={grade} onChange={(e) => setGrade(e.target.value)} className="h-11 w-auto">
          <option value="ALL">Класс: Все</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
        <div className="ml-auto">
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Добавить поступающего
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <LoadingBlock label="Загрузка поступающих…" />
        ) : isError ? (
          <ErrorBlock message={error instanceof ApiError ? error.message : 'Ошибка загрузки'} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<Users className="h-7 w-7" />}
            title={data && data.length > 0 ? 'Ничего не найдено' : 'Пока нет поступающих'}
            description={
              data && data.length > 0
                ? 'Измените поиск или фильтр класса.'
                : 'Добавьте поступающего — код сгенерируется автоматически.'
            }
            action={
              data && data.length === 0 ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Добавить поступающего
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3.5">ФИО</th>
                  <th className="px-6 py-3.5">Класс</th>
                  <th className="px-6 py-3.5">Персональный код</th>
                  <th className="px-6 py-3.5">Родитель</th>
                  <th className="px-6 py-3.5">Тесты</th>
                  <th className="px-6 py-3.5">Создан</th>
                  <th className="px-6 py-3.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((a) => (
                  <tr key={a.id} className="transition hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={a.childFullName} />
                        <span className="font-semibold text-slate-800">{a.childFullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{a.grade}</td>
                    <td className="px-6 py-3.5">
                      <CopyCode code={a.accessCode} />
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">
                      {a.parentFullName ? (
                        <div>
                          <p className="text-slate-700">{a.parentFullName}</p>
                          {a.parentPhone && <p className="text-xs text-slate-400">{a.parentPhone}</p>}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {a.assignments.length > 0 ? (
                        <Badge tone="blue">
                          {a.assignments.length} {pluralRu(a.assignments.length, ['тест', 'теста', 'тестов'])}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">{formatDate(a.createdAt)}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => void openEdit(a)}
                          title="Редактировать"
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isSuccess && filtered.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-3 text-sm text-slate-400">
            1–{filtered.length} из {filtered.length}{' '}
            {pluralRu(filtered.length, ['поступающий', 'поступающих', 'поступающих'])}
          </div>
        )}
      </div>

      <ApplicantFormModal open={formOpen} onClose={() => setFormOpen(false)} applicant={editing} />
    </div>
  );
}
