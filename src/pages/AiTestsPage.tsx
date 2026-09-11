import { useTests } from '@/hooks/queries';
import { StatCard } from '@/components/ui/StatCard';
import { AiTestsTab } from './tabs/AiTestsTab';
import { countTestsWithDrafts } from '@/lib/testQuestions';

export type AiTestsVariant = 'ai' | 'psychology';

const COPY: Record<AiTestsVariant, { title: string; description: string; totalLabel: string }> = {
  ai: {
    title: 'AI-тесты',
    description:
      'Тесты по учебным материалам с генерацией вопросов через AI. Загрузите материалы предмета, ' +
      'сгенерируйте вопросы, проверьте черновики и опубликуйте.',
    totalLabel: 'Всего AI-тестов',
  },
  psychology: {
    title: 'Психологические тесты',
    description:
      'Тот же конструктор, что у AI-тестов — ручное создание вопросов или генерация через AI. ' +
      'Назначение ученикам на этом этапе не предусмотрено.',
    totalLabel: 'Всего тестов',
  },
};

/**
 * Одна страница на два кабинета (PSYCHOLOGIST-001 §5): `variant` меняет только подписи и
 * скрывает то, чего у психолога нет (копирование во вступительные — см. `AiTestsTab`).
 * Данные не фильтруются здесь — `GET /api/admin/tests` уже отдаёт только тесты вызывающего
 * происхождения (`origin`), сервер решает это сам по роли, а не по параметру запроса.
 */
export function AiTestsPage({ variant = 'ai' }: { variant?: AiTestsVariant }) {
  const tests = useTests(true);
  const copy = COPY[variant];

  const total = tests.data?.length ?? 0;
  const active = tests.data?.filter((t) => t.status === 'ACTIVE').length ?? 0;
  const withDrafts = countTestsWithDrafts(tests.data);

  return (
    <div>
      <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
        {copy.title}
      </h1>
      <p className="mt-1 max-w-2xl text-slate-500">{copy.description}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={copy.totalLabel} value={tests.isSuccess ? total : '—'} />
        <StatCard label="Активных" value={tests.isSuccess ? active : '—'} />
        <StatCard
          label="С черновиками вопросов"
          value={tests.isSuccess ? withDrafts : '—'}
        />
      </div>

      <div className="mt-6">
        <AiTestsTab variant={variant} />
      </div>
    </div>
  );
}
