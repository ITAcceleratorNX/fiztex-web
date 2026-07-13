import { useState } from 'react';
import { useApplicants, useTests } from '@/hooks/queries';
import { StatCard } from '@/components/ui/StatCard';
import { NotificationsBell } from '@/components/admissions/NotificationsBell';
import { cx } from '@/lib/format';
import { AdmissionTestsTab } from './tabs/AdmissionTestsTab';
import { ApplicantsTab } from './tabs/ApplicantsTab';
import { AttemptsTab, type AttemptsStatusFilter } from './tabs/AttemptsTab';

type TabKey = 'tests' | 'applicants' | 'attempts';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'tests', label: 'Тесты' },
  { key: 'applicants', label: 'Поступающие' },
  { key: 'attempts', label: 'Попытки' },
];

export function AdmissionsPage() {
  const [tab, setTab] = useState<TabKey>('tests');
  const [focusAttemptId, setFocusAttemptId] = useState<number | null>(null);
  const [attemptsStatusFilter, setAttemptsStatusFilter] = useState<AttemptsStatusFilter>('ALL');

  const tests = useTests(false);
  const applicants = useApplicants();

  const activeTests = tests.data?.filter((t) => t.status === 'ACTIVE').length ?? 0;

  function openAttemptFromNotification(attemptId: number) {
    setAttemptsStatusFilter('ALL');
    setTab('attempts');
    setFocusAttemptId(attemptId);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
          Вступительные тесты
        </h1>
        <NotificationsBell onOpenAttempt={openAttemptFromNotification} />
      </div>

      <div className="mt-6 inline-flex rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-slate-200/70">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              'rounded-xl px-6 py-2.5 text-sm font-semibold transition',
              tab === t.key
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Активных тестов" value={tests.isSuccess ? activeTests : '—'} />
        <StatCard label="Поступающих" value={applicants.data?.length ?? '—'} />
      </div>

      <div className="mt-6">
        {tab === 'tests' && <AdmissionTestsTab />}
        {tab === 'applicants' && <ApplicantsTab />}
        {tab === 'attempts' && (
          <AttemptsTab
            statusFilter={attemptsStatusFilter}
            onStatusFilterChange={setAttemptsStatusFilter}
            focusAttemptId={focusAttemptId}
            onFocusHandled={() => setFocusAttemptId(null)}
          />
        )}
      </div>
    </div>
  );
}
