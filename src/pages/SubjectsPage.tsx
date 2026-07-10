import { useSubjects } from '@/hooks/queries';
import { StatCard } from '@/components/ui/StatCard';
import { SubjectsTab } from './tabs/SubjectsTab';

export function SubjectsPage() {
  const subjects = useSubjects();

  return (
    <div>
      <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
        Предметы
      </h1>
      <p className="mt-1 text-slate-500">Справочник предметов. Материалы используются для AI-тестов.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Всего предметов" value={subjects.data?.length ?? '—'} />
        <StatCard
          label="Активных"
          value={subjects.isSuccess ? subjects.data.filter((s) => s.status === 'ACTIVE').length : '—'}
        />
        <StatCard
          label="Скрытых"
          value={subjects.isSuccess ? subjects.data.filter((s) => s.status === 'HIDDEN').length : '—'}
        />
      </div>

      <div className="mt-6">
        <SubjectsTab />
      </div>
    </div>
  );
}
