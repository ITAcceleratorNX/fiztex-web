import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';

/** One-time plaintext code after create / reissue — stays until user confirms. */
export function IssuedCodeResult({
  roleLabel,
  code,
  hint,
  onDone,
}: {
  roleLabel: string;
  code: string;
  hint?: string;
  onDone: () => void;
}) {
  const toast = useToast();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Код скопирован');
    } catch {
      toast.error('Не удалось скопировать код');
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-[#f8fafc] px-4 py-5 ring-1 ring-[#e5e7eb]">
        <p className="text-11 font-semibold uppercase tracking-wide text-[#9ca3af]">
          Код активации · {roleLabel}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-2xl font-bold tracking-[0.2em] text-navy-700">{code}</span>
          <Button type="button" variant="secondary" onClick={() => void handleCopy()}>
            <Copy className="mr-1.5 size-3.5" />
            Скопировать
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {hint ??
            'Код показывается один раз. Сохраните его — в профиле потом будет только «скрыт / —».'}
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onDone}>
          Готово
        </Button>
      </div>
    </div>
  );
}
