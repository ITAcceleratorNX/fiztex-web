import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { pluralRu } from '@/lib/format';

export function AssignSuccessModal({
  open,
  onClose,
  count,
  versionNumber,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  versionNumber: number | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md animate-scale-in rounded-2xl bg-white p-8 text-center shadow-pop"
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-8 w-8 text-emerald-600" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-900">Поступающие успешно назначены</h2>
        <p className="mt-2 text-sm text-slate-500">
          {count} {pluralRu(count, ['поступающий', 'поступающих', 'поступающих'])} успешно{' '}
          {pluralRu(count, ['назначен', 'назначены', 'назначены'])} на тест.
          <br />
          Для каждого поступающего зафиксирована версия{' '}
          <span className="inline-flex items-center rounded-md bg-navy-700 px-2 py-0.5 text-xs font-semibold text-white">
            v{versionNumber ?? '—'}
          </span>
        </p>
        <Button className="mt-6 w-full" onClick={onClose}>
          Вернуться к карточке теста
        </Button>
      </div>
    </div>
  );
}
