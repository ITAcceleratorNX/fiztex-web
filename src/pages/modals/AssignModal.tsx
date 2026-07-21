import { useMemo, useState } from 'react';
import { Check, Hash, Info, Users, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { CopyCode } from '@/components/ui/CopyCode';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useApplicants, useAssignTest } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { cx, formatDateTime, pluralRu } from '@/lib/format';
import type { Test } from '@/lib/types';

export function AssignModal({
  open,
  onClose,
  test,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  test: Test;
  /** Called (instead of onClose) after at least one applicant was newly assigned. */
  onAssigned: (count: number) => void;
}) {
  const { data, isLoading, isError, error, refetch } = useApplicants();
  const assign = useAssignTest();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [codeSearch, setCodeSearch] = useState('');
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
    const code = codeSearch.trim().toLowerCase();
    return (data ?? []).filter((a) => {
      const matchQ = !q || a.childFullName.toLowerCase().includes(q);
      const matchCode = !code || (a.accessCode ?? '').toLowerCase().includes(code);
      const matchGrade = grade === 'ALL' || a.grade === grade;
      return matchQ && matchCode && matchGrade;
    });
  }, [data, search, codeSearch, grade]);

  const selectedApplicants = useMemo(
    () => (data ?? []).filter((a) => selected.has(a.id)),
    [data, selected],
  );

  function resetFilters() {
    setSearch('');
    setCodeSearch('');
    setGrade('ALL');
  }

  function toggle(id: number) {
    if (assignedIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleClose() {
    setSelected(new Set());
    onClose();
  }

  async function submit() {
    if (selected.size === 0) return;
    try {
      const result = await assign.mutateAsync({ id: test.id, applicantIds: Array.from(selected) });
      const created = result.created.length;
      const skipped = result.skipped.length;
      setSelected(new Set());
      if (created > 0) {
        onAssigned(created);
      } else {
        if (skipped > 0) toast.info('Выбранные поступающие уже назначены на эту версию теста');
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось назначить тест');
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="2xl"
      title="Назначить поступающих"
      subtitle="Выберите одного или нескольких поступающих для назначения данного теста. При назначении фиксируется текущая версия теста."
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="secondary" onClick={handleClose} disabled={assign.isPending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={assign.isPending} disabled={selected.size === 0}>
            Назначить поступающих
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Поиск по ФИО…" className="w-full max-w-[220px]" />
            <div className="relative w-full max-w-[200px]">
              <Hash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value)}
                placeholder="Персональный код…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30"
              />
            </div>
            <Select value={grade} onChange={(e) => setGrade(e.target.value)} className="h-11 w-auto">
              <option value="ALL">Класс: Все</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-medium text-slate-500 underline-offset-2 transition hover:text-brand-600 hover:underline"
            >
              Сбросить
            </button>
          </div>

          <div className="max-h-[42vh] overflow-y-auto rounded-xl ring-1 ring-slate-200">
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
              <table className="w-full">
                <thead>
                  <tr className="sticky top-0 border-b border-slate-100 bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">ФИО</th>
                    <th className="px-4 py-3">Класс</th>
                    <th className="px-4 py-3">Код</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((a) => {
                    const isAssigned = assignedIds.has(a.id);
                    const isSelected = selected.has(a.id);
                    return (
                      <tr
                        key={a.id}
                        onClick={() => toggle(a.id)}
                        className={cx(
                          'transition',
                          isAssigned ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50',
                          isSelected && 'bg-sky-50 hover:bg-sky-50',
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
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
                            <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                              {a.childFullName}
                            </span>
                            {isAssigned && (
                              <span className="ml-1 shrink-0 text-xs font-medium text-emerald-600">Назначен</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{a.grade}</td>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <CopyCode code={a.accessCode} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Выбрано</p>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">
                {selected.size}
              </span>
            </div>
            {selectedApplicants.length === 0 ? (
              <p className="text-sm text-slate-400">Никто не выбран</p>
            ) : (
              <ul className="space-y-1.5">
                {selectedApplicants.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  >
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span className="min-w-0 flex-1 truncate">{a.childFullName}</span>
                    <button
                      type="button"
                      onClick={() => toggle(a.id)}
                      className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Тест</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{test.title}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Назначаемая версия</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
              <span className="inline-flex items-center rounded-md bg-navy-700 px-2 py-0.5 text-xs font-semibold text-white">
                v{test.currentVersionNumber ?? 1}
              </span>
              · {formatDateTime(test.currentVersionCreatedAt)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Количество выбранных</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {selected.size} {pluralRu(selected.size, ['поступающий', 'поступающих', 'поступающих'])}
            </p>
          </div>

          <div className="flex gap-2.5 rounded-xl bg-sky-50 px-3.5 py-3 ring-1 ring-sky-100">
            <Info className="h-4 w-4 shrink-0 text-sky-500" />
            <p className="text-xs text-sky-700">
              После назначения каждому поступающему будет зафиксирована текущая версия теста.
              Дальнейшие изменения теста не изменят уже назначенную версию.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
