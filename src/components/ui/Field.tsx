import { useId, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '@/lib/format';
import { Select } from './Select';
import { FieldContext, useFieldControlProps } from './fieldContext';

export { Select };

export function focusFirstInvalidField(container: HTMLElement | null) {
  const invalid = container?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!invalid) return;

  const target = invalid.matches('input, textarea, select, button, [tabindex]')
    ? invalid
    : invalid.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])');
  target?.focus();
}

export function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label id={labelId} htmlFor={id} className={cx('label-base', required && 'label-required')}>
        {label}
      </label>
      <FieldContext.Provider value={{
        controlId: id,
        labelId,
        describedBy,
        invalid: Boolean(error),
        required: Boolean(required),
      }}>
        {children}
      </FieldContext.Provider>
      {hint && <p id={hintId} className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p id={errorId} className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function TextInput({
  className,
  error,
  id,
  required,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  const fieldProps = useFieldControlProps({
    id,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    ariaInvalid: ariaInvalid === true || error ? true : ariaInvalid === false ? false : undefined,
    ariaRequired,
  });

  return (
    <input
      className={cx('input-base', error && 'border-red-300 focus:border-red-400 focus:ring-red-300/30', className)}
      {...props}
      id={fieldProps.id}
      aria-label={ariaLabel}
      aria-labelledby={fieldProps['aria-labelledby']}
      aria-describedby={fieldProps['aria-describedby']}
      aria-invalid={fieldProps['aria-invalid']}
      aria-required={fieldProps['aria-required']}
      required={required ?? fieldProps.required}
    />
  );
}

export function TextArea({
  className,
  error,
  id,
  required,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  const fieldProps = useFieldControlProps({
    id,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    ariaInvalid: ariaInvalid === true || error ? true : ariaInvalid === false ? false : undefined,
    ariaRequired,
  });

  return (
    <textarea
      className={cx(
        'input-base min-h-[92px] resize-y',
        error && 'border-red-300 focus:border-red-400 focus:ring-red-300/30',
        className,
      )}
      {...props}
      id={fieldProps.id}
      aria-label={ariaLabel}
      aria-labelledby={fieldProps['aria-labelledby']}
      aria-describedby={fieldProps['aria-describedby']}
      aria-invalid={fieldProps['aria-invalid']}
      aria-required={fieldProps['aria-required']}
      required={required ?? fieldProps.required}
    />
  );
}
