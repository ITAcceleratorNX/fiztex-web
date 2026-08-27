import { useState } from 'react';
import { Ban, RefreshCw, RotateCcw, Settings2, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/context/ToastContext';
import {
  useAssignSubstitute,
  useCancelLesson,
  useGradePermission,
  useRemoveSubstitute,
  useRestoreLesson,
  useSetGradePermission,
} from '@/hooks/queries';
import { useTeachersList } from '@/platform/hooks/useTeacherAvailability';
import { ApiError } from '@/lib/api';
import { cx, formatDateTime } from '@/lib/format';
import type { Lesson } from '@/lib/lessonsApi';

function teacherName(teacher: { lastName: string; firstName: string; middleName: string | null }) {
  return [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ');
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

/**
 * Разовые изменения урока: замена учителя и отмена (LESSON-002 §7).
 *
 * Место выбрано по смыслу: это действия над <b>этим</b> уроком на <b>эту</b> дату, а не
 * над слотом расписания. В конструкторе им делать нечего — там правится шаблон недели,
 * и правка задела бы все даты сразу.
 *
 * Блок появляется только у администратора, и решает это не роль на фронте, а
 * `MANAGE_STRUCTURE` в `capabilities`: тот же признак, которым бэкенд отделяет админа
 * от учителей урока. Учитель эти кнопки не видит вовсе — ему `/api/admin/*` ответит
 * 401, а общий `request()` трактует его как конец сессии.
 */
export function LessonManagementCard({ lesson }: { lesson: Lesson }) {
  const toast = useToast();
  const lessonId = lesson.id as number;

  const [assignOpen, setAssignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [comment, setComment] = useState('');

  const cancelLesson = useCancelLesson(lessonId);
  const restoreLesson = useRestoreLesson(lessonId);
  const removeSubstitute = useRemoveSubstitute(lessonId);

  const cancelled = lesson.status === 'CANCELLED';
  const substitute = lesson.substituteTeacher;
  // Восстановление снимает только ручную отмену: календарные и «слот убран из
  // расписания» движок восстанавливает сам, когда причина исчезает.
  const restorable = cancelled && lesson.cancellationReason === 'MANUAL';

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
      <p className="flex items-center gap-2 text-11 font-bold uppercase text-slate-400">
        <Settings2 className="size-4 text-slate-400" />
        Управление уроком
      </p>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-13 font-semibold text-slate-900">Замена учителя</p>
          <p className="text-13 text-slate-500">
            {substitute?.fullName
              ? `Урок ведёт ${substitute.fullName} вместо ${lesson.teacher?.fullName ?? '—'}`
              : `Урок ведёт ${lesson.teacher?.fullName ?? '—'} по расписанию`}
          </p>
        </div>
        {substitute ? (
          <Button variant="secondary" size="sm" onClick={() => setRemoveOpen(true)}>
            Снять замену
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={cancelled}
            title={cancelled ? 'Урок отменён' : undefined}
            onClick={() => setAssignOpen(true)}
          >
            <UserCog className="size-4" />
            Назначить замену
          </Button>
        )}
      </div>

      <hr className="border-slate-200" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-13 font-semibold text-slate-900">Проведение урока</p>
          <p className="text-13 text-slate-500">
            {cancelled
              ? restorable
                ? 'Урок отменён вручную — его можно вернуть в расписание'
                : 'Урок отменён системой: каникулы или изменение расписания'
              : 'Урок в расписании и проводится'}
          </p>
        </div>
        {cancelled ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={!restorable}
            title={restorable ? undefined : 'Системную отмену снимет сама система'}
            onClick={() => setRestoreOpen(true)}
          >
            <RotateCcw className="size-4" />
            Восстановить урок
          </Button>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
            <Ban className="size-4" />
            Отменить урок
          </Button>
        )}
      </div>

      <AssignSubstituteModal
        open={assignOpen}
        lesson={lesson}
        onClose={() => setAssignOpen(false)}
        onDone={() => {
          setAssignOpen(false);
          toast.success('Замена назначена');
        }}
      />

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Отменить урок?"
        subtitle="Посещаемость по нему будет погашена, а ученики и родители увидят отмену"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Не отменять
            </Button>
            <Button
              variant="danger"
              loading={cancelLesson.isPending}
              onClick={() =>
                cancelLesson.mutate(
                  { comment: comment.trim() || undefined },
                  {
                    onSuccess: () => {
                      setCancelOpen(false);
                      setComment('');
                      toast.success('Урок отменён');
                    },
                    onError: (error) =>
                      toast.error(describeError(error, 'Не удалось отменить урок')),
                  },
                )
              }
            >
              Отменить урок
            </Button>
          </>
        }
      >
        <Field
          label="Причина"
          hint="Её увидят ученики и родители на карточке урока. Необязательна, но без неё отмена выглядит молчаливой."
        >
          <TextArea
            value={comment}
            maxLength={500}
            placeholder="Например: учитель на больничном, замену найти не удалось"
            onChange={(event) => setComment(event.target.value)}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title="Снять замену?"
        message={
          <>
            Урок вернётся к основному учителю
            {lesson.teacher?.fullName ? ` — ${lesson.teacher.fullName}` : ''}. Оценки и
            записи, сделанные замещающим, останутся на месте и продолжат числиться за ним.
          </>
        }
        confirmLabel="Снять замену"
        loading={removeSubstitute.isPending}
        onConfirm={() =>
          removeSubstitute.mutate(undefined, {
            onSuccess: () => {
              setRemoveOpen(false);
              toast.success('Замена снята');
            },
            onError: (error) => toast.error(describeError(error, 'Не удалось снять замену')),
          })
        }
      />

      <ConfirmDialog
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        title="Восстановить урок?"
        message="Урок вернётся в расписание. Посещаемость, если её успели заполнить, вернётся черновиком — её нужно будет опубликовать заново."
        confirmLabel="Восстановить"
        loading={restoreLesson.isPending}
        onConfirm={() =>
          restoreLesson.mutate(undefined, {
            onSuccess: () => {
              setRestoreOpen(false);
              toast.success('Урок восстановлен');
            },
            onError: (error) => toast.error(describeError(error, 'Не удалось восстановить урок')),
          })
        }
      />
    </section>
  );
}

function AssignSubstituteModal({
  open,
  lesson,
  onClose,
  onDone,
}: {
  open: boolean;
  lesson: Lesson;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const teachersQuery = useTeachersList(query, 0);
  const assign = useAssignSubstitute(lesson.id as number);

  // Основного учителя из списка убираем: назначить его заменой самому себе нельзя,
  // и бэкенд ответит на это 409 — лучше не предлагать вовсе.
  const rows = (teachersQuery.data?.content ?? []).filter(
    (teacher) => teacher.id !== lesson.teacher?.id && teacher.status === 'ACTIVE',
  );

  const close = () => {
    setQuery('');
    setSelected(null);
    setReason('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Назначить замену"
      subtitle={`${lesson.subjectName ?? ''} · ${lesson.className ?? ''} · ${lesson.date ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Отмена
          </Button>
          <Button
            variant="primary"
            disabled={selected == null}
            loading={assign.isPending}
            onClick={() =>
              assign.mutate(
                { teacherProfileId: selected as number, reason: reason.trim() || undefined },
                {
                  onSuccess: () => {
                    setQuery('');
                    setSelected(null);
                    setReason('');
                    onDone();
                  },
                  onError: (error) =>
                    toast.error(describeError(error, 'Не удалось назначить замену')),
                },
              )
            }
          >
            Назначить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <NoticeBar icon={<RefreshCw className="size-4 text-brand-600" />}>
          Замена действует только на этот урок. Права на оценки она не даёт — их выдаёт
          основной учитель отдельно.
        </NoticeBar>

        <Field label="Кто заменит" required>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Фамилия учителя"
          />
        </Field>

        <div className="max-h-64 overflow-y-auto rounded-xl border border-line">
          {teachersQuery.isPending ? (
            <p className="p-4 text-13 text-slate-400">Загружаем учителей…</p>
          ) : teachersQuery.isError ? (
            <p className="p-4 text-13 text-slate-500">Не удалось загрузить список учителей</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-13 text-slate-400">
              {query ? 'Никого не нашли — уточните фамилию' : 'Свободных учителей нет'}
            </p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((teacher) => (
                <li key={teacher.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(teacher.id)}
                    className={cx(
                      'flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0',
                      selected === teacher.id ? 'bg-brand-50' : 'hover:bg-slate-50',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {teacherName(teacher)}
                      </span>
                      <span className="block text-xs text-slate-400">{teacher.phone}</span>
                    </span>
                    {selected === teacher.id && (
                      <span className="shrink-0 text-13 font-semibold text-brand-600">Выбран</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Field
          label="Причина замены"
          hint="Попадёт в журнал урока. Ученикам не показывается."
        >
          <TextArea
            value={reason}
            maxLength={500}
            placeholder="Например: больничный основного учителя"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Разрешение замещающему работать с оценками (GRADES-002 §12).
 *
 * Отдельный блок, а не строка в «Управлении уроком»: выдаёт его <b>основной учитель</b>
 * или админ, то есть аудитория у него шире админской, и жить внутри админского блока он
 * не может. Сам замещающий своё состояние видит, но не меняет.
 */
export function SubstituteGradeAccessCard({ lesson }: { lesson: Lesson }) {
  const toast = useToast();
  const lessonId = lesson.id as number;
  const viewerRole = lesson.viewerRole;
  const canGrant = viewerRole === 'ADMIN' || viewerRole === 'MAIN_TEACHER';

  const permissionQuery = useGradePermission(lessonId, Boolean(lesson.substituteTeacher));
  const setPermission = useSetGradePermission(lessonId);

  const permission = permissionQuery.data;
  const granted = permission?.canManageGrades === true;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
      <p className="flex items-center gap-2 text-11 font-bold uppercase text-slate-400">
        <UserCog className="size-4 text-slate-400" />
        Замещающий учитель
      </p>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-13 font-semibold text-slate-900">
            {lesson.substituteTeacher?.fullName} ведёт этот урок
          </p>
          <p className="max-w-prose text-13 text-slate-500">
            {granted
              ? 'Может выставлять оценки — только свои и только пока идёт урок. После звонка доступ закрывается сам.'
              : 'Оценки видит, но не ставит. Само назначение замены такого права не даёт.'}
          </p>
        </div>

        {permissionQuery.isPending ? (
          <span className="text-13 text-slate-400">Загружаем…</span>
        ) : canGrant ? (
          <span className="flex items-center gap-3">
            <span className="text-13 font-medium text-slate-600">Разрешить оценки</span>
            <Switch
              checked={granted}
              onChange={(next) =>
                setPermission.mutate(next, {
                  onSuccess: () =>
                    toast.success(next ? 'Разрешение выдано' : 'Разрешение отозвано'),
                  onError: (error) =>
                    toast.error(describeError(error, 'Не удалось изменить разрешение')),
                })
              }
            />
          </span>
        ) : (
          <span className="text-13 font-medium text-slate-500">
            {granted ? 'Оценки разрешены' : 'Оценки запрещены'}
          </span>
        )}
      </div>

      {granted && permission?.grantedAt && (
        <p className="text-xs text-slate-400">Разрешено {formatDateTime(permission.grantedAt)}</p>
      )}
    </section>
  );
}
