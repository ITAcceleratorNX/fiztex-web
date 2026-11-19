import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useAttestationSettingsHistory } from '@/hooks/queries';
import type { AttestationHistoryEvent, AttestationSetting } from '@/lib/attestationSettingsApi';
import { formatDateTime } from '@/lib/format';
import { fullDate, ruleLine } from '@/lib/subjectAttestationModel';

const ACTION_LABELS: Record<NonNullable<AttestationHistoryEvent['action']>, string> = {
  CREATE: 'Создана настройка',
  UPDATE: 'Изменена настройка',
  RETIRE: 'Назначен конец действия',
  CANCEL: 'Отменена настройка',
};

type Payload = {
  classId?: number | null;
  parallel?: string | null;
  resultFormat?: 'NUMERIC' | 'PASS_FAIL';
  periodicity?: 'QUARTER' | 'HALF_YEAR';
  sochProvided?: boolean;
  /** Строка или массив `[год, месяц, день]` — см. `fullDate`. */
  effectiveFromDate?: unknown;
  effectiveToDate?: unknown;
};

function payload(raw: unknown): Payload | null {
  return raw && typeof raw === 'object' ? (raw as Payload) : null;
}

/**
 * История настроек аттестации предмета за год (ТЗ: «Историю показывать в готовом окне Figma»).
 * Окна истории настроек среди кадров нет — собрано по образцу «История итога» (У11 2224:8834):
 * новое сверху, что произошло, правило и срок, кто и когда.
 */
export function AttestationHistoryModal({ yearId, subjectId, subtitle, settings, onClose }: {
  yearId: number;
  subjectId: number;
  subtitle: string;
  /** Чтобы назвать класс версии по её `classId`: в снимке аудита только id. */
  settings: readonly AttestationSetting[];
  onClose: () => void;
}) {
  const history = useAttestationSettingsHistory(yearId, subjectId);
  const events = [...(history.data ?? [])].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const classNames = new Map(settings.filter((s) => s.classId != null).map((s) => [s.classId, s.className]));

  return (
    <Modal open title="История настроек аттестации" subtitle={subtitle} onClose={onClose}>
      {history.isPending ? <LoadingBlock /> : history.isError
        ? <ErrorBlock message="Не удалось загрузить историю настроек" onRetry={() => void history.refetch()} />
        : events.length === 0
          ? <p className="text-13 text-muted">Изменений пока не было — все классы аттестуются по умолчанию.</p>
          : (
            <ol className="flex flex-col">
              {events.map((event) => {
                const state = payload(event.after) ?? payload(event.before);
                const scope = state?.parallel ? `${state.parallel} параллель`
                  : classNames.get(state?.classId ?? undefined) ?? 'Класс';
                const term = [
                  state?.effectiveFromDate ? `с ${fullDate(state.effectiveFromDate)}` : null,
                  state?.effectiveToDate ? `до ${fullDate(state.effectiveToDate)}` : null,
                ].filter(Boolean).join(' ');
                return (
                  <li key={event.id} className="flex flex-col gap-0.5 border-b border-line py-4 text-13 first:pt-0 last:border-b-0">
                    <p className="font-semibold text-ink">{event.action ? ACTION_LABELS[event.action] : 'Событие'}: {scope}</p>
                    {state && <p className="text-slate-700">{ruleLine(state)}{term ? `, ${term}` : ''}</p>}
                    <p className="text-muted">{event.actorName?.trim() || 'Администратор'} · {formatDateTime(event.createdAt)}</p>
                  </li>
                );
              })}
            </ol>
          )}
    </Modal>
  );
}
