import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import {
  useAdminHomeroomCurrent,
  useAdminHomeroomHistory,
  useAdminHomeroomTeachers,
  usePutAdminHomeroom,
  useRemoveAdminHomeroom,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import { formatDateTime } from '@/lib/format';
import { platformErrorMessage } from '../platformErrorMessage';
import { ProfileCard, ProfileCardTitle } from './ProfileChrome';

const accessLabels: Record<NonNullable<Schema<'HomeroomCurrentView'>['accessState']>, string> = {
  ACTIVE: 'Учителю открыт доступ к разделу «Мой класс».',
  NO_ASSIGNMENT: 'У класса пока нет руководителя.',
  CLASS_ARCHIVED: 'Класс в архиве. Изменять назначение нельзя.',
  YEAR_NOT_ACTIVE: 'Учебный год не активен. Изменять назначение нельзя.',
  YEAR_NOT_STARTED: 'Назначение подготовлено. Доступ откроется с началом учебного года.',
  YEAR_ENDED: 'Учебный год завершён. Доступ учителя закрыт.',
  TEACHER_NOT_ACTIVE: 'У назначенного учителя сейчас нет доступа к разделу «Мой класс».',
};

const endLabels: Record<NonNullable<Schema<'HomeroomAssignmentView'>['endReason']>, string> = {
  REPLACED: 'Заменён',
  REMOVED: 'Снят',
  TEACHER_BLOCKED: 'Учитель заблокирован',
  TEACHER_ARCHIVED: 'Учитель архивирован',
  CLASS_ARCHIVED: 'Класс архивирован',
  YEAR_ARCHIVED: 'Учебный год архивирован',
  YEAR_ENDED: 'Учебный год завершён',
};

function isChanged(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'HOMEROOM_ASSIGNMENT_CHANGED';
}

function isUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'HOMEROOM_ASSIGNMENT_CONFLICT';
}

function actionError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'HOMEROOM_ASSIGNMENT_CONFLICT') {
    return 'Класс, учебный год или выбранный учитель больше недоступны. Данные обновлены — проверьте их и попробуйте снова.';
  }
  return platformErrorMessage(error, 'Не удалось изменить классного руководителя. Попробуйте снова.');
}

