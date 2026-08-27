import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { useToast } from '@/context/ToastContext';
import { ApiError, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import { cx, pluralRu } from '@/lib/format';

type Horizon = Schema<'LessonHorizonView'>;
type GenerationRun = Schema<'LessonGenerationRunView'>;

const horizonApi = {
  get: (academicYearId: number, signal?: AbortSignal) =>
    request<Horizon>(`/admin/lesson-generation/horizon?academicYearId=${academicYearId}`, { signal }),

  put: (body: { academicYearId: number; horizonWeeks: number; version?: number }) =>
    request<Horizon>('/admin/lesson-generation/horizon', { method: 'PUT', body }),

  /**
   * Ручной прогон. Без него увеличенный горизонт ничего не меняет до ночной джобы:
   * настройка лишь говорит, докуда достраивать, а достраивает генерация.
   */
  run: (academicYearId: number) =>
    request<GenerationRun>('/admin/lesson-generation/runs', {
      method: 'POST',
      body: { academicYearId },
    }),
};

const horizonKey = (yearId: number) => ['lesson-generation', 'horizon', yearId] as const;

/**
 * Горизонт генерации уроков — насколько недель вперёд из недельного шаблона расписания
 * материализуются конкретные уроки.
 *
 * Настройка живёт здесь, а не в отдельном разделе: она относится к расписанию целиком,
 * как звонки и календарь, и её место — в том же ряду карточек.
 */
export function LessonHorizonCard({
  academicYearId,
  className,
}: {
  academicYearId: number | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: horizonKey(academicYearId ?? 0),
    queryFn: ({ signal }) => horizonApi.get(academicYearId as number, signal),
    enabled: academicYearId != null,
  });

  const weeks = query.data?.horizonWeeks;
  const badge = weeks
    ? `${weeks} ${pluralRu(weeks, ['неделя', 'недели', 'недель'])}`
    : query.isPending
      ? '…'
      : '—';

  return (
    <>
      <button
        type="button"
        disabled={academicYearId == null}
        onClick={() => setOpen(true)}
        className={cx(
          'flex items-center justify-between gap-2.5 rounded-lg border border-line bg-white p-3 text-left transition hover:border-navy-700 disabled:opacity-60',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <CalendarClock className="size-4 shrink-0 text-navy-700" />
          <span className="truncate text-13 font-semibold text-ink">Горизонт уроков</span>
        </span>
        <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-11 font-semibold text-gray-500">
          {badge}
        </span>
      </button>

      {open && academicYearId != null && query.data && (
        <HorizonModal
          academicYearId={academicYearId}
          horizon={query.data}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function HorizonModal({
  academicYearId,
  horizon,
  onClose,
}: {
  academicYearId: number;
  horizon: Horizon;
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const min = horizon.minHorizonWeeks ?? 2;
  const max = horizon.maxHorizonWeeks ?? 52;
  const current = horizon.horizonWeeks ?? min;
  const [value, setValue] = useState(String(current));

  const parsed = Number(value);
  const invalid = !Number.isInteger(parsed) || parsed < min || parsed > max;
  const growing = !invalid && parsed > current;

  const save = useMutation({
    mutationFn: async (weeks: number) => {
      const saved = await horizonApi.put({
        academicYearId,
        horizonWeeks: weeks,
        // `version` обязателен, если строка уже есть, иначе сервер ответит OPTIMISTIC_LOCK.
        version: horizon.version ?? undefined,
      });
      // Увеличение достраивает хвост только следующей генерацией — запускаем сразу,
      // иначе администратор сохранил число и не увидел ни одного нового урока.
      const run = weeks > current ? await horizonApi.run(academicYearId) : null;
      return { saved, run };
    },
    onSuccess: ({ saved, run }) => {
      qc.setQueryData(horizonKey(academicYearId), saved);
      // Уроки могли появиться где угодно — сбрасываем всё, что их показывает.
      qc.invalidateQueries({ queryKey: ['lessons'] });
      toast.success(
        run
          ? `Горизонт ${saved.horizonWeeks} нед. · создано уроков: ${run.createdCount ?? 0}`
          : `Горизонт ${saved.horizonWeeks} нед.`,
      );
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось изменить горизонт'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Горизонт генерации уроков"
      subtitle="На сколько недель вперёд из расписания создаются конкретные уроки"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button
            disabled={invalid || parsed === current}
            loading={save.isPending}
            onClick={() => save.mutate(parsed)}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-13 leading-relaxed text-slate-600">
          Опубликованное расписание — это шаблон недели. Урок, который можно открыть,
          отметить посещаемость и оценить, создаётся отдельно на каждую дату. Горизонт
          говорит, докуда вперёд их создавать; ночью окно сдвигается само.
        </p>

        <Field
          label="Недель вперёд"
          required
          error={invalid ? `Допустимо от ${min} до ${max}` : undefined}
          hint={invalid ? undefined : `Сейчас ${current}. Источник: ${horizon.source === 'DB' ? 'настройка школы' : 'значение по умолчанию'}`}
        >
          <TextInput
            type="number"
            min={min}
            max={max}
            value={value}
            error={invalid}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>

        {growing && (
          <NoticeBar>
            Недостающие уроки будут созданы сразу после сохранения.
          </NoticeBar>
        )}

        {!invalid && parsed < current && (
          <NoticeBar tone="solid">
            Уменьшение горизонта <b>не удаляет</b> уже созданные уроки — вместе с ними
            останутся посещаемость, задания и оценки. Сузится только окно, в котором
            создаются новые.
          </NoticeBar>
        )}
      </div>
    </Modal>
  );
}
