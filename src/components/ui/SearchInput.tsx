import { Search } from 'lucide-react';
import { cx } from '@/lib/format';
import { useFieldControlProps } from './fieldContext';

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  size = 'md',
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  size?: 'md' | 'lg';
  'aria-label'?: string;
}) {
  const fieldProps = useFieldControlProps({ ariaLabel });
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        {...fieldProps}
        aria-label={ariaLabel ?? (fieldProps['aria-labelledby'] ? undefined : placeholder)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(
          'w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30',
          size === 'lg' ? 'h-12' : 'h-11',
        )}
      />
    </div>
  );
}
