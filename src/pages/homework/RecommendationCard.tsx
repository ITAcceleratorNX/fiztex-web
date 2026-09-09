import { MathText } from '@/components/ui/MathText';
import type { AiRecommendation } from '@/lib/homeworkAiApi';

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
 */
export function RecommendationCard({ recommendation }: { recommendation: AiRecommendation }) {
  const issues = recommendation.issues ?? [];
  const closedMax = Number(recommendation.closedMax ?? 0);

  return (
    <section
      className="rounded-xl border border-line bg-neutral-bg p-4"
      aria-label="Рекомендация за работу"
    >
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
        {recommendation.scaleCode ? (
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

      <MathText text={recommendation.summary} className="mt-3 block text-13 text-ink" />

      {issues.length > 0 && (
        <ul className="mt-3 list-inside list-disc space-y-1 text-13 text-ink">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      {closedMax > 0 && (
        <p className="mt-3 text-11 text-muted">
          Из них {formatScore(recommendation.closedScore)} из {formatScore(recommendation.closedMax)}{' '}
          за закрытые вопросы — их проверила система, ИИ их не пересматривал.
        </p>
      )}
    </section>
  );
}

/** Балл без хвоста нулей: «2», а не «2.00» — это читает человек. */
function formatScore(value: number | undefined): string {
  if (value == null) return '0';
  return String(Number(value)).replace('.', ',');
}

