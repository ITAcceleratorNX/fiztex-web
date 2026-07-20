import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { AnswerReviewItem } from '@/lib/types';
import type { ScoreDraft } from './constants';

export function ScoreEditor({
  answer,
  draft,
  locked,
  saving,
  onChange,
  onSave,
}: {
  answer: AnswerReviewItem;
  draft: ScoreDraft;
  locked: boolean;
  saving: boolean;
  onChange: (d: ScoreDraft) => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Балл (0–{answer.maxScore})
          </label>
          <input
            type="number"
            min={0}
            max={answer.maxScore}
            value={draft.score}
            disabled={locked}
            onChange={(e) => onChange({ ...draft, score: e.target.value })}
            className="input-base h-10 w-24"
          />
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
          <Button size="sm" variant="secondary" loading={saving} onClick={onSave}>
            Сохранить
          </Button>
        )}
      </div>
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
