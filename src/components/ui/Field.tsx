import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from '@/lib/format';
import { Select } from './Select';

export { Select };

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label-base">
        {label}
        {required && <span className="ml-0.5 text-brand-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={cx('input-base', error && 'border-red-300 focus:border-red-400 focus:ring-red-300/30', className)} {...props} />;
}

export function TextArea({
  className,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={cx(
        'input-base min-h-[92px] resize-y',
        error && 'border-red-300 focus:border-red-400 focus:ring-red-300/30',
        className,
      )}
      {...props}
    />
  );
}
