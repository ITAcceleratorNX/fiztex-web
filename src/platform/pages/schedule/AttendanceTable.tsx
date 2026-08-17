import { MessageSquare } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { cx } from '@/lib/format';
import type { AttendanceMarking, AttendanceReason, AttendanceStatus } from '@/lib/attendanceApi';
import {
  REASON_OPTIONS,
  STATUS_OPTIONS,
  markToggleFor,
  reasonLabel,
  statusChip,
  statusOf,
  type StatusTone,
} from '@/lib/attendanceModel';

export interface AttendanceRow {
  studentProfileId: number;
  fullName: string;
  marking: AttendanceMarking;
}

/** Тона чипа статуса из макета: заливка, рамка и текст одного семейства. */
const TONES: Record<StatusTone, string> = {
  present: 'bg-success-bg border-success-fg text-success-fg',
  absent: 'bg-no-lessons-bg border-red-600 text-red-600',
  muted: 'bg-slate-100 border-slate-400 text-slate-500',
};

function StatusCell({
  marking,
  editable,
  onChange,
}: {
  marking: AttendanceMarking;
  editable: boolean;
  onChange: (status: AttendanceStatus) => void;
}) {
  const chip = statusChip(marking);

  if (!editable) {
    return (
      <span
        className={cx(
          'inline-flex h-[26px] items-center rounded-md border px-2.5 text-13 font-semibold',
          TONES[chip.tone],
        )}
      >
        {chip.label}
      </span>
    );
  }

  return (
    <Select
      value={chip.value}
      onChange={(event) => onChange(event.target.value as AttendanceStatus)}
      // Утилиты перебивают `.input-base` из слоя компонентов — чип красится тоном
      // выбранного значения, как в макете, а поведение остаётся от Select.
      className={cx('h-[26px] rounded-md border px-2.5 py-0 text-13 font-semibold', TONES[chip.tone])}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * «Доп. отметка» — опоздание у присутствия, освобождение у отсутствия.
 *
 * У «не отмечено» ячейка пуста: галочки там нет не потому, что нечего показать, а
 * потому что такой пары не существует в модели (`attendance-read-contract.md` §2).
 */
function DetailCell({
  marking,
  editable,
  onToggle,
}: {
  marking: AttendanceMarking;
  editable: boolean;
  onToggle: () => void;
}) {
  const toggle = markToggleFor(statusOf(marking));
  if (!toggle) return null;
  const checked = marking.mark === toggle.value;

  if (!editable) {
    return checked ? <span className="text-13 text-slate-900">{toggle.label}</span> : null;
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-13 text-slate-900">
      <input
        type="checkbox"
        className="size-4 rounded border-slate-300 accent-navy-700"
        checked={checked}
        onChange={onToggle}
      />
      {toggle.label}
    </label>
  );
}

/** Причина разрешена только у отсутствия — у присутствия бэкенд её не примет. */
function ReasonCell({
  marking,
  editable,
  onChange,
}: {
  marking: AttendanceMarking;
  editable: boolean;
  onChange: (reason: AttendanceReason | null) => void;
}) {
  if (statusOf(marking) !== 'ABSENT') return null;

  if (!editable) {
    return marking.reason ? (
      <span className="text-13 text-slate-600">{reasonLabel(marking.reason)}</span>
    ) : null;
  }

  return (
    <Select
      value={marking.reason ?? ''}
      onChange={(event) => onChange((event.target.value || null) as AttendanceReason | null)}
      className="h-[26px] rounded-md px-2.5 py-0 text-13"
    >
      {REASON_OPTIONS.map((option) => (
        <option key={option.value ?? 'none'} value={option.value ?? ''}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * Таблица листа посещаемости (Figma `table-grid`, node 2086:4936).
 *
 * Просмотр и правка — одна таблица, а не две: в макете они различаются
 * интерактивностью тех же ячеек, и разведи их по компонентам — «Освобождён ·
 * Болезнь» разъедется с тем, что видно при правке.
 *
 * `highlighted` — ученики из отказа публикации (`details.unmarkedStudentProfileIds`).
 * Подсветка строки, а не общий текст «заполните всё»: в классе на тридцать человек
 * искать пропущенного глазами — это работа, которую уже сделал бэкенд.
 */
export function AttendanceTable({
  rows,
  editable,
  highlighted,
  onStatusChange,
  onMarkToggle,
  onReasonChange,
  onCommentOpen,
}: {
  rows: AttendanceRow[];
  editable: boolean;
  highlighted: ReadonlySet<number>;
  onStatusChange: (studentProfileId: number, status: AttendanceStatus) => void;
  onMarkToggle: (studentProfileId: number) => void;
  onReasonChange: (studentProfileId: number, reason: AttendanceReason | null) => void;
  onCommentOpen: (studentProfileId: number) => void;
}) {
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col />
        <col className="w-[200px]" />
        <col className="w-[140px]" />
        <col className="w-[180px]" />
        <col className="w-[110px]" />
      </colgroup>
      <thead>
        <tr className="border-b border-slate-200 text-11 font-bold uppercase tracking-wide text-slate-400">
          <th scope="col" className="py-2.5 text-left">
            ФИО ученика
          </th>
          <th scope="col" className="py-2.5 text-left">
            Отметка
          </th>
          <th scope="col" className="py-2.5 text-left">
            Доп. отметка
          </th>
          <th scope="col" className="py-2.5 text-left">
            Причина
          </th>
          <th scope="col" className="py-2.5 text-center">
            Комментарий
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const comment = (row.marking.comment ?? '').trim();
          return (
            <tr
              key={row.studentProfileId}
              className={cx(
                'border-b border-slate-200 last:border-b-0',
                highlighted.has(row.studentProfileId) && 'bg-danger-bg',
              )}
            >
              <td className="h-11 truncate pr-4 text-sm font-medium text-slate-900">
                {row.fullName}
              </td>
              <td className="pr-4">
                <StatusCell
                  marking={row.marking}
                  editable={editable}
                  onChange={(status) => onStatusChange(row.studentProfileId, status)}
                />
              </td>
              <td className="pr-4">
                <DetailCell
                  marking={row.marking}
                  editable={editable}
                  onToggle={() => onMarkToggle(row.studentProfileId)}
                />
              </td>
              <td className="pr-4">
                <ReasonCell
                  marking={row.marking}
                  editable={editable}
                  onChange={(reason) => onReasonChange(row.studentProfileId, reason)}
                />
              </td>
              <td className="text-center">
                <button
                  type="button"
                  onClick={() => onCommentOpen(row.studentProfileId)}
                  disabled={!editable && comment === ''}
                  title={comment || (editable ? 'Добавить комментарий' : 'Комментария нет')}
                  aria-label={`Комментарий: ${row.fullName}`}
                  className={cx(
                    'rounded-md p-1 transition',
                    comment !== '' ? 'text-navy-700' : 'text-slate-400',
                    editable || comment !== ''
                      ? 'hover:bg-slate-100'
                      : 'cursor-default opacity-50',
                  )}
                >
                  <MessageSquare className="size-4" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
