import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useMyClassRoster } from '@/hooks/queries';
import type { Schema } from '@/lib/apiSchemas';

function studentCountLabel(count: number): string {
  const plural = new Intl.PluralRules('ru-RU').select(count);
  return `${count} ${plural === 'one' ? 'ученик' : plural === 'few' ? 'ученика' : 'учеников'}`;
}

function StudentCell({ student }: { student: Schema<'MyClassStudentView'> }) {
  const name = student.displayName?.trim()
    || [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
  return (
    <li className="flex min-h-11 min-w-0 items-center gap-3 border-b border-line px-6 py-1.5">
      <Avatar name={name} size="sm" variant="navy" />
      <span className="truncate text-sm font-bold text-slate-900" title={name}>{name}</span>
    </li>
  );
}

/** Вкладка «Ученики» (Figma 2200:3093): действующий состав по страницам. */
export function MyClassStudentsTab({ classId }: { classId: number }) {
  const roster = useMyClassRoster(classId);
  const students = roster.data?.pages.flatMap((page) => page.items ?? []) ?? [];
  const totalStudents = roster.data?.pages[0]?.totalItems ?? students.length;

  return (
    <section aria-label="Ученики класса" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <div className="h-10 border-b border-line bg-canvas" aria-hidden="true" />
      {roster.isPending ? <LoadingBlock label="Загрузка учеников…" /> : roster.isError ? (
        <ErrorBlock message="Не удалось загрузить данные класса." onRetry={() => void roster.refetch()} />
      ) : students.length === 0 ? (
        <EmptyBlock title="В классе пока нет учеников" />
      ) : (
        <>
          <ul className="grid grid-cols-1 sm:grid-cols-2">
            {students.map((student) => <StudentCell key={student.studentProfileId} student={student} />)}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <p className="text-sm text-muted">Всего: {studentCountLabel(totalStudents)}</p>
            {roster.hasNextPage && (
              <Button variant="secondary" size="sm" loading={roster.isFetchingNextPage} onClick={() => void roster.fetchNextPage()}>
                Показать ещё
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
