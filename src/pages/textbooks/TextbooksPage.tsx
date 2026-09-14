import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import textbookIcon from '@/assets/textbook.svg';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { useToast } from '@/context/ToastContext';
import {
  useDeleteTextbookBinding,
  useTerminateTextbookBinding,
  useTextbookBindingOptions,
  useTextbookBindings,
} from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import {
  WHOLE_YEAR,
  bindingClassLabel,
  bindingPeriodLabel,
  classOptions,
  defaultPeriodId,
  defaultYear,
  findYear,
  subjectOptions,
  todayIso,
} from '@/lib/textbookModel';
import type { BindingFilters, TextbookBinding } from '@/lib/textbooksApi';
import { AddTextbookModal, type SavedBinding } from './AddTextbookModal';
import {
  TEXTBOOK_TABLE_COLUMNS,
  TextbookBindingsHeader,
  TextbookBindingsRows,
} from './TextbookBindingsTable';

/** Значение фильтра периода «все периоды года» в адресе. Без параметра — текущий период. */
const ALL_PERIODS = 'all';

type PendingAction = { binding: TextbookBinding; action: 'terminate' | 'remove' };

/**
 * Учебники учителя — назначения его учебников классам (Figma 2149:3122 и состояния).
 *
 * Экран показывает не библиотеку, а **где учебники действуют**: строка — это назначение
 * «учебник → класс → период», и ровно его завершают. Отсюда же добавляют учебник:
 * загрузка в библиотеку и назначение классам — одно действие для учителя, хотя на бэкенде
 * это два ресурса.
 *
 * Период показывается целиком (`includeEnded`), со статусом строки: иначе назначение на
 * следующую четверть пропадало бы из таблицы в момент сохранения, а завершённое сегодня
 * висело бы до завтра с той же кнопкой.
 *
 * Фильтры живут в адресе. Год без параметра — текущий, период — текущий в году: экран
 * открывается на том, что действует сейчас, а не на первом попавшемся годе.
 */
