import type { ReactNode } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui/StateBlock';
import { cx } from '@/lib/format';
import type { HomeworkAiJob } from '@/lib/homeworkAiApi';

/**
 * Состояние задачи AI-генерации словами.
 *
 * <p>Неподвижный индикатор — главная причина, по которой пользователь решает, что
 * приложение зависло, и нажимает кнопку второй раз. Разбор скана учебника идёт минутами,
 * поэтому экран обязан говорить, что происходит: не «Загрузка», а «Читаю материалы
 * урока · страница 4 из 12».
 *
 * <p>Фазы приходят с бэкенда различимыми состояниями, тексты — здесь: переводить
 * «Составляю вопросы» на казахский предстоит на клиенте, а не в базе.
 *
 * <p>Ошибку показываем без кода и без номера задачи: учителю нужно понимать, что делать,
 * а не что сломалось. Поэтому рядом с текстом — действие, которое всегда доступно.
 */
export function AiJobProgress({
  job,
  fallbackAction,
  className,
}: {
  job: HomeworkAiJob | undefined;
  /** Что предложить, когда модель не справилась. Обычно «Написать самому». */
  fallbackAction?: ReactNode;
  className?: string;
}) {
  if (!job) return null;

  if (job.status === 'FAILED') {
    return (
      <div className={cx('flex flex-col gap-3 rounded-xl bg-danger-bg px-4 py-3', className)}>
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
          <div>
            <p className="text-13 font-medium text-red-600">Не удалось сгенерировать</p>
            <p className="mt-0.5 text-11 text-muted">
              {job.errorMessage ?? 'Попробуйте ещё раз или напишите задание сами.'}
            </p>
          </div>
        </div>
        {fallbackAction}
      </div>
    );
  }

  if (job.status === 'DONE') {
    return (
      <div className={cx('flex items-start gap-2.5 rounded-xl bg-success-bg px-4 py-3', className)}>
        <Sparkles className="mt-0.5 size-4 shrink-0 text-success-fg" aria-hidden />
        <div>
          <p className="text-13 font-medium text-success-fg">Готово</p>
          {job.warningMessage && (
            <p className="mt-0.5 text-11 text-muted">{job.warningMessage}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cx('flex items-start gap-3 rounded-xl bg-info-bg px-4 py-3', className)}>
      <Spinner className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-13 font-medium text-ink">{phaseLabel(job)}</p>
        {/* Уйти со страницы можно: задача живёт на сервере, а не во вкладке. */}
        <p className="mt-0.5 text-11 text-muted">
          Окно можно закрыть — результат сохранится и дождётся вас.
        </p>
      </div>
    </div>
  );
}

/**
 * Фаза словами. Счётчик добавляется только там, где шагов правда несколько: «1 из 1» —
 * шум, и бэкенд в таком случае его не присылает.
 */
function phaseLabel(job: HomeworkAiJob): string {
  const base = PHASE_LABELS[job.phase ?? ''] ?? 'Начинаю…';
  const done = job.progressDone;
  const total = job.progressTotal;
  if (done == null || total == null || total <= 1) return base;
  return `${base} · ${done} из ${total}`;
}

const PHASE_LABELS: Record<string, string> = {
  READING_MATERIALS: 'Читаю материалы урока',
  CALLING_MODEL: 'Составляю',
  APPLYING: 'Почти готово',
};
