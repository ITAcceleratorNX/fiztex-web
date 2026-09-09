import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useAntiCheatLog } from '@/hooks/queries';
import { formatDateTime } from '@/lib/format';
import {
  ANTI_CHEAT_EVENT_LABELS,
  type AntiCheatAttempt,
  type AntiCheatEventType,
} from '@/lib/homeworkAntiCheatApi';

/**
 * Античит-события рядом с ответом ученика (ТЗ ANTICHEAT-001 §6, §8).
 *
 * <p><b>Блок ничего не советует.</b> Ни «списывал», ни «снизить оценку», ни цветовой
 * тревоги на всю карточку: ТЗ прямо запрещает системе решать за учителя. Здесь только
 * факты — что, когда и на каком вопросе, — а вывод делает человек.
 *
 * <p>Пустой журнал при выключённом античите — не «нарушений не было», а «наблюдения не
 * было», и подписи эти два случая различают: перепутав их, учитель принял бы решение по
 * данным, которых никто не собирал.
 */
export function SubmissionAntiCheat({
  homeworkId,
  studentProfileId,
}: {
  homeworkId: number;
  studentProfileId: number;
}) {
  const query = useAntiCheatLog(homeworkId, studentProfileId);
  const log = query.data;

  // Выключён и ничего не записано — говорить не о чем, и пустая карточка «нарушений нет»
  // только вводила бы в заблуждение.
  if (!query.isPending && !query.isError && !log?.enabled && (log?.attempts?.length ?? 0) === 0) {
    return null;
  }

  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="anti-cheat-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="anti-cheat-heading" className="text-base font-semibold text-ink">
            Античит
          </h2>
          <p className="mt-1 text-13 text-muted">
            {log?.enabled
              ? 'Что зафиксировало приложение во время работы. Решение по оценке — за вами.'
              : 'Наблюдение выключено. Ниже — то, что было записано, пока оно работало.'}
          </p>
        </div>
        {(log?.violationCount ?? 0) > 0 && (
          <Badge tone="amber">
            <ShieldAlert className="size-3.5" aria-hidden />
            {violationsLabel(log?.violationCount ?? 0)}
          </Badge>
        )}
      </div>

      {query.isPending ? (
        <LoadingBlock label="Загрузка журнала…" />
      ) : query.isError ? (
        <ErrorBlock
          message="Не удалось загрузить журнал античита"
          onRetry={() => void query.refetch()}
        />
      ) : (log?.attempts?.length ?? 0) === 0 ? (
        <p className="text-13 text-muted">Нарушений не зафиксировано.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {(log?.attempts ?? []).map((attempt) => (
            <AttemptLog key={attempt.attemptId ?? 'pending'} attempt={attempt} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Одна попытка. Повторные попытки показываются отдельными группами и не смешиваются
 * (§5): «три нарушения» за две попытки и «три за одну» — разные истории.
 */
function AttemptLog({ attempt }: { attempt: AntiCheatAttempt }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-13 font-medium text-subtle">
          {attempt.attemptNumber != null ? `Версия ${attempt.attemptNumber}` : 'До отправки'}
        </h3>
        <span className="text-11 text-muted">{violationsLabel(attempt.violationCount ?? 0)}</span>
      </div>
      <ul className="flex flex-col gap-1">
        {(attempt.events ?? []).map((event) => (
          <li
            key={event.id}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded bg-neutral-bg px-2.5 py-1.5"
          >
            <span className="text-13 text-ink">
              {ANTI_CHEAT_EVENT_LABELS[event.type as AntiCheatEventType] ?? event.type}
            </span>
            {event.questionNumber != null && (
              <span className="text-11 text-muted">вопрос {event.questionNumber}</span>
            )}
            {!event.violation && <span className="text-11 text-muted">не нарушение</span>}
            <span className="ml-auto text-11 text-muted">{formatDateTime(event.occurredAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function violationsLabel(count: number): string {
  if (count === 0) return 'без нарушений';
  const tail = count % 100 >= 11 && count % 100 <= 14 ? 0 : count % 10;
  const word = tail === 1 ? 'нарушение' : tail >= 2 && tail <= 4 ? 'нарушения' : 'нарушений';
  return `${count} ${word}`;
}
