import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useSurveyRespondentAnswers, useSurveyRespondents } from '@/hooks/surveyQueries';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/api';
import type { SurveyResponseStatus } from '@/lib/surveyApi';

const STATUS_LABEL: Record<SurveyResponseStatus, string> = {
  NOT_STARTED: 'Не начал',
  IN_PROGRESS: 'Начал',
  COMPLETED: 'Ответил',
};

const STATUS_TONE: Record<SurveyResponseStatus, 'green' | 'amber' | 'gray'> = {
  NOT_STARTED: 'gray',
  IN_PROGRESS: 'amber',
  COMPLETED: 'green',
};

/**
 * «Кто ответил» — только для именного опроса. У анонимного этот раздел не рендерится
 * вовсе (см. `SurveyResultsTab`): бэкенд на `GET .../respondents` для `ANONYMOUS` отвечает
 * 409 `SURVEY_ANONYMOUS`, и нет смысла посылать запрос, которому заранее известен отказ.
 *
 * Ответы конкретного человека подгружаются по клику на строку, а не все сразу вместе со
 * списком — список нужен почти всегда только для счёта «кто ещё не ответил», а разбор
 * ответов одного респондента — по требованию.
 */
export function SurveyRespondentsSection({
  surveyId,
  classId,
}: {
  surveyId: number;
  classId?: number;
}) {
  const [openRecipientId, setOpenRecipientId] = useState<number | null>(null);
  const respondentsQuery = useSurveyRespondents(surveyId, classId);
  const respondents = respondentsQuery.data ?? [];

  return (
    <div className="card p-5">
      <h3 className="mb-3 font-semibold text-slate-800">Кто ответил</h3>

      {respondentsQuery.isLoading ? (
        <LoadingBlock label="Загрузка списка…" />
      ) : respondentsQuery.isError ? (
        <ErrorBlock
          message={
            respondentsQuery.error instanceof ApiError
              ? respondentsQuery.error.message
              : 'Не удалось загрузить список ответивших'
          }
          onRetry={() => void respondentsQuery.refetch()}
        />
      ) : respondents.length === 0 ? (
        <EmptyBlock title="Пока некому — у опроса ещё нет получателей" />
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="py-1.5">Имя</th>
              <th className="py-1.5">Класс</th>
              <th className="py-1.5">Статус</th>
              <th className="py-1.5">Когда ответил</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {respondents.map((r) => (
              <tr
                key={r.recipientId}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => r.status === 'COMPLETED' && setOpenRecipientId(r.recipientId ?? null)}
              >
                <td className="py-1.5 text-sm font-medium text-slate-700">{r.fullName}</td>
                <td className="py-1.5 text-sm text-slate-500">{r.classNames || '—'}</td>
                <td className="py-1.5">
                  <Badge tone={STATUS_TONE[r.status ?? 'NOT_STARTED']}>
                    {STATUS_LABEL[r.status ?? 'NOT_STARTED']}
                  </Badge>
                </td>
                <td className="py-1.5 text-sm text-slate-500">{formatDateTime(r.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <RespondentAnswersModal
        surveyId={surveyId}
        recipientId={openRecipientId}
        onClose={() => setOpenRecipientId(null)}
      />
    </div>
  );
}

function RespondentAnswersModal({
  surveyId,
  recipientId,
  onClose,
}: {
  surveyId: number;
  recipientId: number | null;
  onClose: () => void;
}) {
  const answersQuery = useSurveyRespondentAnswers(surveyId, recipientId);
  const data = answersQuery.data;

  return (
    <Modal open={recipientId != null} onClose={onClose} title={data?.fullName ?? 'Ответы'} size="lg">
      {answersQuery.isLoading ? (
        <LoadingBlock label="Загрузка ответов…" />
      ) : answersQuery.isError ? (
        <ErrorBlock
          message={
            answersQuery.error instanceof ApiError ? answersQuery.error.message : 'Не удалось загрузить ответы'
          }
        />
      ) : !data ? null : (
        <div className="space-y-4">
          {(data.answers ?? []).map((answer) => (
            <div key={answer.questionId}>
              <p className="mb-1.5 text-sm font-semibold text-slate-800">
                {answer.orderIndex != null ? `${answer.orderIndex + 1}. ` : ''}
                {answer.questionText}
              </p>
              {answer.type === 'OPEN_TEXT' ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {answer.openText || <span className="text-slate-400">Без ответа</span>}
                </p>
              ) : (answer.selectedOptionTexts ?? []).length === 0 ? (
                <p className="text-sm text-slate-400">Без ответа</p>
              ) : (
                <ul className="space-y-1">
                  {(answer.selectedOptionTexts ?? []).map((text, i) => (
                    <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
