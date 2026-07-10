import { Link } from 'react-router-dom';
import { ClipboardList, BookMarked, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApplicants, useSubjects, useTests } from '@/hooks/queries';
import { StatCard } from '@/components/ui/StatCard';

export function DashboardPage() {
  const { admin } = useAuth();
  const subjects = useSubjects();
  const tests = useTests(false);
  const aiTests = useTests(true);
  const applicants = useApplicants();

  const activeAdmissionTests = tests.data?.filter((t) => t.status === 'ACTIVE').length ?? 0;
  const activeAiTests = aiTests.data?.filter((t) => t.status === 'ACTIVE').length ?? 0;

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
        Здравствуйте, {admin?.fullName?.split(' ')[0] ?? 'Администратор'}
      </h1>
      <p className="mt-1 text-slate-500">Обзор системы Fiztex.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Предметов" value={subjects.data?.length ?? '—'} />
        <StatCard label="AI-тестов (активных)" value={activeAiTests || '—'} />
        <StatCard label="Поступающих" value={applicants.data?.length ?? '—'} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/subjects"
          className="card flex items-center justify-between px-6 py-5 transition hover:ring-brand-200"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <BookMarked className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-800">Предметы</p>
              <p className="text-sm text-slate-500">Справочник предметов для тестов</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400" />
        </Link>

        <Link
          to="/admissions"
          className="card flex items-center justify-between px-6 py-5 transition hover:ring-brand-200"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-800">Вступительные тесты</p>
              <p className="text-sm text-slate-500">
                {activeAdmissionTests > 0 ? `${activeAdmissionTests} активных` : 'Поступающие и назначения'}
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400" />
        </Link>

        <Link
          to="/ai-tests"
          className="card flex items-center justify-between px-6 py-5 transition hover:ring-brand-200"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-800">AI-тесты</p>
              <p className="text-sm text-slate-500">Материалы, генерация и ревью вопросов</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400" />
        </Link>
      </div>
    </div>
  );
}
