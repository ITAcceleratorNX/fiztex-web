import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AiJobProgress } from '@/components/ui/AiJobProgress';
import { Button } from '@/components/ui/Button';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { ApiError } from '@/lib/api';
import { homeworkAiApi } from '@/lib/homeworkAiApi';
import { RecommendationCard } from './RecommendationCard';
import { useAiGradeSuggestion } from './useAiGradeSuggestion';

/**
 * Проверка ИИ на экране обычного задания — текста и вложений (ТЗ §11, AIGRADE-006).
 *
 * <p>Кнопка одна на всю работу, как и у теста: ТЗ §4.1 требует именно этого, а разбор по
 * вопросам здесь показывать не по чему — вопросов нет. Модель читает текст, фотографии и
 * приложенные файлы, называет процент выполнения, а в оценку его переводит школьная шкала.
 *
 * <p>Блок ничего не блокирует: отказ ИИ оставляет и комментарий, и оценку доступными —
 * это AC-9 и главный инвариант всей фичи.
 */
export function SubmissionAiReview({
  homeworkId,
  studentProfileId,
  attemptId,
  photoCount = 0,
  canTransfer = true,
  onConfirm,
}: {
  homeworkId: number;
  studentProfileId: number;
  attemptId?: number;
  photoCount?: number;
  canTransfer?: boolean;
  onConfirm?: (draft: PhotoAiDraft, restored?: boolean) => void;
}) {
  const ai = useAiGradeSuggestion(homeworkId, studentProfileId);
  const [recognizedText, setRecognizedText] = useState('');
  const [grade, setGrade] = useState('');
  const [comment, setComment] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const restoredKey = useRef<string | null>(null);

  useEffect(() => {
    setRecognizedText(ai.recommendation?.teacherRecognizedText ?? ai.recommendation?.recognizedText ?? '');
    const savedGrade = ai.recommendation?.teacherGrade ?? ai.recommendation?.suggestedGrade;
    setGrade(savedGrade != null ? String(savedGrade) : '');
    setComment(ai.recommendation?.teacherComment ?? ai.recommendation?.suggestedComment ?? '');
    setConfirmed(ai.recommendation?.teacherConfirmedAt != null);
    setConfirmationError(null);
  }, [ai.recommendation, studentProfileId]);

  useEffect(() => {
    const recommendation = ai.recommendation;
    if (attemptId == null || recommendation?.teacherConfirmedAt == null) return;
    const key = `${attemptId}:${recommendation.teacherConfirmedAt}`;
    if (restoredKey.current === key) return;
    restoredKey.current = key;
    onConfirm?.({
      recognizedText: recommendation.teacherRecognizedText ?? recommendation.recognizedText ?? '',
      grade: recommendation.teacherGrade ?? null,
      comment: recommendation.teacherComment ?? '',
    }, true);
  }, [ai.recommendation, attemptId, onConfirm]);

  const photoReview = photoCount > 0 && ai.recommendation?.basis === 'COMPLETENESS';

  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="ai-review-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ai-review-heading" className="text-base font-semibold text-ink">
            Проверка ИИ
          </h2>
          <p className="mt-1 text-13 text-muted">
            ИИ читает работу и предлагает оценку. Решение и журнал остаются за вами.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={ai.starting || ai.isRunning || ai.unavailableText != null}
          loading={ai.starting}
          onClick={() => void ai.start()}
        >
          <Sparkles className="size-4" aria-hidden />
          {ai.isRunning ? 'Проверяю работу…' : photoCount > 0 ? 'Проверить с AI' : 'Получить рекомендацию ИИ'}
        </Button>
      </div>

      {ai.unavailableText && <NoticeBar tone="soft">{ai.unavailableText}</NoticeBar>}

      {ai.job && (
        <AiJobProgress
          job={ai.job}
          fallbackAction={
            <p className="text-11 text-muted">Оценку можно поставить вручную ниже.</p>
          }
        />
      )}

      {ai.recommendation && <RecommendationCard recommendation={ai.recommendation} photoMode={photoCount > 0} />}

      {photoReview && (
        <div className="space-y-4 rounded-xl border border-line p-4">
          <div>
            <h3 className="text-13 font-semibold text-ink">Распознанная фото-работа</h3>
            <p className="mt-1 text-11 text-muted">
              Сверьте текст и формулы с оригинальными фото ниже. Сомнительные места AI не должен угадывать.
            </p>
          </div>
          {(ai.recommendation?.uncertainFragments?.length ?? 0) > 0 && (
            <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-13">
              <p className="font-semibold">Проверьте по фото</p>
              <ul className="mt-1 list-inside list-disc">
                {ai.recommendation?.uncertainFragments?.map((fragment, index) =>
                  <li key={`${index}-${fragment}`}>{fragment}</li>)}
              </ul>
            </div>
          )}
          <label className="block text-13 font-medium text-ink" htmlFor="ai-recognized-text">
            Текст и формулы по порядку страниц
          </label>
          <textarea id="ai-recognized-text" value={recognizedText}
            onChange={(event) => { setRecognizedText(event.target.value); setConfirmed(false); }}
            rows={8} className="input-base w-full resize-y font-mono text-13" />
          <p className="text-11 text-muted">
            Исправление распознанного текста не пересчитывает рекомендацию AI. При необходимости измените оценку и комментарий сами.
          </p>
          {(ai.recommendation?.strengths?.length ?? 0) > 0 && (
            <div className="text-13 text-ink">
              <p className="font-semibold">Что выполнено правильно</p>
              <ul className="mt-1 list-inside list-disc">
                {ai.recommendation?.strengths?.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
              </ul>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-[140px_1fr]">
            <label className="text-13 font-medium text-ink" htmlFor="ai-suggested-grade">
              Оценка 1–10
              <input id="ai-suggested-grade" type="number" min={1} max={10} step={1}
                value={grade} onChange={(event) => { setGrade(event.target.value); setConfirmed(false); }}
                className="input-base mt-1 w-full" />
            </label>
            <label className="text-13 font-medium text-ink" htmlFor="ai-suggested-comment">
              Комментарий ученику
              <textarea id="ai-suggested-comment" value={comment} maxLength={2000}
                onChange={(event) => { setComment(event.target.value); setConfirmed(false); }}
                rows={3} className="input-base mt-1 w-full resize-y" />
            </label>
          </div>
          <Button type="button" size="sm"
            disabled={saving || !canTransfer || attemptId == null || (grade !== '' &&
              (!Number.isInteger(Number(grade)) || Number(grade) < 1 || Number(grade) > 10))}
            loading={saving}
            onClick={async () => {
              if (attemptId == null) return;
              const draft = { recognizedText, grade: grade === '' ? null : Number(grade), comment };
              setSaving(true);
              setConfirmationError(null);
              try {
                await homeworkAiApi.confirmPhotoReview(homeworkId, studentProfileId, {
                  expectedAttemptId: attemptId, ...draft,
                });
                onConfirm?.(draft);
                setConfirmed(true);
              } catch (error) {
                setConfirmationError(error instanceof ApiError ? error.message : 'Не удалось сохранить AI-черновик');
              } finally {
                setSaving(false);
              }
            }}>
            {saving ? 'Сохраняю…' : 'Передать в проверку ДЗ'}
          </Button>
          {confirmationError && <p role="alert" className="text-13 text-red-600">{confirmationError}</p>}
          {!canTransfer && <p className="text-11 text-muted">
            Работа уже проверена. Новый комментарий можно передать только при проверке следующей отправки.
          </p>}
          {confirmed && <p role="status" className="text-11 text-muted">
            Черновик сохранён и передан ниже. Проверьте комментарий и отдельно подтвердите решение и оценку.
          </p>}
        </div>
      )}
    </section>
  );
}

export interface PhotoAiDraft {
  recognizedText: string;
  grade: number | null;
  comment: string;
}
