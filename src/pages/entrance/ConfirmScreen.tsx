import { useState } from 'react';
import { User, GraduationCap, AlertCircle } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { Button } from '@/components/ui/Button';
import type { ApplicantView } from '@/lib/entranceTypes';

/** Section 5 — confirm the applicant's data before starting. */
export function ConfirmScreen({
  applicant,
  onConfirm,
  onBack,
  loading,
}: {
  applicant: ApplicantView;
  onConfirm: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [mismatch, setMismatch] = useState(false);

  return (
    <EntranceShell>
      <div className="card p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Проверьте данные перед началом тестирования</h1>

        <dl className="mt-6 space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            <User className="h-5 w-5 shrink-0 text-slate-400" />
            <div>
              <dt className="text-xs text-slate-500">ФИО поступающего</dt>
              <dd className="text-sm font-semibold text-slate-800">{applicant.fullName}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            <GraduationCap className="h-5 w-5 shrink-0 text-slate-400" />
            <div>
              <dt className="text-xs text-slate-500">Класс поступления</dt>
              <dd className="text-sm font-semibold text-slate-800">{applicant.grade}</dd>
            </div>
          </div>
        </dl>

        {mismatch ? (
          <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Обратитесь к сотруднику школы.</span>
          </div>
        ) : null}

        <div className="mt-6 space-y-2.5">
          <Button className="w-full" onClick={onConfirm} loading={loading}>
            Это я
          </Button>
          {!mismatch ? (
            <Button variant="ghost" className="w-full" onClick={() => setMismatch(true)} disabled={loading}>
              Данные неверные
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={onBack} disabled={loading}>
              Ввести другой код
            </Button>
          )}
        </div>
      </div>
    </EntranceShell>
  );
}
