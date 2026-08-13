import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { MathText } from '@/components/ui/MathText';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/StateBlock';
import { useAiQuestionVariant } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { questionToRequest, type QuestionDraft } from '@/lib/testQuestions';
import type { QuestionRequest } from '@/lib/types';

/**
 * Предпросмотр варианта вопроса «Было / Вариант AI».
 *
 * <p>Шаг подтверждения обязателен: модель пересчитывает ответ и ошибается в арифметике чаще,
 * чем хотелось бы. Поэтому рядом с вариантом показывается ход вычисления — по нему ответ можно
 * проверить за секунды, не решая задачу заново.
 */
export function AiVariantModal({
  open,
  onClose,
  original,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  original: QuestionDraft | null;
  onAdd: (variant: QuestionRequest) => void;
}) {
  const createVariant = useAiQuestionVariant();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState<QuestionRequest | null>(null);
  const [solution, setSolution] = useState<string | null>(null);

  // Окно перемонтируется на каждое открытие (ключом снаружи), поэтому запрос стартует один раз;
  // повторный вариант запрашивается кнопкой.
  const startedRef = useRef(false);
  const requestVariant = useCallback(() => {
    if (!original) return;
    // Ход запроса держим своим состоянием, а не isPending мутации: запрос стартует из эффекта,
    // и в StrictMode его наблюдатель пересоздаётся на повторном монтировании — ответ приходит,
    // а isPending навсегда остаётся true, и окно залипает на спиннере.
    setPending(true);
    setError(null);
    setVariant(null);
    setSolution(null);
    createVariant
      .mutateAsync(questionToRequest(original, 0))
      .then((result) => {
        setVariant(result.question);
        setSolution(result.solution);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Не удалось создать вариант');
      })
      .finally(() => setPending(false));
    // createVariant — новая ссылка на каждый рендер; включать её в зависимости значит
    // перезапускать генерацию бесконечно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);

  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    requestVariant();
  }, [open, requestVariant]);

  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onClose}
      title="Вариант вопроса с AI"
      subtitle="То же задание с другими исходными данными и пересчитанным ответом."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" />}
            disabled={pending}
            onClick={requestVariant}
          >
            Сгенерировать другой
          </Button>
          <Button
            disabled={!variant || pending}
            icon={<Sparkles className="h-4 w-4" />}
            onClick={() => {
              if (variant) onAdd(variant);
            }}
          >
            Добавить в тест
          </Button>
        </>
      }
    >
      {pending ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Spinner />
          <p className="text-sm font-medium text-slate-700">Создаём вариант…</p>
          <p className="text-xs text-slate-400">Обычно занимает 5–15 секунд.</p>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
          {error}
        </div>
      ) : variant && original ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <QuestionColumn
              title="Было"
              text={original.text}
              options={original.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))}
              referenceAnswer={original.referenceAnswer || null}
            />
            <QuestionColumn
              title="Вариант AI"
              highlighted
              text={variant.text}
              options={(variant.options ?? []).map((o) => ({
                text: o.text,
                isCorrect: Boolean(o.isCorrect),
              }))}
              referenceAnswer={variant.referenceAnswer ?? null}
            />
          </div>

          {solution && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <p className="font-medium text-slate-700">Как получен ответ</p>
              <p className="mt-1">
                <MathText text={solution} />
              </p>
            </div>
          )}

          <div className="flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Проверьте пересчитанный ответ — AI может ошибиться в вычислениях.</p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function QuestionColumn({
  title,
  text,
  options,
  referenceAnswer,
  highlighted = false,
}: {
  title: string;
  text: string;
  options: { text: string; isCorrect: boolean }[];
  referenceAnswer: string | null;
  highlighted?: boolean;
}) {
  return (
    <div
      className={
        highlighted
          ? 'rounded-xl border border-brand-200 bg-brand-50/40 p-3'
          : 'rounded-xl border border-slate-200 bg-white p-3'
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-sm text-slate-800">
        <MathText text={text} />
      </p>
      {options.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {options.map((o, index) => (
            <li
              key={`${title}-${index}`}
              className={o.isCorrect ? 'text-xs font-medium text-emerald-700' : 'text-xs text-slate-500'}
            >
              {o.isCorrect ? '✓ ' : '• '}
              <MathText text={o.text} />
            </li>
          ))}
        </ul>
      )}
      {referenceAnswer && (
        <p className="mt-2 text-xs text-slate-600">
          <span className="font-medium">Эталонный ответ: </span>
          <MathText text={referenceAnswer} />
        </p>
      )}
    </div>
  );
}
