import { ArrowLeft, Clock, RotateCcw, Repeat, AlertTriangle } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { Button } from '@/components/ui/Button';
import { pluralRu } from '@/lib/format';
import type { AssignmentItem } from '@/lib/entranceTypes';

const WARNING =
  'После завершения тест будет отправлен на проверку школы. Результат будет доступен позже после подтверждения.';

/** Section 7 — instruction / rules shown before the attempt starts. */
export function InstructionScreen({
  item,
  onBegin,
  onBack,
  loading,
}: {
  item: AssignmentItem;
  onBegin: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  return (
    <EntranceShell>
      <button
        onClick={onBack}
        disabled={loading}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-700 disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" />
        К списку тестов
      </button>

      <div className="card p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-500">{item.subject}</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{item.testTitle}</h1>

        <ul className="mt-5 space-y-2.5 text-sm">
          <li className="flex items-center gap-2.5 text-slate-600">
            <Clock className="h-4 w-4 shrink-0 text-slate-400" />
            Длительность: <span className="font-semibold text-slate-800">{item.durationMinutes} мин</span>
          </li>
          <li className="flex items-center gap-2.5 text-slate-600">
            <RotateCcw className="h-4 w-4 shrink-0 text-slate-400" />
            {item.allowBackNavigation
              ? 'Можно возвращаться к предыдущим вопросам'
              : 'Возврат к предыдущим вопросам недоступен'}
          </li>
          <li className="flex items-center gap-2.5 text-slate-600">
            <Repeat className="h-4 w-4 shrink-0 text-slate-400" />
            Попыток: <span className="font-semibold text-slate-800">{item.maxAttempts}</span>{' '}
            {pluralRu(item.maxAttempts, ['попытка', 'попытки', 'попыток'])}
          </li>
        </ul>

        {item.rules ? (
          <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Правила</p>
            {item.rules}
          </div>
        ) : null}

        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{WARNING}</span>
        </div>

        <Button className="mt-6 w-full" onClick={onBegin} loading={loading}>
          Начать тест
        </Button>
      </div>
    </EntranceShell>
  );
}
