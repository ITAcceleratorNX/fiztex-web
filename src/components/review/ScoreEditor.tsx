import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/format';
import type { AnswerReviewItem } from '@/lib/types';
import type { ScoreDraft } from './constants';

export function ScoreEditor({
  answer,
  draft,
  locked,
  saving,
  saveError,
  dirty = false,
  onChange,
  onSave,
}: {
  answer: AnswerReviewItem;
  draft: ScoreDraft;
  locked: boolean;
  saving: boolean;
  saveError?: string;
  /** Балл изменён, но ещё не ушёл на сервер. */
  dirty?: boolean;
  onChange: (d: ScoreDraft) => void;
  onSave: () => void;
}) {
  const scoreError = validateReviewScore(draft.score, answer.maxScore);
  const scoreId = `review-score-${answer.questionId}`;
  const scoreErrorId = `${scoreId}-error`;

  return (
    <>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={scoreId} className="mb-1 block text-xs font-medium text-slate-500">
            Балл (0–{answer.maxScore})
          </label>
          <input
            id={scoreId}
            type="number"
            min={0}
            max={answer.maxScore}
            step={0.5}
            value={draft.score}
            disabled={locked}
            aria-invalid={scoreError != null}
            aria-describedby={scoreError ? scoreErrorId : undefined}
            onChange={(e) => onChange({ ...draft, score: e.target.value })}
            className={cx('input-base h-10 w-24', scoreError && 'border-red-300 focus:border-red-400 focus:ring-red-300/30')}
          />
          {scoreError && (
            <p id={scoreErrorId} className="mt-1 max-w-48 text-xs text-red-600">
              {scoreError}
            </p>
          )}
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Комментарий (необязательно)
          </label>
          <input
            type="text"
            value={draft.comment}
            disabled={locked}
            onChange={(e) => onChange({ ...draft, comment: e.target.value })}
            placeholder="Комментарий к ответу…"
            className="input-base h-10"
          />
        </div>
        {!locked && (
          <Button
            size="sm"
            variant={dirty ? 'primary' : 'secondary'}
            loading={saving}
            disabled={scoreError != null}
            onClick={onSave}
          >
            Сохранить
          </Button>
        )}
      </div>
      {!locked && dirty && (
        <p className="mt-2 text-xs text-amber-600">Не сохранено — уйдёт при подтверждении проверки</p>
      )}
      {saveError && (
        <p role="alert" aria-live="assertive" aria-atomic="true" className="mt-2 text-sm text-red-700">
          {saveError}
        </p>
      )}
      {answer.finalScore != null && (
        <p className="mt-2 text-xs text-emerald-600">
          <Check className="mr-1 inline h-3.5 w-3.5" />
          Выставлено: {answer.finalScore} / {answer.maxScore}
          {answer.adminComment ? ` · ${answer.adminComment}` : ''}
        </p>
      )}
    </>
  );
}

export function validateReviewScore(value: string, maximum: number): string | null {
  if (!value.trim()) return 'Укажите балл.';
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > maximum) {
    return `Балл должен быть от 0 до ${maximum}.`;
  }
  return null;
}
