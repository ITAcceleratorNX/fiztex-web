import type { FocusEvent, InputHTMLAttributes, KeyboardEvent } from 'react';
import { cx } from '@/lib/format';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Pad / clamp loose HH:MM-ish input into a valid clock string, or return null. */
export function normalizeTimeInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Snap minutes to nearest 5 (0–55). */
export function snapToFiveMinutes(value: string): string {
  const normalized = normalizeTimeInput(value);
  if (!normalized) return value;
  const [h, m] = normalized.split(':').map(Number);
  const snapped = Math.min(55, Math.round(m / 5) * 5);
  return `${String(h).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`;
}

type TimeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
  /** Snap to 5-minute grid on blur (default true). */
  snapOnBlur?: boolean;
  error?: boolean;
};

/**
 * HH:MM text field with light mask + optional 5-minute snap.
 * Uses text (not type=time) so keyboard Tab/Enter flows stay consistent across browsers.
 */
export function TimeInput({
  value,
  onChange,
  snapOnBlur = true,
  error,
  className,
  onBlur,
  onKeyDown,
  ...rest
}: TimeInputProps) {
  function handleChange(raw: string) {
    const cleaned = raw.replace(/[^\d:]/g, '').slice(0, 5);
    if (cleaned.length === 2 && value.length === 1 && !cleaned.includes(':')) {
      onChange(`${cleaned}:`);
      return;
    }
    onChange(cleaned);
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    if (snapOnBlur) {
      const normalized = normalizeTimeInput(value);
      if (normalized) onChange(snapToFiveMinutes(normalized));
    }
    onBlur?.(e);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const normalized = normalizeTimeInput(value) ?? '08:00';
      const [h, m] = normalized.split(':').map(Number);
      const total = h * 60 + m + (e.key === 'ArrowUp' ? 5 : -5);
      const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
      const nh = Math.floor(wrapped / 60);
      const nm = wrapped % 60;
      onChange(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`);
    }
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      placeholder="HH:MM"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cx(
        'input-base font-mono tabular-nums',
        error && 'border-red-300 focus:border-red-400 focus:ring-red-300/30',
        className,
      )}
      aria-invalid={error || undefined}
    />
  );
}
