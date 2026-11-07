import { useState } from 'react';
import { Unlink } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { unlinkStudent } from '../services';
import { platformErrorMessage } from '../platformErrorMessage';

/**
 * Снять связь родителя с ребёнком — из карточки ученика и из карточки родителя.
 *
 * **Один компонент на обе стороны**, потому что связь одна: `parent_student_links`. Два
 * экрана смотрят на неё с разных концов, но снимают одно и то же, и расходиться в словах
 * («перестанет видеть» против «потеряет доступ») им не из-за чего.
 *
 * **Связь не удаляется, а закрывается** — сервер переводит её в `ARCHIVED`
 * (`ParentProfileService.unlinkStudent`). Поэтому действие названо «Отвязать», а не
 * «Удалить», и в подтверждении прямо сказано, что привязать обратно можно тут же:
 * у школы это обычная житейская правка, а не стирание истории.
 */
export function UnlinkRelationButton({
  /** Чья это карточка — от этого зависит только заголовок вопроса. */
  side,
  parentProfileId,
  studentProfileId,
  parentName,
  studentName,
  onUnlinked,
}: {
  side: 'student' | 'parent';
  parentProfileId: number;
  studentProfileId: number;
  parentName: string;
  studentName: string;
  onUnlinked: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await unlinkStudent(parentProfileId, studentProfileId);
      setOpen(false);
      toast.success(side === 'student' ? 'Родитель отвязан' : 'Ученик отвязан');
      onUnlinked();
    } catch (error) {
      toast.error(platformErrorMessage(error, 'Не удалось отвязать. Попробуйте ещё раз.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={side === 'student' ? 'Отвязать родителя' : 'Отвязать ученика'}
        aria-label={side === 'student' ? `Отвязать родителя ${parentName}` : `Отвязать ученика ${studentName}`}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
      >
        <Unlink className="size-4" aria-hidden="true" />
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={busy}
        onConfirm={() => void confirm()}
        title={side === 'student' ? 'Отвязать родителя?' : 'Отвязать ученика?'}
        message={`${parentName} перестанет видеть в приложении данные ученика ${studentName} — расписание, оценки, посещаемость и отзывы — и не сможет выдать ему персональный код. Связь не удаляется, а закрывается: привязать обратно можно здесь же.`}
        confirmLabel="Отвязать"
        danger
      />
    </>
  );
}
