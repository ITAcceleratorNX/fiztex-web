import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cx } from '@/lib/format';
import { TextInput } from './Field';

/**
 * Поле пароля с показом набранного (Figma `phyztex` 2460:4665 W1, 2460:4833 W4).
 *
 * Глаз не в порядке табуляции: с клавиатуры пароль набирают, а не разглядывают, и лишняя
 * остановка между полем и кнопкой входа мешает больше, чем помогает. `appearance` — как у
 * `TextInput`: `filled` на экранах входа, `default` в обычных формах.
 */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid = false,
  autoFocus = false,
  appearance = 'default',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  appearance?: 'default' | 'filled';
}) {
  const [visible, setVisible] = useState(false);
  const filled = appearance === 'filled';
  return (
    <div className="relative">
      <TextInput
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        error={invalid}
        appearance={appearance}
        className={filled ? 'pr-14' : 'pr-11'}
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
        className={cx(
          'absolute inset-y-0 right-0 flex items-center justify-center transition',
          filled ? 'w-14 text-planning-subtle hover:text-planning-ink' : 'w-11 text-slate-400 hover:text-slate-600',
        )}
      >
        {visible
          ? <EyeOff className={filled ? 'size-5' : 'size-4'} aria-hidden="true" />
          : <Eye className={filled ? 'size-5' : 'size-4'} aria-hidden="true" />}
      </button>
    </div>
  );
}
