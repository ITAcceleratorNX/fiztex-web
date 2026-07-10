import { CheckCircle2 } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { Button } from '@/components/ui/Button';

/** Section 11 — final screen. No score, no right/wrong answers are shown. */
export function FinishedScreen({
  testTitle,
  onBackToList,
  onExit,
}: {
  testTitle?: string;
  onBackToList: () => void;
  onExit: () => void;
}) {
  return (
    <EntranceShell>
      <div className="card p-6 text-center sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Тест завершён</h1>
        {testTitle ? <p className="mt-1 text-sm text-slate-500">{testTitle}</p> : null}
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
          Ответы отправлены на проверку школы. Результат будет доступен позже после проверки.
        </p>

        <div className="mt-6 space-y-2.5">
          <Button className="w-full" onClick={onBackToList}>
            К списку тестов
          </Button>
          <Button variant="ghost" className="w-full" onClick={onExit}>
            Выйти
          </Button>
        </div>
      </div>
    </EntranceShell>
  );
}
