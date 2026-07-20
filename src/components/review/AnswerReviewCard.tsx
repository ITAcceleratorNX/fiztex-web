import { Check, X, AlertTriangle } from 'lucide-react';
import { cx } from '@/lib/format';
import type { AnswerReviewItem } from '@/lib/types';
import { TYPE_LABEL, type ScoreDraft } from './constants';
import { PhotoViewer } from './PhotoViewer';
import { ScoreEditor } from './ScoreEditor';

export function AnswerReviewCard({
  index,
  answer,
  draft,
  locked,
  saving,
  onChange,
  onSave,
}: {
  index: number;
  answer: AnswerReviewItem;
  draft: ScoreDraft;
  locked: boolean;
  saving: boolean;
  onChange: (d: ScoreDraft) => void;
  onSave: () => void;
}) {
  const isChoice = answer.type === 'SINGLE_CHOICE' || answer.type === 'MULTIPLE_CHOICE';

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Вопрос {index} · {TYPE_LABEL[answer.type]}
          {answer.topic ? ` · ${answer.topic}` : ''}
        </span>
        {isChoice && answer.autoScore != null && (
          <span className="text-xs text-slate-400">
            Авто: {answer.autoScore} / {answer.maxScore}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-slate-800">{answer.questionText}</p>

      {isChoice ? (
        <ul className="mt-3 space-y-1.5">
          {answer.options.map((o) => {
            const state = o.correct ? 'correct' : o.selected ? 'wrong' : 'neutral';
            return (
              <li
                key={o.id}
                className={cx(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1',
                  state === 'correct'
                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                    : state === 'wrong'
                      ? 'bg-red-50 text-red-700 ring-red-200'
                      : 'bg-white text-slate-600 ring-slate-200',
                )}
              >
                {o.correct ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : o.selected ? (
                  <X className="h-4 w-4 shrink-0 text-red-500" />
                ) : (
                  <span className="h-4 w-4 shrink-0" />
                )}
                <span className="flex-1">{o.text}</span>
                {o.selected && (
                  <span className="text-xs font-medium opacity-70">выбрал ученик</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 space-y-2">
          {answer.applicantAnswer?.trim() ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Ответ ученика
              </p>
              <p className="whitespace-pre-wrap">{answer.applicantAnswer}</p>
            </div>
          ) : (answer.photos ?? []).length === 0 ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Ответ ученика
              </p>
              <p className="italic text-slate-400">Нет ответа</p>
            </div>
          ) : null}
          {(answer.photos ?? []).length > 0 && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Фото ({(answer.photos ?? []).length})
              </p>
              <PhotoViewer photos={answer.photos ?? []} />
            </div>
          )}
          {answer.referenceAnswer?.trim() && (
            <div className="rounded-lg bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Эталон
              </p>
              <p className="whitespace-pre-wrap">{answer.referenceAnswer}</p>
            </div>
          )}
        </div>
      )}

      {!isChoice && answer.aiScore != null && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Черновая эвристика
            </span>
            <span className="text-xs font-medium text-amber-900">
              Ориентир балла: {answer.aiScore} / {answer.maxScore}
            </span>
            {((draft?.score ?? '') !== String(answer.aiScore)
              || (draft?.comment ?? '') !== (answer.aiComment ?? '')) && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                Изменено админом
              </span>
            )}
            {!locked && (
              <button
                type="button"
                onClick={() => onChange({ ...draft, score: String(answer.aiScore) })}
                className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                Подставить балл
              </button>
            )}
          </div>
          {(answer.aiComment || answer.aiWarning) && (
            <p className="mt-1.5 text-sm text-amber-900">
              {[answer.aiWarning, answer.aiComment].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}

      <ScoreEditor
        answer={answer}
        draft={draft}
        locked={locked}
        saving={saving}
        onChange={onChange}
        onSave={onSave}
      />
    </div>
  );
}
