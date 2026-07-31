import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock, Pencil, Trash2, X } from 'lucide-react';
import { TimeInput } from '@/components/ui/TimeInput';
import { cx } from '@/lib/format';
import {
  emptyPeriodDraft,
  validatePeriodDrafts,
  type PeriodDraft,
} from './periodDraft';

const COL_NUM = 'w-[110px] shrink-0';
const COL_TIME = 'flex-1 min-w-px';
const COL_ACTIONS = 'w-[100px] shrink-0';

/**
 * Таблица уроков шаблона звонков. Figma 2015:8699 (просмотр),
 * 2015:8824 (строка в режиме правки с ошибкой), 2015:8959 (добавление),
 * 2015:8664 (пустая).
 *
 * В отличие от прежнего редактора-формы, здесь редактируется одна строка:
 * карандаш переводит её в режим правки, галочка подтверждает, крестик отменяет.
 */
export function LessonPeriodsEditor({
  rows,
  onChange,
  onCommitRow,
  onRequestDelete,
  disabled,
}: {
  rows: PeriodDraft[];
  onChange: (next: PeriodDraft[]) => void;
  /**
   * Строка подтверждена галочкой. В макете кнопки «Сохранить» нет, поэтому
   * каждая строка уходит на сервер отдельно (addPeriod / updatePeriod).
   */
  onCommitRow?: (row: PeriodDraft) => void;
  /** Удаление строки, существующей на сервере, требует подтверждения. */
  onRequestDelete: (row: PeriodDraft) => void;
  disabled?: boolean;
}) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.lessonNumber - b.lessonNumber),
    [rows],
  );

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<{ startTime: string; endTime: string } | null>(null);
  /** Ключи строк, добавленных прямо сейчас — отмена должна их убрать. */
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());

  /** Валидация «как будет после подтверждения» — для строки в правке. */
  const preview = useMemo(() => {
    if (!editingKey || !buffer) return null;
    const next = rows.map((r) => (r.key === editingKey ? { ...r, ...buffer } : r));
    return { rows: next, validation: validatePeriodDrafts(next) };
  }, [rows, editingKey, buffer]);

  const editingError = editingKey ? preview?.validation.byKey[editingKey] : undefined;
  const canCommit =
    !editingError?.endBeforeStart &&
    !editingError?.duplicateNumber &&
    (editingError?.overlapWithKeys?.length ?? 0) === 0;

  function startEdit(row: PeriodDraft) {
    setEditingKey(row.key);
    setBuffer({ startTime: row.startTime, endTime: row.endTime });
  }

  function cancelEdit() {
    if (editingKey && freshKeys.has(editingKey)) {
      onChange(rows.filter((r) => r.key !== editingKey));
      setFreshKeys((prev) => {
        const next = new Set(prev);
        next.delete(editingKey);
        return next;
      });
    }
    setEditingKey(null);
    setBuffer(null);
  }

  function commitEdit() {
    if (!editingKey || !buffer || !canCommit) return;
    const current = rows.find((r) => r.key === editingKey);
    if (!current) return;
    const committed = { ...current, ...buffer };
    onChange(rows.map((r) => (r.key === editingKey ? committed : r)));
    onCommitRow?.(committed);
    setFreshKeys((prev) => {
      const next = new Set(prev);
      next.delete(editingKey);
      return next;
    });
    setEditingKey(null);
    setBuffer(null);
  }

  function addRow() {
    const last = sorted[sorted.length - 1];
    const draft = emptyPeriodDraft(last);
    onChange([...rows, draft]);
    setFreshKeys((prev) => new Set(prev).add(draft.key));
    setEditingKey(draft.key);
    setBuffer({ startTime: draft.startTime, endTime: draft.endTime });
  }

  /** «Время пересекается с уроком №3 (10:15–10:55)» — 2015:8888. */
  function conflictMessage(): string | null {
    if (!editingError) return null;
    if (editingError.endBeforeStart) return 'Время окончания должно быть позже начала';
    if (editingError.duplicateNumber) return 'Такой номер урока уже есть';
    const otherKey = editingError.overlapWithKeys?.[0];
    if (!otherKey) return null;
    const other = preview?.rows.find((r) => r.key === otherKey);
    if (!other) return 'Время пересекается с другим уроком';
    return `Время пересекается с уроком №${other.lessonNumber} (${other.startTime}–${other.endTime})`;
  }

  const message = conflictMessage();

  return (
    <div className="flex flex-col gap-4">
      {/* 2015:8700 — table-container */}
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        {/* 2015:8701 — table-header */}
        <div className="flex border-b border-line bg-gray-50 px-6 py-3 text-11 font-semibold uppercase text-gray-400">
          <span className={COL_NUM}>№ урока</span>
          <span className={COL_TIME}>Время начала</span>
          <span className={COL_TIME}>Время окончания</span>
          <span className={cx(COL_ACTIONS, 'text-right')}>Действия</span>
        </div>

        {sorted.length === 0 ? (
          // 2015:8671 — table-empty
          <div className="flex items-center justify-center p-16">
            <p className="text-sm text-gray-400">Добавьте первый урок</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {sorted.map((row) => {
              const isEditing = row.key === editingKey;

              if (isEditing && buffer) {
                return (
                  <div key={row.key} className="flex flex-col">
                    {/* 2015:8866 — row-edit-mode */}
                    <div className="flex h-12 items-center border-b border-line bg-sky-50 px-6 py-1.5">
                      <span className={cx(COL_NUM, 'text-sm font-bold text-gray-400')}>
                        {row.lessonNumber}
                      </span>
                      <div className={COL_TIME}>
                        <TimeCell
                          value={buffer.startTime}
                          disabled={disabled}
                          onChange={(startTime) => setBuffer({ ...buffer, startTime })}
                        />
                      </div>
                      <div className={COL_TIME}>
                        <TimeCell
                          value={buffer.endTime}
                          disabled={disabled}
                          onChange={(endTime) => setBuffer({ ...buffer, endTime })}
                          onEnter={commitEdit}
                        />
                      </div>
                      <div className={cx(COL_ACTIONS, 'flex items-center justify-end gap-4')}>
                        <button
                          type="button"
                          onClick={commitEdit}
                          disabled={disabled || !canCommit}
                          aria-label="Подтвердить"
                          className="text-emerald-600 transition hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={disabled}
                          aria-label="Отменить"
                          className="text-gray-400 transition hover:text-ink disabled:opacity-40"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 2015:8885 — conflict-error */}
                    {message && (
                      <div className="flex items-center gap-2 bg-red-50 px-6 py-2.5">
                        <AlertTriangle className="size-3.5 shrink-0 text-red-600" />
                        <p className="text-xs font-medium text-red-600">{message}</p>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={row.key}
                  className="flex h-12 items-center border-b border-line px-6 last:border-b-0"
                >
                  <span className={cx(COL_NUM, 'text-sm font-bold text-ink')}>
                    {row.lessonNumber}
                  </span>
                  <span className={cx(COL_TIME, 'text-sm text-ink')}>{row.startTime}</span>
                  <span className={cx(COL_TIME, 'text-sm text-ink')}>{row.endTime}</span>
                  <div className={cx(COL_ACTIONS, 'flex items-center justify-end gap-3')}>
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      disabled={disabled || editingKey != null}
                      aria-label={`Редактировать урок ${row.lessonNumber}`}
                      className="text-gray-400 transition hover:text-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestDelete(row)}
                      disabled={disabled || editingKey != null}
                      aria-label={`Удалить урок ${row.lessonNumber}`}
                      className="text-gray-400 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2015:8795 — «+ Добавить урок» */}
      <button
        type="button"
        onClick={addRow}
        disabled={disabled || editingKey != null}
        className="self-start text-sm font-semibold text-navy-700 transition hover:text-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Добавить урок
      </button>
    </div>
  );
}

/** 2015:8869 — textfield: 110px, radius 6, иконка часов 14px. */
function TimeCell({
  value,
  onChange,
  onEnter,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative w-[110px]">
      <TimeInput
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        className="h-auto w-full rounded-md border-line px-3 py-1.5 pr-8 text-sm font-normal text-ink"
      />
      <Clock className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
    </div>
  );
}
