import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { listAccountsByRoles, listUsersPage } from '../services';
import { ROLE_LABELS } from '../labels';
import type { AccountRole, PlatformUser } from '../types';

/**
 * Выбор человека для фильтра «Автор» и «Текущий исполнитель» (ТЗ SERVICE-FE-004 §6).
 *
 * Выпадающим поиском, а не списком всех аккаунтов: автором заявки может быть кто угодно
 * в школе, и выбор из тысячи строк — не фильтр, а вторая задача. Исполнитель, наоборот,
 * ищется среди двух служебных ролей, поэтому там список открывается сразу, ещё до ввода.
 *
 * Наружу отдаётся не только идентификатор, но и имя: фильтр показывает выбранного
 * человека, а второй запрос за его именем ради подписи был бы лишним.
 */
export interface PickedAccount {
  id: number;
  fullName: string;
}

export function AccountPicker({
  label,
  placeholder,
  roles,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  /** Ограничение по ролям; без него ищем по всем аккаунтам. */
  roles?: readonly AccountRole[];
  value: PickedAccount | null;
  onChange: (next: PickedAccount | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query);

  // Без ограничения по ролям поиск идёт по всем аккаунтам школы, и выдача по пустому
  // вводу была бы случайными двадцатью людьми. Со списком служебных ролей — наоборот:
  // их десятки, и показать сразу всех полезнее, чем требовать ввода.
  const enabled = open && (roles != null || search.trim().length >= 2);

  const options = useQuery({
    queryKey: ['accounts', 'picker', roles ?? null, search.trim()],
    queryFn: async () => {
      if (roles) return listAccountsByRoles(roles, { query: search.trim() || undefined });
      const page = await listUsersPage({ query: search.trim(), size: 10 });
      return page.users;
    },
    enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const rows = options.data ?? [];

  function pick(user: PlatformUser) {
    onChange({ id: Number(user.id), fullName: user.fullName });
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="label-base">{label}</label>

      {value ? (
        <div className="input-base flex items-center justify-between gap-2">
          <span className="truncate text-slate-800">{value.fullName}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Сбросить фильтр «${label}»`}
            className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="input-base flex items-center gap-2">
          <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
          <input
            value={query}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
      )}

      {open && !value && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xl bg-white py-1 shadow-pop ring-1 ring-slate-200/80"
        >
          {!enabled ? (
            <li className="px-3.5 py-2.5 text-13 text-slate-400">Введите хотя бы два символа</li>
          ) : options.isPending ? (
            <li className="px-3.5 py-2.5 text-13 text-slate-400">Поиск…</li>
          ) : options.isError ? (
            <li className="px-3.5 py-2.5 text-13 text-slate-400">Не удалось загрузить список</li>
          ) : rows.length === 0 ? (
            <li className="px-3.5 py-2.5 text-13 text-slate-400">Никого не найдено</li>
          ) : (
            rows.map((user) => (
              <li key={user.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => pick(user)}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <span className="truncate">{user.fullName}</span>
                  <span className="shrink-0 text-11 text-slate-400">{ROLE_LABELS[user.role]}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
