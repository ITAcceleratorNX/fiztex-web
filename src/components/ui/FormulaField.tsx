import { useRef, useState } from 'react';
import { Sigma, Trash2 } from 'lucide-react';
import { cx } from '@/lib/format';
import { Formula } from './MathText';
import { FormulaEditorModal } from './FormulaEditorModal';
import {
  insertFormulaAt,
  removeFormulaAt,
  replaceFormulaAt,
  splitMath,
  unescapeText,
} from '@/lib/mathMarkup';

/**
 * Поле текста вопроса, варианта ответа, эталонного ответа или критериев — с формулами.
 *
 * <p>Три вещи, которых требует ТЗ §4 («добавить, изменить или удалить формулу»; «перед
 * сохранением учитель видит формулу так же, как её увидит ученик»):
 * <ul>
 *   <li>кнопка «Формула» вставляет новую формулу на позицию курсора;</li>
 *   <li>щелчок по формуле в предпросмотре открывает её на правку — в тексте меняется именно
 *       она, а не первая похожая;</li>
 *   <li>предпросмотр рисует те же формулы тем же кодом, что и экран ученика.</li>
 * </ul>
 *
 * <p>Само поле остаётся обычным textarea: текст вопроса — это текст, и заставлять учителя
 * набирать условие в редакторе формул было бы хуже, чем есть.
 */
export function FormulaField({
  value,
  onChange,
  placeholder,
  rows = 3,
  multiline = true,
  invalid = false,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  multiline?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  /** `null` — в поле ещё не ставили курсор: формула тогда уходит в конец, а не в начало. */
  const cursorRef = useRef<number | null>(null);
  const [editing, setEditing] = useState<{ index: number; latex: string; display: boolean } | null>(
    null,
  );

  const segments = splitMath(value);
  const formulaCount = segments.filter((segment) => segment.kind === 'math').length;

  // Только пока поле в фокусе: щелчок по кнопке «Формула» снимает фокус, и на blur позиция
  // курсора уже потеряна — запоминать её надо до этого.
  function rememberCursor() {
    const input = inputRef.current;
    if (input && document.activeElement === input) {
      cursorRef.current = input.selectionStart ?? value.length;
    }
  }

  function handleSave(latex: string, display: boolean) {
    if (!editing) return;
    if (editing.index < 0) {
      const result = insertFormulaAt(value, cursorRef.current ?? value.length, latex, display);
      onChange(result.text);
      cursorRef.current = result.cursor;
    } else {
      onChange(replaceFormulaAt(value, editing.index, latex, display));
    }
    setEditing(null);
  }

  const inputProps = {
    value,
    placeholder,
    'aria-label': ariaLabel,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    onSelect: rememberCursor,
    onKeyUp: rememberCursor,
    onClick: rememberCursor,
    className: cx(
      'input-base',
      multiline && 'min-h-[92px] resize-y',
      invalid && 'border-red-300 focus:border-red-400 focus:ring-red-300/30',
    ),
  };

  return (
    <div>
      {multiline ? (
        <textarea
          {...inputProps}
          rows={rows}
          ref={(node) => {
            inputRef.current = node;
          }}
        />
      ) : (
        <input
          {...inputProps}
          ref={(node) => {
            inputRef.current = node;
          }}
        />
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            rememberCursor();
            setEditing({ index: -1, latex: '', display: false });
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-13 font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
        >
          <Sigma className="h-3.5 w-3.5" />
          Формула
        </button>
        {formulaCount > 0 && (
          <span className="text-11 text-slate-400">
            Щёлкните по формуле в предпросмотре, чтобы изменить её
          </span>
        )}
      </div>

      {formulaCount > 0 && (
        <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-11 font-semibold uppercase tracking-wide text-slate-400">
            Так увидит ученик
          </p>
          <div className="mt-1 text-[15px] leading-relaxed text-slate-800">
            <EditableFormulaPreview
              value={value}
              onEdit={(index, latex, display) => setEditing({ index, latex, display })}
              onRemove={(index) => onChange(removeFormulaAt(value, index))}
            />
          </div>
        </div>
      )}

      {editing && (
        <FormulaEditorModal
          open
          initialLatex={editing.latex}
          initialDisplay={editing.display}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

/** Предпросмотр, в котором каждая формула — кнопка: щелчок открывает её на правку. */
function EditableFormulaPreview({
  value,
  onEdit,
  onRemove,
}: {
  value: string;
  onEdit: (index: number, latex: string, display: boolean) => void;
  onRemove: (index: number) => void;
}) {
  let mathIndex = -1;
  return (
    <span className="whitespace-pre-wrap">
      {splitMath(value).map((segment, key) => {
        if (segment.kind === 'text') {
          return <span key={key}>{unescapeText(segment.value)}</span>;
        }
        mathIndex += 1;
        const index = mathIndex;
        return (
          <span key={key} className="group relative inline-flex items-center">
            <button
              type="button"
              title="Изменить формулу"
              onClick={() => onEdit(index, segment.value, segment.display)}
              className="rounded px-0.5 transition hover:bg-brand-100/70"
            >
              <Formula latex={segment.value} display={segment.display} />
            </button>
            <button
              type="button"
              title="Удалить формулу"
              onClick={() => onRemove(index)}
              className="ml-0.5 hidden rounded p-0.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 group-hover:inline-flex"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        );
      })}
    </span>
  );
}