export function HomeroomAssignmentCard({ classId }: { classId: number }) {
  const toast = useToast();
  const current = useAdminHomeroomCurrent(classId);
  const history = useAdminHomeroomHistory(classId);
  const [formOpen, setFormOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const teachers = useAdminHomeroomTeachers(formOpen);
  const put = usePutAdminHomeroom(classId);
  const remove = useRemoveAdminHomeroom(classId);

  const slot = current.data;
  const assignment = slot?.assignment;
  const versionReady = slot != null && slot.expectedCurrentAssignmentId !== undefined;
  const canManage = versionReady && slot.classStatus === 'ACTIVE'
    && slot.academicYearStatus === 'ACTIVE'
    && slot.accessState !== 'YEAR_ENDED';
  const historyItems = history.data?.pages.flatMap((page) => page.items ?? []) ?? [];
  const selectedTeacher = teachers.data?.find((teacher) => teacher.id === Number(teacherId));
  const isSameTeacher = Boolean(assignment && selectedTeacher?.id === assignment.teacherProfileId);

  function openForm() {
    setTeacherId('');
    setError(null);
    setFormOpen(true);
  }

  async function handleChanged() {
    setFormOpen(false);
    setRemoveOpen(false);
    setTeacherId('');
    setError('Назначение уже изменилось. Данные обновлены — проверьте руководителя и повторите действие.');
    await Promise.all([current.refetch(), history.refetch()]);
  }

  async function save() {
    if (!slot || !versionReady || !selectedTeacher?.id || isSameTeacher || !canManage) return;
    setError(null);
    try {
      await put.mutateAsync({
        teacherProfileId: selectedTeacher.id,
        expectedCurrentAssignmentId: slot.expectedCurrentAssignmentId ?? null,
      });
      setFormOpen(false);
      setTeacherId('');
      toast.success(assignment ? 'Классный руководитель заменён' : 'Классный руководитель назначен');
    } catch (cause) {
      if (isChanged(cause)) await handleChanged();
      else if (isUnavailable(cause)) {
        setFormOpen(false);
        setTeacherId('');
        setError(actionError(cause));
        await Promise.all([current.refetch(), history.refetch(), teachers.refetch()]);
      } else setError(actionError(cause));
    }
  }

  async function confirmRemove() {
    if (!slot || !versionReady || !assignment || !canManage) return;
    setError(null);
    try {
      await remove.mutateAsync({ expectedCurrentAssignmentId: slot.expectedCurrentAssignmentId ?? null });
      setRemoveOpen(false);
      toast.success('Классный руководитель снят');
    } catch (cause) {
      if (isChanged(cause)) await handleChanged();
      else {
        setRemoveOpen(false);
        setError(actionError(cause));
        if (isUnavailable(cause)) await Promise.all([current.refetch(), history.refetch()]);
      }
    }
  }

  return (
    <ProfileCard className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProfileCardTitle>Классный руководитель</ProfileCardTitle>
        {canManage && !current.isError && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={openForm}>
              {assignment ? 'Заменить' : 'Назначить'}
            </Button>
            {assignment && (
              <Button size="sm" variant="ghost" onClick={() => { setError(null); setRemoveOpen(true); }}>
                Снять
              </Button>
            )}
          </div>
        )}
      </div>

      {current.isPending ? (
        <LoadingBlock label="Загрузка назначения…" />
      ) : current.isError ? (
        <ErrorBlock message="Не удалось загрузить назначение." onRetry={() => void current.refetch()} />
      ) : (
        <div className="space-y-2">
          {assignment ? (
            <>
              <p className="text-base font-semibold text-slate-900">{assignment.teacherName}</p>
              <p className="text-sm text-slate-500">Назначен {formatDateTime(assignment.startedAt)}</p>
            </>
          ) : (
            <p className="text-sm text-slate-600">Классный руководитель не назначен</p>
          )}
          {slot?.accessState && slot.accessState !== 'NO_ASSIGNMENT' && (
            <p className="text-sm text-muted">{accessLabels[slot.accessState]}</p>
          )}
        </div>
      )}
      {error && !formOpen && <p role="alert" className="text-sm text-no-lessons-fg">{error}</p>}

      <div className="border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">История назначений</h3>
        {history.isPending ? (
          <LoadingBlock label="Загрузка истории…" />
        ) : history.isError && historyItems.length === 0 ? (
          <ErrorBlock message="Не удалось загрузить историю." onRetry={() => void history.refetch()} />
        ) : historyItems.length === 0 ? (
          <EmptyBlock title="История назначений пока пуста" />
        ) : (
          <div className="mt-3 space-y-3">
            <ol className="divide-y divide-slate-100">
              {historyItems.map((item) => (
                <li key={item.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="font-medium text-slate-900">{item.teacherName}</span>
                  <span className="text-slate-500">
                    {formatDateTime(item.startedAt)} — {item.endedAt ? formatDateTime(item.endedAt) : 'сейчас'}
                    {item.endReason && ` · ${endLabels[item.endReason]}`}
                  </span>
                </li>
              ))}
            </ol>
            {history.isFetchNextPageError && (
              <p role="alert" className="text-sm text-no-lessons-fg">Не удалось загрузить историю.</p>
            )}
            {history.hasNextPage && (
              <Button size="sm" variant="secondary" loading={history.isFetchingNextPage}
                onClick={() => void history.fetchNextPage()}>
                {history.isFetchNextPageError ? 'Повторить' : 'Показать ещё'}
              </Button>
            )}
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => { if (!put.isPending) setFormOpen(false); }}
        title={assignment ? 'Заменить классного руководителя' : 'Назначить классного руководителя'}
        subtitle="Выберите учителя для этого класса."
        footer={(
          <div className="flex w-full justify-between gap-3">
            <Button variant="secondary" disabled={put.isPending} onClick={() => setFormOpen(false)}>Отмена</Button>
            <Button loading={put.isPending} disabled={!selectedTeacher?.id || isSameTeacher || !canManage}
              onClick={() => void save()}>Сохранить</Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <Field label="Классный руководитель" required>
            <Select value={teacherId} onChange={(event) => setTeacherId(event.target.value)}
              disabled={teachers.isPending || teachers.isError || teachers.data?.length === 0 || put.isPending}
              placeholder="Выберите учителя">
              <option value="">Выберите учителя</option>
              {(teachers.data ?? []).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {[teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ')}
                </option>
              ))}
            </Select>
          </Field>
          {teachers.isPending && <p role="status" className="text-xs text-muted">Загрузка учителей…</p>}
          {teachers.isSuccess && teachers.data.length === 0 && <p className="text-xs text-muted">Учителя не найдены</p>}
          {teachers.isError && (
            <div role="alert" className="flex items-center gap-2 text-xs text-no-lessons-fg">
              <span>Не удалось загрузить учителей.</span>
              <Button size="sm" variant="secondary" onClick={() => void teachers.refetch()}>Повторить</Button>
            </div>
          )}
          {isSameTeacher && <p className="text-xs text-muted">Этот учитель уже назначен.</p>}
          {error && <p role="alert" className="text-sm text-no-lessons-fg">{error}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={removeOpen}
        onClose={() => { if (!remove.isPending) setRemoveOpen(false); }}
        onConfirm={() => void confirmRemove()}
        title="Снять классного руководителя?"
        message={`После снятия ${assignment?.teacherName ?? 'учитель'} потеряет доступ к разделу «Мой класс» для этого класса.`}
        confirmLabel="Снять"
        danger
        loading={remove.isPending}
      />
    </ProfileCard>
  );
}
