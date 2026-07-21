import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApplicants, useSubjects, useTests } from '@/hooks/queries';
import { StatCard } from '@/components/ui/StatCard';
import { NotificationsBell } from '@/components/admissions/NotificationsBell';
import { cx } from '@/lib/format';
import { SubjectsTab } from './tabs/SubjectsTab';
import { AdmissionTestsTab } from './tabs/AdmissionTestsTab';
import { ApplicantsTab } from './tabs/ApplicantsTab';

type TabKey = 'subjects' | 'tests' | 'applicants';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'subjects', label: 'Предметы' },
  { key: 'tests', label: 'Тесты' },
  { key: 'applicants', label: 'Поступающие' },
];

function parseTab(value: string | null): TabKey {
  if (value === 'subjects' || value === 'applicants') return value;
  return 'tests';
}

export function AdmissionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<TabKey>(() => parseTab(searchParams.get('tab')));

  useEffect(() => {
    setTab(parseTab(searchParams.get('tab')));
  }, [searchParams]);

  function selectTab(next: TabKey) {
    setTab(next);
    setSearchParams(next === 'tests' ? {} : { tab: next }, { replace: true });
  }

  const subjects = useSubjects();
  const tests = useTests(false);
  const applicants = useApplicants();

  const activeTests = tests.data?.filter((t) => t.status === 'ACTIVE').length ?? 0;

  function openAttemptFromNotification(attemptId: number) {
    navigate(`/results/attempts/${attemptId}`);
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
            onClick={() => selectTab(t.key)}
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

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Предметов" value={subjects.data?.length ?? '—'} />
        <StatCard label="Активных тестов" value={tests.isSuccess ? activeTests : '—'} />
        <StatCard label="Поступающих" value={applicants.data?.length ?? '—'} />
      </div>

      <div className="mt-6">
        {tab === 'subjects' && <SubjectsTab />}
        {tab === 'tests' && <AdmissionTestsTab />}
        {tab === 'applicants' && <ApplicantsTab />}
      </div>
    </div>
  );
}
