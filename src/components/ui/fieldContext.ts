import { createContext, useContext } from 'react';

export type FieldContextValue = {
  controlId: string;
  labelId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
};

export const FieldContext = createContext<FieldContextValue | null>(null);

/** Accessibility attributes inherited by design-system controls rendered inside Field. */
export function useFieldControlProps(options: {
  id?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  ariaRequired?: boolean | 'true' | 'false';
} = {}) {
  const context = useContext(FieldContext);
  // An explicitly named secondary control inside a Field (for example, the group selector
  // beside the recipient selector) is its own field and must not inherit the parent's label.
  const field = options.ariaLabel && !options.ariaLabelledBy ? null : context;
  const describedBy = [options.ariaDescribedBy, field?.describedBy].filter(Boolean).join(' ') || undefined;

  return {
    id: options.id ?? field?.controlId,
    'aria-labelledby': options.ariaLabelledBy ?? field?.labelId,
    'aria-describedby': describedBy,
    'aria-invalid': options.ariaInvalid ?? (field?.invalid ? true : undefined),
    'aria-required': options.ariaRequired ?? (field?.required ? true : undefined),
    required: field?.required,
  };
}
