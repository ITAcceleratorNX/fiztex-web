import { Clock } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { cx } from '@/lib/format';
import type { TeacherAvailabilityProposal } from '@/lib/schedule2bTypes';
import { WEEKDAY_SHORT_LABELS, WEEKDAYS_ORDER } from '@/platform/labels';
import { SHIFT_LABELS } from './availabilityControls';
import { workingHoursLabel } from './availabilityGrid';
import { proposalToDraft, toHhMm } from './availabilityValidation';

type Tone = 'pending' | 'approved' | 'rejected';

const TONES: Record<Tone, string> = {
  pending: 'border-attention-fg/40 bg-attention-bg',
  approved: 'border-success-fg/30 bg-success-bg',
  rejected: 'border-red-200 bg-red-50',
};

/**
 * Заявка на рабочее время — одной карточкой на обоих экранах.
 *
 * Учитель видит здесь то, что отправил, админ — то, что ему предлагают, и это
 * намеренно один компонент: расхождение в том, как две стороны читают одни и те
 * же часы, стоит дороже пары сэкономленных строк.
 *
 * Часы считаются из интервалов тем же `workingHoursLabel`, что и в карточке
 * занятости, — отдельного поля рабочих часов в API нет.
 */
export function AvailabilityProposalCard({
  proposal,
  tone,
  title,
  note,
  actions,
}: {
  proposal: TeacherAvailabilityProposal;
  tone: Tone;
  title: string;
  /** Строка под заголовком: чья заявка, что с ней делать. */
  note?: string;
  actions?: React.ReactNode;
}) {
  const draft = proposalToDraft(proposal);
  const hours = workingHoursLabel(draft);
  const days = new Set(proposal.workingDays);

  return (
    <section className={cx('flex flex-col gap-3 rounded-xl border p-4', TONES[tone])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-13 font-bold text-ink">{title}</p>
          {note && <p className="text-11 text-muted">{note}</p>}
        </div>
        <p className="shrink-0 text-11 text-muted">
          Отправлена {formatDateTime(proposal.submittedAt)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ul className="flex flex-wrap gap-1" aria-label="Рабочие дни в заявке">
          {WEEKDAYS_ORDER.map((day) => (
            <li
              key={day}
              className={cx(
                'rounded px-2 py-0.5 text-11 font-semibold',
                days.has(day) ? 'bg-navy-700 text-white' : 'bg-white text-subtle',
              )}
            >
              {WEEKDAY_SHORT_LABELS[day]}
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-1.5 text-13 text-muted">
          <Clock className="size-3.5 shrink-0 text-subtle" aria-hidden />
          {hours ? `Часы: ${hours}` : 'Часы не сужены — весь рабочий день'}
        </p>
        {proposal.preferredShift && (
          <span className="rounded bg-white px-2 py-0.5 text-11 text-muted">
            {SHIFT_LABELS[proposal.preferredShift]}
          </span>
        )}
      </div>

      {proposal.intervals.length > 0 && (
        <ul className="flex flex-col gap-1">
          {proposal.intervals.map((row, index) => (
            <li
              key={`${row.dayOfWeek}-${row.startTime}-${row.type}-${index}`}
              className="flex flex-wrap items-center gap-2 text-13 text-ink"
            >
              <span className="w-8 shrink-0 font-semibold">
                {WEEKDAY_SHORT_LABELS[row.dayOfWeek]}
              </span>
              <span className="tabular-nums">
                {toHhMm(row.startTime)} – {toHhMm(row.endTime)}
              </span>
              <span
                className={cx(
                  'rounded px-2 py-0.5 text-10 font-semibold',
                  row.type === 'AVAILABLE'
                    ? 'bg-success-bg text-success-fg'
                    : 'bg-red-100 text-red-600',
                )}
              >
                {row.type === 'AVAILABLE' ? 'Свободна' : 'Недоступна'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {proposal.teacherComment && (
        <p className="rounded-lg bg-white/70 p-2.5 text-13 text-ink">
          <span className="font-semibold">Комментарий учителя: </span>
          {proposal.teacherComment}
        </p>
      )}

      {proposal.decisionComment && (
        <p className="rounded-lg bg-white/70 p-2.5 text-13 text-ink">
          <span className="font-semibold">Причина отказа: </span>
          {proposal.decisionComment}
        </p>
      )}

      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </section>
  );
}
