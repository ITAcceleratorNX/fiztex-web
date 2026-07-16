import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { TextInput } from '@/components/ui/Field';
import { cx, pluralRu } from '@/lib/format';
import type { Subgroup, SubgroupStudent } from '@/lib/schedule2bTypes';
import { StudentActionMenu, type StudentMenuAction } from './StudentActionMenu';
import { sortSubgroupStudents, studentFullName } from './subgroupHelpers';

export function SubgroupColumn({
  subgroup,
  allSubgroups,
  disabled,
  busyStudentId,
  onRename,
  onArchive,
  onStudentAction,
}: {
  subgroup: Subgroup;
  allSubgroups: Subgroup[];
  disabled?: boolean;
  busyStudentId: number | null;
  onRename: (name: string) => void;
  onArchive: () => void;
  onStudentAction: (student: SubgroupStudent, action: StudentMenuAction) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(subgroup.name);
  const students = sortSubgroupStudents(subgroup);

  return (
    <section className="flex min-h-[12rem] flex-col rounded-2xl border border-slate-200 bg-white">
      <header className="flex items-start gap-2 border-b border-slate-100 px-3 py-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <TextInput
              value={draftName}
              autoFocus
              disabled={disabled}
              aria-label="Название подгруппы"
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => {
                setEditing(false);
                if (draftName.trim() && draftName.trim() !== subgroup.name) {
                  onRename(draftName);
                } else {
                  setDraftName(subgroup.name);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') {
                  setDraftName(subgroup.name);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              disabled={disabled}
              className="truncate text-left text-sm font-semibold text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:no-underline"
              onClick={() => {
                setDraftName(subgroup.name);
                setEditing(true);
              }}
            >
              {subgroup.name}
            </button>
          )}
          <p className="mt-0.5 text-xs text-slate-500">
            {students.length} {pluralRu(students.length, ['ученик', 'ученика', 'учеников'])}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Архивировать «${subgroup.name}»`}
          disabled={disabled}
          onClick={onArchive}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>
      <ul className="flex-1 divide-y divide-slate-50 overflow-y-auto px-1 py-1">
        {students.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-slate-400">Пусто</li>
        )}
        {students.map((student) => {
          const label = studentFullName(student);
          return (
            <li
              key={student.studentId}
              className={cx(
                'flex items-center gap-2 px-2 py-2',
                busyStudentId === student.studentId && 'opacity-60',
              )}
            >
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{label}</span>
              <StudentActionMenu
                studentLabel={label}
                subgroups={allSubgroups}
                currentSubgroupId={subgroup.id}
                mode="member"
                disabled={disabled || busyStudentId === student.studentId}
                onAction={(action) => onStudentAction(student, action)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function UnassignedPanel({
  students,
  subgroups,
  disabled,
  busyStudentId,
  onAction,
}: {
  students: SubgroupStudent[];
  subgroups: Subgroup[];
  disabled?: boolean;
  busyStudentId: number | null;
  onAction: (student: SubgroupStudent, action: StudentMenuAction) => void;
}) {
  return (
    <aside
      className={cx(
        'rounded-2xl border bg-white',
        students.length > 0 ? 'border-amber-200' : 'border-slate-200',
      )}
    >
      <header className="border-b border-slate-100 px-3 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Нераспределённые</h3>
          <Badge tone={students.length > 0 ? 'amber' : 'gray'}>{students.length}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Ученики класса без группы в этом наборе</p>
      </header>
      <ul className="max-h-[28rem] divide-y divide-slate-50 overflow-y-auto px-1 py-1">
        {students.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-slate-400">Все распределены</li>
        )}
        {students.map((student) => {
          const label = studentFullName(student);
          return (
            <li
              key={student.studentId}
              className={cx(
                'flex items-center gap-2 px-2 py-2',
                busyStudentId === student.studentId && 'opacity-60',
              )}
            >
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{label}</span>
              <StudentActionMenu
                studentLabel={label}
                subgroups={subgroups}
                mode="unassigned"
                disabled={disabled || busyStudentId === student.studentId}
                onAction={(action) => onAction(student, action)}
              />
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
