import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Select } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import {
  useCloseFeedbackMonth,
  useFeedbackHistoryFilters,
  useFeedbackMonth,
  useFeedbackMonths,
  useFeedbackSheet,
  usePublishFeedbackSheet,
} from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { formatDayMonthYear } from '@/lib/format';
import { FEEDBACK_ERRORS, type FeedbackSheet, type FeedbackSheetKey } from '@/lib/monthlyFeedbackApi';
import {
  classOptions,
  monthKey,
  monthLabel,
  monthOptions,
  subjectOptions,
  type Option,
} from '@/lib/monthlyFeedbackModel';
import { FeedbackEntryModal } from './FeedbackEntryModal';
import { FeedbackPeriodControls } from './FeedbackPeriodControls';
import { FeedbackStudentGrid, studentRowId } from './FeedbackStudentGrid';

type PendingConfirm = 'publish' | 'close' | null;

/**
 * Ежемесячная обратная связь учителя (Figma 2162:2036 и состояния; ТЗ `feedback-task.txt` §2).
 *
 * <p>Фильтры «месяц → предмет → класс» живут в адресе и строятся из листов месяца (T2): какие
 * классы и предметы учителю положены, решает бэкенд по расписанию и назначениям, и экран их не
 * выводит. Прошлые месяцы — тот же экран с другим месяцем, отдельной истории нет (ТЗ §2).
 *
 * <p>Что разрешено, приходит флагами: `editable` и `canPublish` у листа, `canClose` у месяца.
 * Правила контракта и отступления от макета — `.cursor/tasks/monthly-feedback-fe/README.md`.
 */
