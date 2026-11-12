import { useState } from 'react';
import { History, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import {
  useAssessmentHistory,
  useAssessmentResults,
  useCorrectAssessmentResult,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { AssessmentStudentResult } from '@/lib/assessmentWorksApi';
import {
  REASON_MAX_LENGTH,
  correctionProblem,
  resultEventActor,
  resultEventTitle,
  scoreLabel,
} from '@/lib/assessmentCorrectionModel';
import type { Lesson } from '@/lib/lessonsApi';

/**
 * Баллы СОЧ на листе оценок урока и исправление выставленного балла
 * (ТЗ «Исправление результатов СОЧ», размещение — блок СОЧ действующего журнала).
 *
 * <p><b>Право исправлять называет сервер</b> (`canCorrect`): учитель предмета и администратор.
 * Закрытая четверть кнопку не прячет — исправление возможно в любое время. Первичной выставки
 * балла здесь нет: ученик без балла показывается прочерком, а не нулём.
 *
 * <p>Опубликованный итог четверти исправление не трогает; об этом сказано в самом окне, а
 * повторное подтверждение учитель делает в «Итогах четверти».
 */
export function AssessmentSochCard({ lesson }: { lesson: Lesson }) {
  const works = (lesson.assessmentWorks ?? []).filter(
    (work) => work.kind === 'SOCH' && work.status !== 'CANCELLED' && work.id != null,
  );
  if (works.length === 0) return null;
  return (
    <>
      {works.map((work) => (
        <SochSheet key={work.id} workId={work.id as number} />
      ))}
    </>
  );
}

function SochSheet({ workId }: { workId: number }) {
  const results = useAssessmentResults(workId);
  const [correcting, setCorrecting] = useState<AssessmentStudentResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Лист читают учитель предмета и администратор; остальным карточки на странице нет вовсе.
  if (results.isError && results.error instanceof ApiError && [403, 404].includes(results.error.status)) {
    return null;
  }

  return (
    <section
      aria-label="Результаты СОЧ"
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-8"
    >
      {results.isPending ? (
        <LoadingBlock label="Загружаем результаты СОЧ…" />
      ) : results.isError ? (
        <ErrorBlock message="Не удалось загрузить результаты СОЧ" onRetry={() => void results.refetch()} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-bold text-slate-900">
              СОЧ · максимум {results.data.work?.maxScore}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="size-4" />
              История исправлений
            </Button>
          </div>
          <div className="flex flex-col">
            {(results.data.students ?? []).map((row) => (
              <div
                key={row.studentProfileId}
                className="flex items-center justify-between gap-4 border-b border-slate-200 px-3 py-3 last:border-b-0"
              >
                <span className="truncate text-slate-900">{row.studentName}</span>
                <span className="flex items-center gap-3">
                  <span
                    className="text-sm font-semibold text-slate-900"
                    title={row.score == null ? 'Балл не выставлен' : undefined}
                  >
                    {scoreLabel(row.score, results.data.work?.maxScore)}
                  </span>
                  {results.data.canCorrect && row.score != null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Исправить балл СОЧ: ${row.studentName}`}
                      onClick={() => setCorrecting(row)}
                    >
                      <Pencil className="size-4" />
                      Исправить
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
          {correcting && (
            <CorrectionModal
              workId={workId}
              maxScore={results.data.work?.maxScore ?? 0}
              row={correcting}
              onClose={() => setCorrecting(null)}
            />
          )}
          {historyOpen && (
            <SochHistoryModal
              workId={workId}
              maxScore={results.data.work?.maxScore}
              onClose={() => setHistoryOpen(false)}
            />
          )}
        </>
      )}
    </section>
  );
}

function CorrectionModal({
  workId,
  maxScore,
  row,
  onClose,
}: {
  workId: number;
  maxScore: number;
  row: AssessmentStudentResult;
  onClose: () => void;
}) {
  const correct = useCorrectAssessmentResult();
  const [score, setScore] = useState(String(row.score ?? ''));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const problem = correctionProblem({
    score,
    reason,
    currentScore: row.score ?? -1,
    maxScore,
  });

  async function save() {
    if (problem || row.studentProfileId == null) return;
    setError(null);
    try {
      await correct.mutateAsync({
        workId,
        studentProfileId: row.studentProfileId,
        score: Number(score.trim()),
        reason: reason.trim(),
        expectedVersion: row.version,
      });
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Не удалось сохранить исправление');
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!correct.isPending) onClose();
      }}
      title="Исправить балл СОЧ"
      subtitle={row.studentName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={correct.isPending} onClick={onClose}>
            Отмена
          </Button>
          <Button loading={correct.isPending} disabled={problem != null} onClick={() => void save()}>
            Сохранить исправление
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-13 text-muted">
          Сейчас: {scoreLabel(row.score, maxScore)}. Прежний балл, причина, автор и время сохранятся в
          истории. Расчёт четверти обновится, а уже опубликованный итог останется прежним, пока учитель
          не подтвердит его повторно в «Итогах четверти».
        </p>
        <Field label={`Новый балл (0–${maxScore})`}>
          <TextInput
            inputMode="numeric"
            value={score}
            disabled={correct.isPending}
            onChange={(event) => setScore(event.target.value)}
          />
        </Field>
        <Field label="Причина исправления">
          <TextArea
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            disabled={correct.isPending}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        {problem && (score !== String(row.score ?? '') || reason !== '') && (
          <p role="status" className="text-13 text-muted">
            {problem}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function SochHistoryModal({
  workId,
  maxScore,
  onClose,
}: {
  workId: number;
  maxScore: number | undefined;
  onClose: () => void;
}) {
  const history = useAssessmentHistory(workId);
  // Новые исправления сверху; записи дополняют историю и не затирают прежние.
  const events = [...(history.data?.results ?? [])].reverse();
  return (
    <Modal open onClose={onClose} title="История исправлений СОЧ" scrollable>
      {history.isPending ? (
        <LoadingBlock label="Загружаем историю…" />
      ) : history.isError ? (
        <ErrorBlock message="Не удалось загрузить историю" onRetry={() => void history.refetch()} />
      ) : events.length === 0 ? (
        <EmptyBlock title="Исправлений пока нет" />
      ) : (
        <ol className="space-y-3" aria-label="Исправления СОЧ">
          {events.map((event) => (
            <li key={event.id} className="rounded-lg border border-slate-200 p-3 text-13">
              <p className="font-semibold text-slate-900">
                {event.studentName}: {resultEventTitle(event, maxScore)}
              </p>
              {event.reason && <p className="mt-1 text-slate-700">Причина: {event.reason}</p>}
              <p className="mt-1 text-muted">
                {resultEventActor(event)}
                {event.at ? ` · ${new Date(event.at).toLocaleString('ru-RU')}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
