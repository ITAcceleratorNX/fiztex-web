import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { TextInput } from '@/components/ui/Field';

/**
 * Поле пароля с показом набранного (макет W1 и W4).
 *
 * Живёт рядом с экранами входа, а не в `components/ui`: это единственное место, где
 * пароль вообще вводят, и заводить его в дизайн-систему стоит тогда, когда появится
 * второй потребитель.
 */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextInput
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        error={invalid}
        className="pr-11"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        onClick={() => setVisible((previous) => !previous)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
