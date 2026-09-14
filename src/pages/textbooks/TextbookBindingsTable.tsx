import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { FileTypeBadge } from '@/components/ui/FileTypeBadge';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import { openTextbookFile, textbookFileName } from '@/lib/textbookFile';
import {
  bindingClassLabel,
  bindingPeriodLabel,
  bindingRowState,
  shortDate,
} from '@/lib/textbookModel';
import { teacherTextbooksApi, type TextbookBinding } from '@/lib/textbooksApi';

/** Ширины колонок — общие для шапки, строк и скелета загрузки (Figma 2149:3157). */
export const TEXTBOOK_TABLE_COLUMNS = [
  'w-col-textbook-type',
  'min-w-48 flex-1',
  'w-col-textbook-class',
  'w-col-textbook-subject',
  'w-col-textbook-period',
  'w-col-textbook-actions',
];

const HEADERS = ['Тип', 'Название', 'Класс', 'Предмет', 'Период', 'Действия'];

export function TextbookBindingsHeader() {
  return (
    <div role="row" className="flex items-center border-b border-slate-200 bg-slate-50 px-4 py-3">
      {HEADERS.map((label, index) => (
        <div
          key={label}
          role="columnheader"
          className={cx(
            'shrink-0 pr-4 text-11 font-semibold uppercase tracking-filter text-slate-400',
            TEXTBOOK_TABLE_COLUMNS[index],
          )}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

/**
 * Строки назначений. Действие строки выбирается по её состоянию, а не рисуется одно на всех
 * (Figma показывает только «Завершить использование»): не начавшееся назначение завершить
 * нельзя — сервер ответит `TEXTBOOK_BINDING_NOT_STARTED`, его можно только отменить; у
 * завершённого действий нет, остаётся дата.
 */
export function TextbookBindingsRows({
  rows,
  today,
  onTerminate,
  onRemove,
}: {
  rows: TextbookBinding[];
  today: string;
  onTerminate: (binding: TextbookBinding) => void;
  onRemove: (binding: TextbookBinding) => void;
}) {
  return (
    <div role="rowgroup">
      {rows.map((binding) => (
        <BindingRow
          key={binding.id}
          binding={binding}
          today={today}
          onTerminate={() => onTerminate(binding)}
          onRemove={() => onRemove(binding)}
        />
      ))}
    </div>
  );
}

function BindingRow({
  binding,
  today,
  onTerminate,
  onRemove,
}: {
  binding: TextbookBinding;
  today: string;
  onTerminate: () => void;
  onRemove: () => void;
}) {
  const state = bindingRowState(binding, today);
  const muted = state.kind === 'ended';

  return (
    <div
      role="row"
      className="flex items-center border-b border-slate-100 px-4 py-2.5 last:border-b-0"
    >
      <div role="cell" className={cx('shrink-0 pr-4', TEXTBOOK_TABLE_COLUMNS[0])}>
        <FileTypeBadge format={binding.textbookFormat} />
      </div>
      <div role="cell" className={cx('shrink-0 pr-4', TEXTBOOK_TABLE_COLUMNS[1])}>
        <TextbookTitle binding={binding} muted={muted} />
      </div>
      <div role="cell" className={cx('shrink-0 pr-4', TEXTBOOK_TABLE_COLUMNS[2])}>
        <Badge tone={muted ? 'gray' : 'navy'}>{bindingClassLabel(binding)}</Badge>
      </div>
      <div
        role="cell"
        className={cx('shrink-0 truncate pr-4 text-13', muted ? 'text-slate-400' : 'text-slate-700', TEXTBOOK_TABLE_COLUMNS[3])}
      >
        {binding.subjectName}
      </div>
      <div
        role="cell"
        className={cx('shrink-0 truncate pr-4 text-13', muted ? 'text-slate-400' : 'text-slate-700', TEXTBOOK_TABLE_COLUMNS[4])}
      >
        {bindingPeriodLabel(binding)}
      </div>
      <div role="cell" className={cx('shrink-0 text-xs font-medium', TEXTBOOK_TABLE_COLUMNS[5])}>
        {state.kind === 'active' && (
          <button type="button" onClick={onTerminate} className="text-red-600 transition hover:text-red-700">
            Завершить использование
          </button>
        )}
        {state.kind === 'upcoming' && (
          <span className="flex items-center gap-1.5">
            <span className="text-slate-400">с {shortDate(state.from)} ·</span>
            <button type="button" onClick={onRemove} className="text-slate-600 transition hover:text-red-600">
              Отменить назначение
            </button>
          </span>
        )}
        {state.kind === 'ending' && <span className="text-slate-400">Действует по {shortDate(state.until)}</span>}
        {state.kind === 'ended' && <span className="text-slate-400">Завершено {shortDate(state.on)}</span>}
      </div>
    </div>
  );
}

/**
 * Название открывает файл, но только у своего учебника: назначение, оставшееся от прежнего
 * учителя класса, видно и завершается, а файл лежит в чужой библиотеке и отдан не будет.
 */
function TextbookTitle({ binding, muted }: { binding: TextbookBinding; muted: boolean }) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const textClass = cx('truncate text-13 font-medium', muted ? 'text-slate-400' : 'text-slate-900');

  if (!binding.ownTextbook || binding.textbookId == null) {
    return (
      <p className={textClass} title={binding.textbookTitle}>
        {binding.textbookTitle}
      </p>
    );
  }

  async function open() {
    setOpening(true);
    try {
      await openTextbookFile({
        load: () => teacherTextbooksApi.content(binding.textbookId as number),
        format: binding.textbookFormat,
        fileName: textbookFileName(binding.textbookTitle, binding.textbookFormat),
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось открыть учебник');
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={opening}
      title={binding.textbookTitle}
      className={cx(textClass, 'block max-w-full text-left transition hover:text-navy-700 hover:underline disabled:opacity-60')}
    >
      {binding.textbookTitle}
    </button>
  );
}
