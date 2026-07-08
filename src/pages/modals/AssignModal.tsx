import { useMemo, useState } from 'react';
import { Check, Users } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useApplicants, useAssignTest } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { cx, pluralRu } from '@/lib/format';
import type { Test } from '@/lib/types';

export function AssignModal({
  open,
  onClose,
  test,
}: {
  open: boolean;
  onClose: () => void;
  test: Test;
}) {
  const { data, isLoading, isError, error, refetch } = useApplicants();
  const assign = useAssignTest();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('ALL');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const grades = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((a) => a.grade && set.add(a.grade));
    return Array.from(set).sort();
  }, [data]);

  // Applicants already assigned to the current version cannot be re-added.
  const assignedIds = useMemo(
    () => new Set(test.assignments.filter((a) => a.versionNumber === test.currentVersionNumber).map((a) => a.applicantId)),
    [test.assignments, test.currentVersionNumber],
  );

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

  function toggle(id: number) {
    if (assignedIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) return;
    try {
      const result = await assign.mutateAsync({ id: test.id, applicantIds: Array.from(selected) });
      const created = result.created.length;
      const skipped = result.skipped.length;
      if (created > 0) {
        toast.success(
          `Назначено: ${created} ${pluralRu(created, ['поступающий', 'поступающих', 'поступающих'])}` +
            (skipped > 0 ? `, пропущено: ${skipped}` : ''),
        );
      } else if (skipped > 0) {
        toast.info('Выбранные поступающие уже назначены на эту версию теста');
      }
      setSelected(new Set());
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось назначить тест');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Назначить поступающих"
      subtitle={`${test.title} · Версия ${test.currentVersionNumber ?? 1}`}
      footer={
        <>
          <span className="mr-auto text-sm text-slate-500">
            Выбрано: <b className="text-slate-700">{selected.size}</b>
          </span>
          <Button variant="secondary" onClick={onClose} disabled={assign.isPending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={assign.isPending} disabled={selected.size === 0}>
            Назначить
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по ФИО или коду…"
          className="w-full max-w-xs"
        />
        <Select value={grade} onChange={(e) => setGrade(e.target.value)} className="h-11 w-auto">
          <option value="ALL">Класс: Все</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </div>

      <div className="max-h-[46vh] overflow-y-auto rounded-xl ring-1 ring-slate-200">
        {isLoading ? (
          <LoadingBlock label="Загрузка поступающих…" />
        ) : isError ? (
          <ErrorBlock message={error instanceof ApiError ? error.message : 'Ошибка загрузки'} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<Users className="h-7 w-7" />}
            title="Поступающие не найдены"
            description="Измените поиск или добавьте поступающих во вкладке «Поступающие»."
          />
        ) : (
          <ul className="divide-y divide-slate-50">
            {filtered.map((a) => {
              const isAssigned = assignedIds.has(a.id);
              const isSelected = selected.has(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => toggle(a.id)}
                    disabled={isAssigned}
                    className={cx(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition',
                      isAssigned ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cx(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
                        isSelected
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-slate-300 bg-white',
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <Avatar name={a.childFullName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800">{a.childFullName}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {a.grade} · {a.accessCode ?? 'без кода'}
                      </span>
                    </span>
                    {isAssigned && <span className="text-xs font-medium text-emerald-600">Назначен</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
