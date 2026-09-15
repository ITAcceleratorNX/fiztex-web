import { History, GitBranch } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { VersionStrategy } from '@/lib/types';

/**
 * Shown when an admin edits a test that has already been assigned (backend returns 409).
 * Реализует требование ТЗ 4.3: «Сохранить в текущей версии / Создать новую версию / Отмена».
 */
export function VersionDecisionModal({
  open,
  onClose,
  onChoose,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (strategy: VersionStrategy) => void;
  loading: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Тест уже назначался" size="md">
      <p className="text-sm leading-relaxed text-slate-600">
        Этот тест уже назначался поступающим. Старые назначения, ответы и результаты должны остаться
        без изменений. Выберите способ сохранения изменений.
      </p>

      <div className="mt-5 space-y-3">
        <button
          onClick={() => onChoose('KEEP_CURRENT')}
          disabled={loading}
          className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <History className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-800">Сохранить в текущей версии</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Мелкие правки текущей версии. Существующие назначения сохраняют свой snapshot и не меняются.
            </span>
          </span>
        </button>

        <button
          onClick={() => onChoose('NEW_VERSION')}
          disabled={loading}
          className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
            <GitBranch className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-800">Создать новую версию</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Новая версия с новым номером и датой. Старые версии остаются в истории.
            </span>
          </span>
        </button>
      </div>

      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Отмена
        </Button>
      </div>
    </Modal>
  );
}
