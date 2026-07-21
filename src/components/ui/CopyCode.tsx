import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

export function CopyCode({ code }: { code: string | null }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  if (!code) return <span className="text-sm text-slate-300">—</span>;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code as string);
      setCopied(true);
      toast.success('Код скопирован');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Не удалось скопировать код');
    }
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        void copy();
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm font-medium text-slate-700 transition hover:bg-slate-200"
      title="Скопировать код"
    >
      {code}
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
    </button>
  );
}
