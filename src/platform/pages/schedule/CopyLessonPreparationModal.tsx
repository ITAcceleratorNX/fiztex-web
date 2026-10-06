import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarArrowUp, CheckCircle2 } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import {
  useCopyLessonPreparation,
  useNextTaughtLesson,
  useLessonPreparationCopyPreview,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { PreparationCopyResult } from '@/lib/lessonPreparationApi';
import type { Lesson } from '@/lib/lessonsApi';
import {
  blockedMessage,
  copyItems,
  copyResultMessage,
  existingSummary,
  lessonAudience,
  lessonWhen,
} from '@/lib/preparationCopyModel';
import { LessonDestinationPicker } from '@/pages/workspace/LessonDestinationPicker';

type Step = 'choose' | 'confirm' | 'done';

/**
 * «Использовать повторно» с карточки урока: подготовка этого урока уходит копией в другой.
 *
 * Три шага, как в ТЗ: куда (следующий урок этого класса или любой свой), проверка (класс,
 * предмет, дата, урок и что именно перейдёт) и итог. Выбор урока — тот же
 * `LessonDestinationPicker`, что у «Использовать повторно» в рабочем пространстве: одно
 * действие не должно выглядеть по-разному в двух разделах.
 *
 * Что переносится, можно ли и что уже лежит в цели, считает бэкенд — окно лишь называет.
 * Заполненный урок молча не перезаписывается: кнопка становится «Заменить и скопировать»,
 * и сервер без этого подтверждения ответит 409.
 */
export function CopyLessonPreparationModal({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const sourceId = lesson.id!;
  const [step, setStep] = useState<Step>('choose');
  const [target, setTarget] = useState<Lesson | null>(null);
  const [result, setResult] = useState<PreparationCopyResult | null>(null);
  const [error, setError] = useState('');
  const next = useNextTaughtLesson(sourceId, step === 'choose');
  const preview = useLessonPreparationCopyPreview(sourceId, step === 'confirm' ? target?.id ?? null : null);
  const copy = useCopyLessonPreparation(sourceId);
  const nextLesson = next.data?.lesson ?? null;
  const data = preview.data;

  function choose(lesson: Lesson | null) {
    setTarget(lesson);
    setError('');
  }

  async function save() {
    if (!target?.id || !data?.canCopy || !data.targetRevision) return;
    setError('');
    try {
      const saved = await copy.mutateAsync({
        targetLessonId: target.id,
        expectedTargetRevision: data.targetRevision,
        confirmReplace: Boolean(data.targetHasContent),
      });
      setResult(saved);
      setStep('done');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось скопировать подготовку');
      // Урок могли поправить в соседней вкладке — показываем его свежим, а не старое предупреждение.
      await preview.refetch();
    }
  }

  const close = () => { if (!copy.isPending) onClose(); };

  const footer = step === 'choose' ? <>
    <Button variant="secondary" onClick={onClose}>Отмена</Button>
    <Button onClick={() => { setError(''); setStep('confirm'); }} disabled={!target}>Далее</Button>
  </> : step === 'confirm' ? <>
    <Button variant="secondary" onClick={() => setStep('choose')} disabled={copy.isPending}>Назад</Button>
    <Button onClick={() => void save()} loading={copy.isPending}
      disabled={preview.isPending || preview.isError || !data?.canCopy}>
      {data?.targetHasContent ? 'Заменить и скопировать' : 'Скопировать'}
    </Button>
  </> : <>
    <Button variant="secondary" onClick={onClose}>Готово</Button>
    <Link to={`/lesson-schedule/lessons/${target?.id}`} onClick={onClose} className={buttonClassName({})}>
      Открыть урок
    </Link>
  </>;

  return (
    <Modal open onClose={close} size="lg" footer={footer}
      title={step === 'done' ? 'Подготовка скопирована' : 'Использовать повторно'}
      subtitle={step === 'choose' ? 'Куда перенести подготовку этого урока' : undefined}>
      {step === 'choose' && (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <p className="text-11 font-bold uppercase text-slate-400">Следующий урок этого класса</p>
            {next.isPending ? <LoadingBlock /> : next.isError ? (
              <ErrorBlock message="Не удалось найти следующий урок" onRetry={() => void next.refetch()} />
            ) : nextLesson ? (
              <ChoiceRow
                icon={<CalendarArrowUp className="size-5" />}
                title={`${nextLesson.subjectName ?? 'Урок'} · ${lessonAudience(nextLesson)}`}
                description={lessonWhen(nextLesson)}
                selected={target?.id === nextLesson.id}
                onClick={() => choose(nextLesson)}
              />
            ) : (
              <p className="text-sm text-slate-500">
                В расписании больше нет ваших уроков по этому предмету у {lessonAudience(lesson) || 'этого класса'}
              </p>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <p className="text-11 font-bold uppercase text-slate-400">Другой урок или класс</p>
            <LessonDestinationPicker
              selectedId={target?.id ?? null}
              excludeLessonId={sourceId}
              excludeLabel="Этот урок"
              onSelect={choose}
            />
          </section>
        </div>
      )}

      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          {preview.isPending ? <LoadingBlock /> : preview.isError || !data ? (
            <ErrorBlock message="Не удалось проверить урок" onRetry={() => void preview.refetch()} />
          ) : <>
            <section className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-11 font-bold uppercase text-slate-400">Куда</p>
              <p className="text-base font-semibold text-slate-900">
                {data.target?.subjectName} · {lessonAudience(data.target ?? {})}
              </p>
              <p className="text-sm text-slate-600">{lessonWhen(data.target ?? {})}</p>
            </section>

            {blockedMessage(data.blockedReason) ? (
              <NoticeBar tone="warning" icon={<AlertTriangle className="size-4" />}>
                {blockedMessage(data.blockedReason)}
              </NoticeBar>
            ) : <>
              <section className="flex flex-col gap-2">
                <p className="text-11 font-bold uppercase text-slate-400">Будет скопировано</p>
                <ul className="flex flex-col gap-1.5">
                  {copyItems(data).map((item) => (
                    <li key={item.label} className={item.skipped ? 'text-sm text-slate-400' : 'text-sm text-slate-700'}>
                      <span className="font-semibold">{item.label}:</span> {item.value}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-400">
                  Класс, дата и время берутся из выбранного урока. ДЗ, тесты, посещаемость, оценки и
                  история изменений не переносятся. Этот урок останется как есть.
                </p>
              </section>
              {data.targetHasContent && (
                <NoticeBar tone="warning" icon={<AlertTriangle className="size-4" />}>
                  В выбранном уроке уже есть {existingSummary(data.existing)}. Тема, конспект, комментарий
                  и учебник будут заменены скопированными, материалы добавятся к уже приложенным.
                  Опубликованный конспект останется у учеников, пока вы не опубликуете новый.
                </NoticeBar>
              )}
            </>}
          </>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-fg" />
            {copyResultMessage(result)}
          </p>
          {result.textbookSkipped && (
            <p className="text-sm text-slate-500">
              Учебник не перенесён: он не назначен классу этого урока на его дату.
            </p>
          )}
          <p className="text-sm text-slate-500">
            Копия независима: правки в новом уроке не затронут этот.
            {result.summaryCopied && ' Конспект лёг черновиком — опубликуйте его в новом уроке, когда он будет готов.'}
          </p>
        </div>
      )}
    </Modal>
  );
}
