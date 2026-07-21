import { cx } from '@/lib/format';

/** Bare switch pill — for a labeled toggle row use `Toggle` instead. */
export function Switch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition',
        checked ? 'bg-brand-500' : 'bg-slate-300',
      )}
    >
      <span
        className={cx(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
