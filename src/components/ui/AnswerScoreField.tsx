import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/format';

/**
 * Решение учителя по одному ответу теста.
 *
 * <p>Здесь намеренно три разные сущности: детерминированный результат закрытого
 * вопроса, мнение модели об открытом и балл, который выбирает учитель. Их нельзя
 * склеивать в одно число: рекомендация ИИ не должна выглядеть как уже выставленная
 * оценка, а автопроверка не должна тихо становиться решением человека.
 */
export function AnswerScoreField({
  inputId,
  score,
  maxScore,
  autoScore,
  aiSuggestedScore,
  aiRationale,
  disabled = false,
  saving = false,
  dirty = false,
  onScoreChange,
  onAcceptSuggestion,
  onSave,
}: {
  inputId: string;
  /** Строка, а не number: во время ввода допустимы временно пустое и неполное значение. */
  score: string;
  maxScore?: number;
  autoScore?: number | null;
  aiSuggestedScore?: number | null;
  aiRationale?: string | null;
  disabled?: boolean;
  saving?: boolean;
  dirty?: boolean;
  onScoreChange: (score: string) => void;
  /** Явное действие только переносит рекомендацию в поле; сохранение остаётся отдельным. */
  onAcceptSuggestion?: () => void;
  onSave: () => void;
}) {
  const maximum = maxScore ?? 0;
  const issue = validateScore(score, maximum);
  const hasScore = score.trim().length > 0;
  const canSave = dirty && hasScore && issue == null && !disabled && !saving;

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      {autoScore != null && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-info-bg px-3 py-2.5">
          <div>
            <p className="text-11 font-semibold uppercase tracking-wide text-info-fg">Автопроверка</p>
            <p className="mt-0.5 text-13 text-muted">Закрытый вопрос проверен по ключу ответа.</p>
          </div>
          <ScoreValue value={autoScore} maximum={maximum} className="text-info-fg" />
        </div>
      )}

      {aiSuggestedScore != null && (
        <div className="flex flex-col gap-3 rounded-xl bg-vacation-bg px-3 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge tone="purple" dot>
                Предлагает ИИ
              </Badge>
              {aiRationale && <p className="mt-2 text-13 leading-5 text-ink">{aiRationale}</p>}
            </div>
            <ScoreValue value={aiSuggestedScore} maximum={maximum} className="text-vacation-fg" />
          </div>
          {!disabled && onAcceptSuggestion && (
            <div>
              <Button type="button" size="sm" variant="secondary" onClick={onAcceptSuggestion}>
                <Sparkles className="size-4" aria-hidden />
                Принять предложенное
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={inputId} className="label-base">
            Балл учителя <span className="font-normal text-subtle">из {formatScore(maximum)}</span>
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="decimal"
            min={0}
            max={maximum}
            step={0.01}
            value={score}
            disabled={disabled || saving}
            aria-invalid={issue != null}
            aria-describedby={`${inputId}-help`}
            onChange={(event) => onScoreChange(event.target.value)}
            className={cx('input-base h-10 w-28', issue && 'border-red-500 focus:border-red-500 focus:ring-red-200')}
          />
        </div>

        <Button
          type="button"
          size="sm"
          variant={dirty ? 'primary' : 'secondary'}
          loading={saving}
          disabled={!canSave}
          onClick={onSave}
        >
          Сохранить балл
        </Button>
      </div>

      <p id={`${inputId}-help`} className={cx('text-11', issue ? 'text-red-600' : 'text-subtle')}>
        {issue ?? helperText({ hasScore, autoScore, aiSuggestedScore, dirty })}
      </p>
    </div>
  );
}

function ScoreValue({ value, maximum, className }: { value: number; maximum: number; className: string }) {
  return (
    <span className={cx('shrink-0 text-sm font-semibold tabular-nums', className)}>
      {formatScore(value)} / {formatScore(maximum)}
    </span>
  );
}

function helperText({
  hasScore,
  autoScore,
  aiSuggestedScore,
  dirty,
}: {
  hasScore: boolean;
  autoScore?: number | null;
  aiSuggestedScore?: number | null;
  dirty: boolean;
}) {
  if (dirty) return 'Правка ещё не сохранена.';
  if (hasScore) return 'Это сохранённое решение учителя.';
  if (autoScore != null) return 'Оставьте поле пустым, чтобы в зачёт пошёл результат автопроверки.';
  if (aiSuggestedScore != null) return 'Подсказка ИИ не станет баллом, пока вы не сохраните решение.';
  return 'Введите балл после проверки ответа.';
}

function validateScore(value: string, maximum: number): string | null {
  if (!value.trim()) return null;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > maximum) {
    return `Введите число от 0 до ${formatScore(maximum)}.`;
  }
  return null;
}

function formatScore(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}