export function FeedbackPage() {
  useDocumentTitle('Обратная связь');
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const current = monthKey();
  const month = validMonth(params.get('month'), current) ?? current;
  const monthsQuery = useFeedbackMonths();
  const historyQuery = useFeedbackHistoryFilters();
  const months = monthOptions(monthsQuery.data, [...(historyQuery.data?.months ?? []), month], current);

  const monthQuery = useFeedbackMonth(month);
  const monthView = monthQuery.data;
  const sheets = monthView?.sheets ?? [];
  const subjects = subjectOptions(sheets);
  const subjectId = pickOption(subjects, params.get('subject'));
  const classes = classOptions(sheets, subjectId ?? null);
  const classId = pickOption(classes, params.get('class'));

  const sheetKey: FeedbackSheetKey | null =
    subjectId != null && classId != null ? { month, classId, subjectId } : null;
  const sheetQuery = useFeedbackSheet(sheetKey);
  const sheet = sheetQuery.data;

  const [openStudentId, setOpenStudentId] = useState<number | null>(null);
  const openStudent = sheet?.students?.find((row) => row.studentProfileId === openStudentId) ?? null;
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const publish = usePublishFeedbackSheet();
  const closeMonth = useCloseFeedbackMonth();

  function patch(next: Record<string, string | undefined>) {
    setParams(
      (currentParams) => {
        const merged = new URLSearchParams(currentParams);
        for (const [key, value] of Object.entries(next)) {
          if (value) merged.set(key, value);
          else merged.delete(key);
        }
        return merged;
      },
      { replace: true },
    );
  }

  async function confirmPublish() {
    if (!sheetKey) return;
    try {
      await publish.mutateAsync(sheetKey);
    } catch (error) {
      toast.error(errorMessage(error, 'Не удалось опубликовать'));
      await sheetQuery.refetch();
      if (error instanceof ApiError && error.code === FEEDBACK_ERRORS.sheetIncomplete) {
        scrollToFirstMissing(error);
      }
    } finally {
      setConfirm(null);
    }
  }

  async function confirmClose() {
    try {
      await closeMonth.mutateAsync(month);
    } catch (error) {
      toast.error(errorMessage(error, 'Не удалось закрыть период'));
      void monthQuery.refetch();
    } finally {
      setConfirm(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Обратная связь</h1>
        {/* Период — свойство месяца, а не класса: в макете бейдж стоит в строке фильтров, но с
            кнопкой закрытия и подсказкой она перестаёт помещаться в одну линию. */}
        {monthView && sheets.length > 0 && (
          <FeedbackPeriodControls month={monthView} onClose={() => setConfirm('close')} />
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-60">
          <Field label="Месяц">
            <Select aria-label="Месяц" value={month} onChange={(event) => patch({ month: event.target.value })}>
              {months.map((value) => (
                <option key={value} value={value}>
                  {monthLabel(value)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="w-72">
          <Field label="Предмет">
            <Select
              aria-label="Предмет"
              value={subjectId != null ? String(subjectId) : ''}
              placeholder="Выберите предмет"
              disabled={subjects.length === 0}
              onChange={(event) =>
                patch({
                  subject: event.target.value,
                  // Класс, где учитель не ведёт новый предмет, оставил бы экран без листа.
                  class: pickOption(classOptions(sheets, Number(event.target.value)), params.get('class'))
                    ? (params.get('class') ?? undefined)
                    : undefined,
                })
              }
            >
              {subjects.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="w-60">
          <Field label="Класс">
            <Select
              aria-label="Класс"
              value={classId != null ? String(classId) : ''}
              placeholder="Выберите класс"
              disabled={classes.length === 0}
              onChange={(event) => patch({ class: event.target.value })}
            >
              {classes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <section className="min-h-96 rounded-2xl border border-slate-200 bg-white shadow-soft">
        {monthQuery.isError || sheetQuery.isError ? (
          <ErrorBlock
            message="Не удалось загрузить обратную связь"
            onRetry={() => {
              void monthQuery.refetch();
              if (sheetKey) void sheetQuery.refetch();
            }}
          />
        ) : monthQuery.isPending ? (
          <LoadingBlock />
        ) : sheets.length === 0 ? (
          <EmptyBlock icon={<Users className="size-6" />} title="В этом месяце у вас нет классов для обратной связи" />
        ) : !sheetKey ? (
          <EmptyBlock
            icon={<Users className="size-6" />}
            title="Выберите месяц, предмет и класс, чтобы увидеть список учеников"
          />
        ) : sheetQuery.isPending || !sheet ? (
          <LoadingBlock />
        ) : (
          <div className="flex flex-col gap-4 p-5">
            <SheetHeader sheet={sheet} onPublish={() => setConfirm('publish')} />
            <FeedbackStudentGrid
              students={sheet.students ?? []}
              onOpen={(student) => setOpenStudentId(student.studentProfileId ?? null)}
            />
          </div>
        )}
      </section>

      {sheetKey && sheet && openStudent && (
        <FeedbackEntryModal
          sheetKey={sheetKey}
          sheet={sheet}
          student={openStudent}
          onSelect={setOpenStudentId}
          onClose={() => setOpenStudentId(null)}
        />
      )}

      <ConfirmDialog
        open={confirm === 'publish'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void confirmPublish()}
        loading={publish.isPending}
        title={`Опубликовать обратную связь для ${sheet?.className ?? ''} класса по предмету ${
          sheet?.subjectName ?? ''
        } за ${monthLabel(month).toLowerCase()}?`}
        message="После публикации редактирование будет недоступно."
        confirmLabel="Опубликовать"
      />

      <ConfirmDialog
        open={confirm === 'close'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void confirmClose()}
        loading={closeMonth.isPending}
        title={`Закрыть период за ${monthLabel(month).toLowerCase()}?`}
        message="После закрытия вы не сможете создавать или редактировать черновики за этот месяц ни по одному классу или предмету."
        confirmLabel="Закрыть период"
      />
    </div>
  );
}

/** Прогресс и публикация листа (Figma `list-header` 2162:2093, `Опубликовано …` 2162:2753). */
function SheetHeader({ sheet, onPublish }: { sheet: FeedbackSheet; onPublish: () => void }) {
  const filled = sheet.progress?.filled ?? 0;
  const total = sheet.progress?.total ?? 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <p className="text-sm font-bold text-slate-900">
          {filled}/{total} заполнено
        </p>
        <ProgressBar value={filled} max={total} label="Заполнено отзывов" className="w-56" />
      </div>
      {sheet.publishedAt ? (
        <Badge>Опубликовано {formatDayMonthYear(sheet.publishedAt)}</Badge>
      ) : sheet.editable ? (
        <Button size="sm" disabled={!sheet.canPublish} onClick={onPublish}>
          Опубликовать
        </Button>
      ) : null}
    </div>
  );
}

/** `yyyy-MM` из адреса, не позже текущего: будущий месяц сервер отклонит 409. */
function validMonth(value: string | null, current: string): string | undefined {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value <= current ? value : undefined;
}

/** Значение из адреса, только если оно есть среди вариантов: чужой id из старой ссылки отбрасывается. */
function pickOption(options: Option[], value: string | null): number | undefined {
  return value && options.some((option) => option.value === value) ? Number(value) : undefined;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

/** Отказ публикации неполного листа называет незаполненных — к первому из них прокручиваем. */
function scrollToFirstMissing(error: ApiError) {
  const ids = (error.details as { missingStudentProfileIds?: number[] } | undefined)?.missingStudentProfileIds;
  const first = ids?.[0];
  if (first == null) return;
  document.getElementById(studentRowId(first))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
