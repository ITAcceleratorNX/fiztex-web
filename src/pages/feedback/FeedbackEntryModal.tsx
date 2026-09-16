import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import type { DraftState } from '@/lib/feedbackDraft';
import { cx, formatDayMonthYear } from '@/lib/format';
import {
  FEEDBACK_TEXT_LIMIT,
  type FeedbackSheet,
  type FeedbackSheetKey,
  type FeedbackStudentRow,
} from '@/lib/monthlyFeedbackApi';
import { nextStudentToFill, studentName, studentStatus } from '@/lib/monthlyFeedbackModel';
import { useFeedbackDraft } from './useFeedbackDraft';

/**
 * «Обратная связь за месяц» по одному ученику (Figma 2162:3168, 2162:3319, 2162:3470).
 *
 * <p>Текст сохраняется сам — через паузу в наборе, а «Готово» и «Следующий ученик» сохраняют
 * немедленно. Кнопки «Сохранить черновик» из макета нет: у бэкенда нет отдельного состояния
 * «готово», любой сохранённый текст уже заполнен, и кнопка повторяла бы автосохранение
 * (решение — `.cursor/tasks/monthly-feedback-fe/README.md`, №1–2). Вместо неё — переход к
 * следующему незаполненному: за месяц учитель пишет полторы сотни текстов подряд.
 *
 * <p>Окно не закрывается молча с несохранённым: если сохранение не прошло, оно остаётся
 * открытым и предлагает повторить или закрыть без сохранения.
 */
export function FeedbackEntryModal({
  sheetKey,
  sheet,
  student,
  onSelect,
  onClose,
}: {
  sheetKey: FeedbackSheetKey;
  sheet: FeedbackSheet;
  student: FeedbackStudentRow;
  onSelect: (studentProfileId: number) => void;
  onClose: () => void;
}) {
  const fieldId = useId();
  const { draft, state } = useFeedbackDraft(sheetKey, student);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const editable = sheet.editable === true && studentStatus(student) !== 'left' && state.status !== 'locked';
  const next = editable ? nextStudentToFill(sheet.students, student.studentProfileId as number) : null;

  // Первый фокус — автофокус при открытии: учитель дописывает, а не начинает заново, и курсор
  // встаёт в конец текста. Дальше фокус ставит сам учитель, и курсор остаётся там, куда он кликнул.
  const caretPlaced = useRef(false);
  useEffect(() => {
    setCloseBlocked(false);
    caretPlaced.current = false;
  }, [student.studentProfileId]);

  // Закрытие вкладки с несохранённым текстом: браузер спросит сам.
  useEffect(() => {
    if (state.status !== 'dirty' && state.status !== 'saving') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state.status]);

  async function saveThen(action: () => void) {
    if (!editable) {
      action();
      return;
    }
    setBusy(true);
    const ok = await draft.flush();
    setBusy(false);
    if (ok) action();
    else setCloseBlocked(true);
  }

  return (
    <Modal
      open
      size="md"
      onClose={() => void saveThen(onClose)}
      title={studentName(student)}
      subtitle={readOnlyReason(sheet, student)}
      footer={
        editable ? (
          <>
            {next && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void saveThen(() => onSelect(next.studentProfileId as number))}
              >
                Следующий ученик
              </Button>
            )}
            <Button loading={busy} onClick={() => void saveThen(onClose)}>
              Готово
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <label htmlFor={fieldId} className="text-13 font-semibold text-slate-600">
          Обратная связь за месяц
        </label>
        <TextArea
          // Новый ученик — новое поле: автофокус срабатывает и после «Следующий ученик».
          key={student.studentProfileId}
          id={fieldId}
          autoFocus={editable}
          onFocus={(event) => {
            if (caretPlaced.current) return;
            caretPlaced.current = true;
            const end = event.currentTarget.value.length;
            event.currentTarget.setSelectionRange(end, end);
          }}
          rows={8}
          maxLength={FEEDBACK_TEXT_LIMIT}
          readOnly={!editable}
          value={state.text}
          placeholder={editable ? 'Успеваемость, поведение на уроке, другие наблюдения' : undefined}
          onChange={(event) => {
            setCloseBlocked(false);
            draft.edit(event.target.value);
          }}
          onBlur={() => void draft.flush()}
          className={cx('min-h-48', !editable && 'bg-slate-50 text-slate-700')}
        />
        {editable && (
          <div className="flex items-center justify-between gap-3 text-13">
            <SaveStatus state={state} />
            <span className="text-subtle">
              {state.text.length} / {FEEDBACK_TEXT_LIMIT}
            </span>
          </div>
        )}

        {state.status === 'conflict' && (
          <NoticeBar tone="warning" icon={<AlertTriangle className="mt-0.5 size-4" aria-hidden />}>
            <p>Текст изменили на другом устройстве</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void draft.keepMine()}>
                Оставить мой
              </Button>
              <Button size="sm" variant="secondary" onClick={() => draft.takeTheirs()}>
                Взять с другого устройства
              </Button>
            </div>
          </NoticeBar>
        )}

        {/* При конфликте своя полоса уже просит выбрать — вторая про «не сохранено» была бы тем же
            вопросом другими словами. */}
        {closeBlocked && (state.status === 'error' || state.status === 'dirty') && (
          <NoticeBar tone="warning" icon={<AlertTriangle className="mt-0.5 size-4" aria-hidden />}>
            <p>Изменения не сохранены</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {state.status === 'error' && (
                <Button size="sm" onClick={() => void saveThen(onClose)}>
                  Повторить
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={onClose}>
                Закрыть без сохранения
              </Button>
            </div>
          </NoticeBar>
        )}
      </div>
    </Modal>
  );
}

function SaveStatus({ state }: { state: DraftState }) {
  switch (state.status) {
    case 'saving':
      return <span className="text-muted">Сохраняем…</span>;
    case 'saved':
      return <span className="text-success-fg">Сохранено</span>;
    case 'error':
      return <span className="text-red-600">{state.error}</span>;
    default:
      return <span />;
  }
}

/** Почему текст только для чтения — подзаголовком окна, чтобы поле без курсора не казалось сломанным. */
function readOnlyReason(sheet: FeedbackSheet, student: FeedbackStudentRow): string | undefined {
  if (sheet.publishedAt) return `Опубликовано ${formatDayMonthYear(sheet.publishedAt)}`;
  if (studentStatus(student) === 'left') return 'Выбыл';
  if (sheet.editable === false) return 'Только просмотр';
  return undefined;
}
