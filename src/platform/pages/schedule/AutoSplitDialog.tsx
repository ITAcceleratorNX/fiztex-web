import { useEffect, useState } from 'react';
import { ArrowUpDown, Loader2, X } from 'lucide-react';
import { cx, pluralRu } from '@/lib/format';
import { ModalActions, ModalCard, MODAL_PRIMARY, MODAL_SECONDARY } from './ModalCard';
import { autoSplitSizes, defaultAutoSplitNames } from './subgroupHelpers';

const FIELD_LABEL = 'text-xs font-semibold uppercase tracking-[0.5px] text-muted';
const FIELD_CONTROL =
  'w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy-700';

/**
 * «Разделить по алфавиту» — кнопка есть в карточке учеников (2015:12119),
 * самой модалки в макетах нет. Собрана по спеке модалок расписания.
 */
export function AutoSplitDialog({
  open,
  studentCount,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  studentCount: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (names: { firstName: string; secondName: string }) => void;
}) {
  const [firstName, setFirstName] = useState('Группа 1');
  const [secondName, setSecondName] = useState('Группа 2');
  const sizes = autoSplitSizes(studentCount, 2);

  useEffect(() => {
    if (!open) return;
    const [a, b] = defaultAutoSplitNames();
    setFirstName(a!);
    setSecondName(b!);
  }, [open]);

  function submit() {
    onConfirm({
      firstName: firstName.trim() || 'Группа 1',
      secondName: secondName.trim() || 'Группа 2',
    });
  }

  return (
    <ModalCard
      open={open}
      onClose={onClose}
      labelledBy="auto-split-title"
      className="max-w-[440px] gap-5 p-6"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2
            id="auto-split-title"
            className="inline-flex items-center gap-2 text-xl font-bold text-ink"
          >
            <ArrowUpDown className="size-4 text-navy-700" />
            Разделить по алфавиту
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-gray-400 transition hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        {studentCount === 0 ? (
          <p className="text-13 text-gray-400">
            В классе нет активных учеников — делить некого.
          </p>
        ) : (
          <p className="text-13 text-gray-400">
            {studentCount} {pluralRu(studentCount, ['ученик', 'ученика', 'учеников'])} будут
            разделены по фамилии на две группы: {sizes[0]} / {sizes[1]}.
          </p>
        )}
      </div>

      {studentCount > 0 && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>Первая группа</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={loading}
              className={FIELD_CONTROL}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>Вторая группа</span>
            <input
              value={secondName}
              onChange={(e) => setSecondName(e.target.value)}
              disabled={loading}
              className={FIELD_CONTROL}
            />
          </label>
        </div>
      )}

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className={cx(MODAL_SECONDARY, 'text-muted')}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={loading || studentCount === 0}
          className={cx(MODAL_PRIMARY, 'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600')}
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Разделить
        </button>
      </ModalActions>
    </ModalCard>
  );
}