export function TextbooksPage() {
  useDocumentTitle('Учебники');
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const optionsQuery = useTextbookBindingOptions();
  const options = optionsQuery.data;

  const year = findYear(options, numberParam(params.get('year'))) ?? defaultYear(options);
  const periods = year?.periods ?? [];
  const periodParam = params.get('period');
  const periodId =
    periodParam === ALL_PERIODS
      ? undefined
      : (periods.find((period) => period.id === numberParam(periodParam))?.id ?? defaultPeriodId(year));
  const subjects = subjectOptions(year, []);
  const subjectId = pickOption(subjects, params.get('subject'));
  const classes = classOptions(year, subjectId ?? null);
  const classId = pickOption(classes, params.get('class'));

  const filters: BindingFilters | null =
    year?.id != null ? { academicYearId: year.id, academicPeriodId: periodId, subjectId, classId } : null;
  const bindingsQuery = useTextbookBindings(filters);
  const rows = bindingsQuery.data ?? [];

  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const terminate = useTerminateTextbookBinding();
  const remove = useDeleteTextbookBinding();

  function patch(next: Record<string, string | undefined>) {
    setParams(
      (current) => {
        const merged = new URLSearchParams(current);
        for (const [key, value] of Object.entries(next)) {
          if (value) merged.set(key, value);
          else merged.delete(key);
        }
        return merged;
      },
      { replace: true },
    );
  }

  /** После сохранения таблица встаёт на то, что только что назначили (Figma 2149:3761). */
  function showSaved(saved: SavedBinding) {
    patch({
      year: String(saved.yearId),
      period: saved.period === WHOLE_YEAR ? ALL_PERIODS : saved.period,
      subject: String(saved.subjectId),
      class: saved.classIds.length === 1 ? String(saved.classIds[0]) : undefined,
    });
  }

  async function confirmPending() {
    if (!pending?.binding.id) return;
    const { binding, action } = pending;
    try {
      if (action === 'terminate') {
        await terminate.mutateAsync(binding.id as number);
        toast.success('Использование завершено');
      } else {
        await remove.mutateAsync(binding.id as number);
        toast.success('Назначение отменено');
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось изменить назначение');
      void bindingsQuery.refetch();
    } finally {
      setPending(null);
    }
  }

  const loading = optionsQuery.isPending || (filters != null && bindingsQuery.isPending);
  const failed = optionsQuery.isError || bindingsQuery.isError;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Учебники</h1>
        <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)} disabled={!options}>
          Добавить учебник
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Учебный год"
          className="w-44"
          value={year?.id != null ? String(year.id) : ''}
          disabled={!options}
          onChange={(value) => patch({ year: value, period: undefined, subject: undefined, class: undefined })}
        >
          {(options?.years ?? []).map((item) => (
            <option key={item.id} value={String(item.id)}>
              {item.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Период"
          className="w-44"
          value={periodId != null ? String(periodId) : ALL_PERIODS}
          disabled={!options}
          onChange={(value) => patch({ period: value })}
        >
          <option value={ALL_PERIODS}>Все периоды</option>
          {periods.map((period) => (
            <option key={period.id} value={String(period.id)}>
              {period.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Предмет"
          className="w-60"
          value={subjectId != null ? String(subjectId) : ''}
          disabled={!options}
          onChange={(value) =>
            patch({
              subject: value || undefined,
              // Класс, где учитель не ведёт новый предмет, дал бы вечно пустую таблицу.
              class: pickOption(classOptions(year, value ? Number(value) : null), params.get('class'))
                ? (params.get('class') ?? undefined)
                : undefined,
            })
          }
        >
          <option value="">Все предметы</option>
          {subjects.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Класс"
          className="w-40"
          value={classId != null ? String(classId) : ''}
          disabled={!options}
          onChange={(value) => patch({ class: value || undefined })}
        >
          <option value="">Все классы</option>
          {classes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft" role="table" aria-label="Назначения учебников">
        {failed ? (
          <ErrorBlock
            message="Не удалось загрузить учебники"
            onRetry={() => {
              void optionsQuery.refetch();
              void bindingsQuery.refetch();
            }}
          />
        ) : loading ? (
          <div className="overflow-x-auto">
            <div className="min-w-textbook-table">
              <TextbookBindingsHeader />
              <TableSkeleton columns={TEXTBOOK_TABLE_COLUMNS} label="Загрузка учебников" />
            </div>
          </div>
        ) : rows.length === 0 ? (
          <EmptyBlock
            icon={<img src={textbookIcon} alt="" className="size-6" />}
            title="По выбранным фильтрам учебников пока нет"
            description="Добавьте учебник или измените фильтры"
            action={
              <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)} disabled={!options}>
                Добавить учебник
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-textbook-table">
              <TextbookBindingsHeader />
              <TextbookBindingsRows
                rows={rows}
                today={todayIso()}
                onTerminate={(binding) => setPending({ binding, action: 'terminate' })}
                onRemove={(binding) => setPending({ binding, action: 'remove' })}
              />
            </div>
          </div>
        )}
      </section>

      <AddTextbookModal
        open={adding}
        onClose={() => setAdding(false)}
        options={options}
        prefill={{ yearId: year?.id, periodId, subjectId, classId }}
        onSaved={showSaved}
      />

      <ConfirmDialog
        open={pending != null}
        onClose={() => setPending(null)}
        onConfirm={() => void confirmPending()}
        loading={terminate.isPending || remove.isPending}
        danger
        {...(pending?.action === 'remove'
          ? {
              title: 'Отменить назначение',
              confirmLabel: 'Отменить назначение',
              cancelLabel: 'Не отменять',
              message: <RemoveMessage binding={pending.binding} />,
            }
          : {
              title: 'Завершить использование',
              confirmLabel: 'Завершить',
              message: pending ? <TerminateMessage binding={pending.binding} /> : null,
            })}
      />
    </div>
  );
}

/** Текст подтверждения из макета 2149:3910. У чужого учебника «вашей библиотеки» нет. */
function TerminateMessage({ binding }: { binding: TextbookBinding }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-15 font-medium text-slate-900">
        Завершить использование учебника «{binding.textbookTitle}» для {bindingClassLabel(binding)}?
      </p>
      <p className="text-sm text-slate-500">
        {binding.ownTextbook
          ? 'Учебник останется в вашей библиотеке и будет доступен для новых привязок.'
          : `Учебник останется в библиотеке учителя ${binding.createdByName ?? ''}.`.replace(' .', '.')}
      </p>
    </div>
  );
}

function RemoveMessage({ binding }: { binding: TextbookBinding }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-15 font-medium text-slate-900">
        Отменить назначение учебника «{binding.textbookTitle}» для {bindingClassLabel(binding)}?
      </p>
      <p className="text-sm text-slate-500">
        {bindingPeriodLabel(binding)} ещё не начался, по учебнику не было ни одного урока — назначение
        удалится целиком.
      </p>
    </div>
  );
}

function numberParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Значение из адреса, только если оно есть среди вариантов: чужой id из старой ссылки молча отбрасывается. */
function pickOption(options: { value: string }[], value: string | null): number | undefined {
  return value && options.some((option) => option.value === value) ? Number(value) : undefined;
}
