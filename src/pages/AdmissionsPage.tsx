import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApplicants, useSubjects, useTests } from '@/hooks/queries';
import { StatCard } from '@/components/ui/StatCard';
import { NotificationsBell } from '@/components/admissions/NotificationsBell';
import { cx } from '@/lib/format';
import { useListSearchParams } from '@/hooks/useListNavigation';
import { AdmissionTestsTab } from './tabs/AdmissionTestsTab';
import { ApplicantsTab } from './tabs/ApplicantsTab';
import { AnnouncementsTab } from './tabs/AnnouncementsTab';

type TabKey = 'tests' | 'applicants' | 'announcements';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'tests', label: 'Тесты' },
  { key: 'applicants', label: 'Поступающие' },
  { key: 'announcements', label: 'Анонсы' },
];

function parseTab(value: string | null): TabKey {
  if (value === 'applicants' || value === 'announcements') return value;
  return 'tests';
}

export function AdmissionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useListSearchParams('admissions', ['tab', 'testQ', 'testStatus']);
  const rawTab = searchParams.get('tab');
  const tab = parseTab(rawTab);

  useEffect(() => {
    if (rawTab == null || rawTab === 'applicants' || rawTab === 'announcements') return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('tab');
    setSearchParams(nextParams, { replace: true });
  }, [rawTab, searchParams, setSearchParams]);

  function selectTab(next: TabKey) {
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'tests') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
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
        {tab === 'tests' && <AdmissionTestsTab />}
        {tab === 'applicants' && <ApplicantsTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
      </div>
    </div>
  );
}
