import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import {
  useAcademicPeriods,
  useCreateGroupSet,
  useSchoolSubjects,
} from '@/platform/hooks/useSubgroups';
import { ModalActions, ModalCard, MODAL_PRIMARY, MODAL_SECONDARY } from './ModalCard';

const FIELD_LABEL = 'text-xs font-semibold uppercase tracking-[0.5px] text-muted';
const FIELD_CONTROL =
  'w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-navy-700 disabled:bg-gray-50';

/**
 * Новый набор групп. Набора в макетах нет — это наша сущность поверх
 * подгрупп, — поэтому модалка собрана по общей спеке модалок расписания
 * (карточка 440, p 24, gap 20, кнопки справа).
 */
export function CreateGroupSetModal({
  open,
  onClose,
  yearId,
  classId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  yearId: number;
  classId: number;
  onCreated: (setId: number) => void;
}) {
  const toast = useToast();
  const create = useCreateGroupSet(classId);
  const subjectsQuery = useSchoolSubjects();
  const periodsQuery = useAcademicPeriods(yearId);

  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [periodId, setPeriodId] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setSubjectId('');
    setPeriodId('');
  }, [open]);

  const subjects = subjectsQuery.data?.content ?? [];
  const periods = (periodsQuery.data ?? []).filter((p) => p.status === 'ACTIVE');

  async function onSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Укажите название набора');
      return;
    }
    try {
      const created = await create.mutateAsync({
        name: trimmed,
        subjectId: subjectId ? Number(subjectId) : null,
        academicPeriodId: periodId ? Number(periodId) : null,
      });
      toast.success(`Набор «${created.name}» создан`);
      onCreated(created.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать набор');
    }
  }

  return (
    <ModalCard
      open={open}
      onClose={onClose}
      labelledBy="group-set-title"
      className="max-w-[440px] gap-5 p-6"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 id="group-set-title" className="text-xl font-bold text-ink">
            Новый набор групп
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-gray-400 transition hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-13 text-gray-400">
          Набор — это один вариант деления класса. Составы наборов независимы.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Название</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Английский"
            autoFocus
            disabled={create.isPending}
            className={cx(FIELD_CONTROL, 'placeholder:text-gray-400')}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Предмет</span>
          <select
            value={subjectId}
            disabled={create.isPending || subjectsQuery.isLoading}
            onChange={(e) => setSubjectId(e.target.value)}
            className={FIELD_CONTROL}
          >
            <option value="">Без предмета</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Период</span>
          <select
            value={periodId}
            disabled={create.isPending || periodsQuery.isLoading}
            onChange={(e) => setPeriodId(e.target.value)}
            className={FIELD_CONTROL}
          >
            <option value="">Весь год</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          disabled={create.isPending}
          className={cx(MODAL_SECONDARY, 'text-muted')}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={create.isPending || name.trim().length === 0}
          className={cx(MODAL_PRIMARY, 'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600')}
        >
          {create.isPending && <Loader2 className="size-4 animate-spin" />}
          Создать
        </button>
      </ModalActions>
    </ModalCard>
  );
}
