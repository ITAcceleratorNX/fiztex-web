import type { ReactNode } from 'react';
import { MathText } from '@/components/ui/MathText';
import { Button } from '@/components/ui/Button';
import type { AiRecommendation } from '@/lib/homeworkAiApi';
import { RecognitionPages } from './RecognitionPages';

/**
 * Рекомендация за работу целиком (ТЗ §6).
 *
 * <p>Оценку здесь выбрала не модель: у теста баллы сложила система, у обычного задания
 * модель назвала процент выполнения, — а в оценку то и другое перевела школьная шкала.
 * Модель написала обоснование и перечень ошибок, и об этом на карточке сказано прямо:
 * иначе «рекомендует ИИ» читается как «так решил компьютер».
 *
 * <p>Одна карточка на оба экрана проверки — теста и обычной работы. Второй такой блок
 * разошёлся бы с первым в формулировках ровно там, где учителю важно им верить.
 *
 * <p>Разбор по частям (QA B2-021…B2-024): что дословно прочитано с каждого фото, где ИИ не
 * уверен, правильное решение и предполагаемые ошибки — отдельными блоками. Расшифровка и
 * выводы модели не смешиваются: первое — что написал ученик, второе — что о нём думает ИИ.
 * Ничего из этого не сохраняется в журнал и в ответ ученику само: комментарий можно только
 * подставить в поле, а оценку учитель ставит в блоке оценки.
 */
export function RecommendationCard({
  recommendation,
  homeworkId,
  studentProfileId,
  loadAttachment,
  onUseComment,
}: {
  recommendation: AiRecommendation;
  homeworkId?: number;
  studentProfileId?: number;
  loadAttachment?: (id: number) => Promise<Blob>;
  /** Подставить комментарий ИИ в поле обратной связи — правит и отправляет учитель. */
  onUseComment?: (text: string) => void;
}) {
  const issues = recommendation.issues ?? [];
  const doubtful = recommendation.doubtful ?? [];
  const pages = recommendation.recognized ?? [];
  const closedMax = Number(recommendation.closedMax ?? 0);
  const tenPoint = recommendation.suggestedScore != null;

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-line bg-neutral-bg p-4"
      aria-label="Рекомендация за работу"
    >
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-11 font-semibold uppercase tracking-wide text-subtle">
            Рекомендация за работу
          </p>
          <p className="text-11 text-muted">
            {/*
              У теста баллы есть и они главное; у обычного задания их нет вовсе, и «2,5 из 3
              баллов» там было бы выдумкой: процент выполнения — единственное, что известно.
            */}
            {recommendation.basis === 'COMPLETENESS'
              ? `Выполнено на ${recommendation.percent ?? 0}%`
              : `${formatScore(recommendation.score)} из ${formatScore(recommendation.maxScore)} баллов` +
                (recommendation.percent != null ? ` · ${recommendation.percent}%` : '')}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {tenPoint ? (
            <span
              className="rounded-lg bg-white px-3 py-1.5 text-lg font-semibold text-ink ring-1 ring-line"
              aria-label={`Предлагаемая оценка ${recommendation.suggestedScore} из ${recommendation.suggestedMaxScore}`}
            >
              {recommendation.suggestedScore}
              <span className="text-13 font-medium text-muted"> / {recommendation.suggestedMaxScore}</span>
            </span>
          ) : recommendation.scaleCode ? (
            <span className="rounded-lg bg-white px-3 py-1.5 text-lg font-semibold text-ink ring-1 ring-line">
              {recommendation.scaleCode}
            </span>
          ) : (
            <span className="text-13 text-muted">
              Оценка не выведена: школа не задала пороги. Решите по баллам.
            </span>
          )}
          <p className="text-11 text-muted">
            Не оценка: в журнал ничего не попадёт, пока вы не выставите её сами.
          </p>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-11 font-semibold uppercase tracking-wide text-subtle">Комментарий ИИ</p>
          {onUseComment && recommendation.summary && (
            <Button variant="ghost" size="text" onClick={() => onUseComment(recommendation.summary ?? '')}>
              Подставить в комментарий ученику
            </Button>
          )}
        </div>
        <MathText text={recommendation.summary} className="mt-1 block text-13 text-ink" />
      </div>

      {issues.length > 0 && (
        <Block title="Предполагаемые ошибки">
          <ul className="list-inside list-disc space-y-1 text-13 text-ink">
            {issues.map((issue) => (
              <li key={issue}><MathText text={issue} /></li>
            ))}
          </ul>
        </Block>
      )}

      {doubtful.length > 0 && (
        <Block title="Сомнительные места — проверьте сами">
          <ul className="list-inside list-disc space-y-1 text-13 text-ink">
            {doubtful.map((item) => (
              <li key={item}><MathText text={item} /></li>
            ))}
          </ul>
        </Block>
      )}

      {recommendation.solution && (
        <Block title="Правильное решение по мнению ИИ">
          <MathText text={recommendation.solution} className="block whitespace-pre-wrap text-13 text-ink" />
        </Block>
      )}

      {pages.length > 0 && homeworkId != null && studentProfileId != null && (
        <RecognitionPages
          homeworkId={homeworkId}
          studentProfileId={studentProfileId}
          pages={pages}
          loadAttachment={loadAttachment}
          editedByName={recommendation.recognitionEditedByName}
        />
      )}

      {closedMax > 0 && (
        <p className="text-11 text-muted">
          Из них {formatScore(recommendation.closedScore)} из {formatScore(recommendation.closedMax)}{' '}
          за закрытые вопросы — их проверила система, ИИ их не пересматривал.
        </p>
      )}
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-11 font-semibold uppercase tracking-wide text-subtle">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** Балл без хвоста нулей: «2», а не «2.00» — это читает человек. */
function formatScore(value: number | undefined): string {
  if (value == null) return '0';
  return String(Number(value)).replace('.', ',');
}
