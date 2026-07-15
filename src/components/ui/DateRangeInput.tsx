import { TextInput } from '@/components/ui/Field';

/**
 * Date range as plain YYYY-MM-DD strings — never parse via `new Date(...)`
 * (LocalDate / no TZ shift).
 */
export function DateRangeInput({
  from,
  to,
  onFromChange,
  onToChange,
  disabled,
  fromLabel = 'С',
  toLabel = 'По',
  error,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  disabled?: boolean;
  fromLabel?: string;
  toLabel?: string;
  error?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label-base">{fromLabel}</label>
          <TextInput
            type="date"
            value={from}
            disabled={disabled}
            onChange={(e) => onFromChange(e.target.value)}
            className="w-[11rem]"
            error={Boolean(error)}
          />
        </div>
        <div>
          <label className="label-base">{toLabel}</label>
          <TextInput
            type="date"
            value={to}
            disabled={disabled}
            min={from || undefined}
            onChange={(e) => onToChange(e.target.value)}
            className="w-[11rem]"
            error={Boolean(error)}
          />
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
