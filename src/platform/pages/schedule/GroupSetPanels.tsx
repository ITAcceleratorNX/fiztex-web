import { useState } from 'react';
import { ArrowUpDown, Plus, Search, Trash2 } from 'lucide-react';
import { cx, pluralRu } from '@/lib/format';
import type { Subgroup, SubgroupStudent } from '@/lib/schedule2bTypes';
import { StudentActionMenu, type StudentMenuAction } from './StudentActionMenu';
import {
  avatarTone,
  sortStudentsByName,
  studentInitials,
  studentShortName,
} from './subgroupHelpers';

/** Аватар с инициалами: 32px в списке класса, 28px в карточке группы. */
function StudentAvatar({
  student,
  size,
}: {
  student: SubgroupStudent;
  size: 28 | 32;
}) {
  return (
    <span
      aria-hidden
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-ink',
        avatarTone(student.studentId),
        size === 32 ? 'size-8 text-xs' : 'size-7 text-11',
      )}
    >
      {studentInitials(student)}
    </span>
  );
}

/**
 * Левая карточка «Все ученики» — Figma 2015:12113: 320px, radius 16, p 20.
 * Распределённые ученики зачёркнуты и приглушены (2015:12127).
 */
export function ClassRosterCard({
  students,
  assignedIds,
  subgroups,
  search,
  onSearchChange,
  onSplit,
  splitDisabled,
  onAssign,
  disabled,
}: {
  students: SubgroupStudent[];
  assignedIds: Set<number>;
  subgroups: Subgroup[];
  search: string;
  onSearchChange: (value: string) => void;
  onSplit: () => void;
  splitDisabled?: boolean;
  onAssign: (studentId: number, targetSubgroupId: number) => void;
  disabled?: boolean;
}) {
  const query = search.trim().toLocaleLowerCase('ru');
  const visible = sortStudentsByName(students).filter((s) =>
    query ? studentShortName(s).toLocaleLowerCase('ru').includes(query) : true,
  );
  const unassignedCount = students.filter((s) => !assignedIds.has(s.studentId)).length;

  return (
    <section className="flex w-[320px] shrink-0 flex-col gap-4 self-start rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-ink">Все ученики</h2>
        {unassignedCount > 0 && (
          <span className="rounded-md bg-warning-bg px-2 py-0.5 text-11 font-semibold text-amber-700">
            без группы: {unassignedCount}
          </span>
        )}
      </div>

      {/* 2015:12115 — поиск */}
      <label className="flex items-center gap-2 rounded-lg border border-line bg-gray-50 p-2.5">
        <Search className="size-3.5 shrink-0 text-gray-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск ученика"
          className="w-full bg-transparent text-13 text-ink outline-none placeholder:text-gray-400"
        />
      </label>

      {/* 2015:12119 — «Разделить по алфавиту» */}
      <button
        type="button"
        onClick={onSplit}
        disabled={disabled || splitDisabled}
        className="flex items-center gap-2 rounded-lg border border-line p-2.5 text-13 font-semibold text-navy-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowUpDown className="size-3.5" />
        Разделить по алфавиту
      </button>

      <ul className="flex max-h-[520px] flex-col gap-1 overflow-y-auto">
        {visible.length === 0 && (
          <li className="p-3 text-center text-13 text-gray-400">
            {students.length === 0 ? 'В классе нет учеников' : 'Никого не нашлось'}
          </li>
        )}
        {visible.map((student) => {
          const assigned = assignedIds.has(student.studentId);
          return (
            <li
              key={student.studentId}
              className={cx(
                'flex items-center gap-3 rounded-lg px-3 py-2',
                assigned ? 'opacity-40' : 'hover:bg-gray-50',
              )}
            >
              <StudentAvatar student={student} size={32} />
              <span
                className={cx(
                  'min-w-0 flex-1 truncate text-13 font-medium text-ink',
                  assigned && 'line-through',
                )}
              >
                {studentShortName(student)}
              </span>
              {!assigned && (
                <StudentActionMenu
                  studentLabel={studentShortName(student)}
                  subgroups={subgroups}
                  mode="unassigned"
                  disabled={disabled}
                  onAction={(action) => {
                    if (action.kind === 'add') onAssign(student.studentId, action.targetSubgroupId);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Карточка подгруппы — Figma 2015:12168: flex-1, radius 16, p 20, gap 16. */
export function SubgroupCard({
  subgroup,
  students,
  allSubgroups,
  duplicateIds,
  disabled,
  onRename,
  onArchive,
  onStudentAction,
}: {
  subgroup: Subgroup;
  students: SubgroupStudent[];
  allSubgroups: Subgroup[];
  duplicateIds: Set<number>;
  disabled?: boolean;
  onRename: (name: string) => void;
  onArchive: () => void;
  onStudentAction: (studentId: number, action: StudentMenuAction) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(subgroup.name);

  function commitName() {
    setEditing(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== subgroup.name) onRename(trimmed);
    else setDraftName(subgroup.name);
  }

  return (
    <section className="flex min-w-[240px] flex-1 flex-col gap-4 rounded-2xl border border-line bg-white p-5">
      {/* 2015:12169 — шапка карточки */}
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <input
            value={draftName}
            autoFocus
            aria-label="Название подгруппы"
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setDraftName(subgroup.name);
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-line px-2 py-1 text-base font-bold text-ink outline-none focus:border-navy-700"
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setDraftName(subgroup.name);
              setEditing(true);
            }}
            className="min-w-0 truncate text-left text-base font-bold text-ink transition hover:text-navy-700 disabled:hover:text-ink"
          >
            {subgroup.name}
          </button>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-md bg-gray-50 px-2 py-[3px] text-11 font-semibold text-muted">
            {students.length} {pluralRu(students.length, ['ученик', 'ученика', 'учеников'])}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={onArchive}
            aria-label={`Архивировать «${subgroup.name}»`}
            className="flex size-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 2015:12173 — список состава */}
      <div className="flex flex-col">
        {students.length === 0 && (
          <p className="py-6 text-center text-13 text-gray-400">Пока никого</p>
        )}
        {students.map((student) => (
          <div
            key={student.studentId}
            className={cx(
              'flex items-center gap-2.5 border-b border-line p-2 last:border-b-0',
              duplicateIds.has(student.studentId) && 'bg-red-50',
            )}
          >
            <StudentAvatar student={student} size={28} />
            <span className="min-w-0 flex-1 truncate text-13 text-ink">
              {studentShortName(student)}
            </span>
            <StudentActionMenu
              studentLabel={studentShortName(student)}
              subgroups={allSubgroups}
              currentSubgroupId={subgroup.id}
              mode="member"
              disabled={disabled}
              onAction={(action) => onStudentAction(student.studentId, action)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Добавление ещё одной подгруппы — в макете две группы, но их может быть больше. */
export function AddSubgroupCard({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-w-[180px] flex-col items-center justify-center gap-2 self-stretch rounded-2xl border border-dashed border-line p-5 text-13 font-semibold text-muted transition hover:border-navy-700 hover:text-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Plus className="size-4" />
      Добавить подгруппу
    </button>
  );
}
