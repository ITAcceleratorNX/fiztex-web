import { useTests } from '@/hooks/queries';
import { StatCard } from '@/components/ui/StatCard';
import { AiTestsTab } from './tabs/AiTestsTab';
import { countTestsWithDrafts } from '@/lib/testQuestions';

export function AiTestsPage() {
  const tests = useTests(true);

  const total = tests.data?.length ?? 0;
  const active = tests.data?.filter((t) => t.status === 'ACTIVE').length ?? 0;
  const withDrafts = countTestsWithDrafts(tests.data);

  return (
    <div>
      <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
        AI-тесты
      </h1>
      <p className="mt-1 max-w-2xl text-slate-500">
        Тесты по учебным материалам с генерацией вопросов через AI. Загрузите материалы предмета,
        сгенерируйте вопросы, проверьте черновики и опубликуйте.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Всего AI-тестов" value={tests.isSuccess ? total : '—'} />
        <StatCard label="Активных" value={tests.isSuccess ? active : '—'} />
        <StatCard
          label="С черновиками вопросов"
          value={tests.isSuccess ? withDrafts : '—'}
        />
      </div>

      <div className="mt-6">
        <AiTestsTab />
      </div>
    </div>
  );
}
