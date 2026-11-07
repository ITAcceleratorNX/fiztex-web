import { useEffect, useMemo, useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import type { StudentCodeGrant } from '@/lib/studentCodeGrantsApi';
import {
  useAdminActiveClasses,
  useAdminClassStudents,
  useAdminHomeroomCurrent,
  useAdminHomeroomTeachers,
  useGrantStudentCodeAccess,
  useRevokeStudentCodeAccess,
  useStudentCodeGrants,
} from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, TextInput } from '@/components/ui/Field';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatDate } from '@/lib/format';
import { formatPersonName } from '@/platform/types';
import {
  EXPIRY_OPTIONS,
  activeGrants,
  expiresAtIso,
  expiryProblem,
  grantOutcomeMessage,
  type ExpiryChoice,
  type GrantOutcome,
} from './codeGrantsModel';

const COLUMNS = ['w-10', 'flex-1', 'flex-1', 'w-40'];

/**
 * Кому из учителей открыта выдача персональных кодов (AUTH-BE-001 §7.1).
 *
 * **Зачем экран вообще нужен.** У роли «учитель» права выдавать коды нет и не будет:
 * полномочие дало бы «любому учителю — любого ученика школы». Основание у учителя одно —
 * строка `student_code_grants` на пару «учитель + ученик», и выдаёт её администратор.
 * До этого экрана выдать её было нечем, и классный руководитель видел в своей панели
 * «Администратор не открыл вам выдачу кода этому ученику» без способа это изменить.
 *
 * **Экран построен вокруг класса, а не ученика.** Разрешение на сервере — на одного
 * ученика, но администратор просит не «на Абенова», а «классному руководителю 7Б на его
 * класс»: один за одним это тридцать заходов в тридцать карточек. Поэтому выбор класса,
 * отметки на строках и одна выдача на всех выбранных.
 *
 * **Сброс PIN сюда не относится.** §7.2 оставляет его администратору, и разрешение его
 * не открывает: PIN придумывает сам ученик, и учитель, сбрасывающий его чужими руками,
 * — это вход в аккаунт ученика мимо него.
 */
export function CodeGrantsPanel() {
  const [params, setParams] = useSearchParams();
  const classes = useAdminActiveClasses(true);
  const classParam = Number(params.get('class') ?? 0) || null;
  const classList = classes.data ?? [];
  const classId = classParam ?? classList[0]?.id ?? null;

  const students = useAdminClassStudents(classId);
  const homeroom = useAdminHomeroomCurrent(classId ?? 0);
  const studentIds = useMemo(
    () => (students.data ?? []).map((student) => student.id as number),
    [students.data],
  );
  const grants = useStudentCodeGrants(studentIds);
  const grantsById = useMemo(() => {
    const map = new Map<number, StudentCodeGrant[]>();
    studentIds.forEach((id, index) => map.set(id, grants[index]?.data ?? []));
    return map;
  }, [studentIds, grants]);
  const grantsLoading = grants.some((query) => query.isPending);

  const [selected, setSelected] = useState<number[]>([]);
  const [grantOpen, setGrantOpen] = useState(false);
  const [revoking, setRevoking] = useState<
    { studentProfileId: number; grantId: number; studentName: string; teacherName: string } | null
  >(null);

  // Отметки принадлежат классу: оставшись при переключении, они выдали бы разрешение
  // ученикам, которых на экране уже нет.
  useEffect(() => { setSelected([]); }, [classId]);

  const revoke = useRevokeStudentCodeAccess();
  const toast = useToast();

  const homeroomName = homeroom.data?.assignment?.teacherName ?? null;
  const studentRows = students.data ?? [];

  function toggle(studentProfileId: number) {
    setSelected((current) => current.includes(studentProfileId)
      ? current.filter((id) => id !== studentProfileId)
      : [...current, studentProfileId]);
  }

  async function confirmRevoke() {
    if (!revoking) return;
    try {
      await revoke.mutateAsync({
        studentProfileId: revoking.studentProfileId,
        grantId: revoking.grantId,
      });
      toast.success('Разрешение отозвано');
      setRevoking(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось отозвать разрешение.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <FilterSelect
          className="lg:w-60"
          label="Класс"
          value={classId ? String(classId) : ''}
          disabled={classes.isPending || classList.length === 0}
          onChange={(value) => {
            const next = new URLSearchParams(params);
            next.set('class', value);
            setParams(next, { replace: true });
          }}
        >
          {classList.map((item) => (
            <option key={item.id} value={String(item.id)}>{item.name}</option>
          ))}
        </FilterSelect>

        <div className="flex-1 text-13 text-slate-500">
          {homeroomName
            ? <>Классный руководитель — <span className="font-medium text-slate-700">{homeroomName}</span></>
            : homeroom.isPending ? '' : 'У класса нет классного руководителя'}
        </div>

        <Button
          icon={<KeyRound className="size-4" />}
          disabled={selected.length === 0}
          onClick={() => setGrantOpen(true)}
        >
          Выдать разрешение{selected.length > 0 ? ` (${selected.length})` : ''}
        </Button>
      </div>

      {classes.isError && (
        <ErrorBlock
          message="Не удалось загрузить классы."
          onRetry={() => void classes.refetch()}
        />
      )}

      {(students.isPending || classes.isPending) && classId != null && (
        <TableSkeleton columns={COLUMNS} rows={8} />
      )}

      {students.isError && (
        <ErrorBlock
          message="Не удалось загрузить состав класса."
          onRetry={() => void students.refetch()}
        />
      )}

      {!classes.isPending && classList.length === 0 && (
        <div className="card">
          <EmptyBlock
            title="Нет классов действующего учебного года"
            description="Разрешения выдаются ученикам класса — сначала создайте класс и наберите состав."
          />
        </div>
      )}

      {!students.isPending && !students.isError && classId != null && studentRows.length === 0 && (
        <div className="card">
          <EmptyBlock
            title="В классе нет действующих учеников"
            description="Выдавать код некому: архивным ученикам доступ не выпускается."
          />
        </div>
      )}

      {studentRows.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-10 uppercase tracking-filter text-slate-400">
              <tr>
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Выбрать всех учеников класса"
                    className="size-4 rounded border-slate-300 text-navy-700 focus:ring-navy-700"
                    checked={selected.length === studentRows.length && studentRows.length > 0}
                    onChange={(event) => setSelected(
                      event.target.checked ? studentIds : [],
                    )}
                  />
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">Ученик</th>
                <th scope="col" className="px-4 py-3 font-semibold">Кому открыта выдача кода</th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map((student) => {
                const id = student.id as number;
                const studentName = formatPersonName(
                  student.lastName ?? '', student.firstName ?? '', student.middleName,
                );
                const rows = activeGrants(grantsById.get(id));
                return (
                  <tr key={id} className="border-b border-slate-50 align-top last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Выбрать ${studentName}`}
                        className="size-4 rounded border-slate-300 text-navy-700 focus:ring-navy-700"
                        checked={selected.includes(id)}
                        onChange={() => toggle(id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{studentName}</td>
                    <td className="px-4 py-3">
                      {grantsLoading && rows.length === 0 ? (
                        <span className="text-slate-400">…</span>
                      ) : rows.length === 0 ? (
                        <span className="text-slate-400">Никому</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {rows.map((grant) => (
                            <span
                              key={grant.grantId}
                              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-navy-700"
                            >
                              {grant.teacherName}
                              {grant.expiresAt && (
                                <span className="font-normal text-navy-700/70">
                                  до {formatDate(grant.expiresAt)}
                                </span>
                              )}
                              <button
                                type="button"
                                aria-label={`Отозвать разрешение у ${grant.teacherName}`}
                                className="rounded-full p-0.5 text-navy-700/60 hover:bg-white hover:text-navy-900"
                                onClick={() => setRevoking({
                                  studentProfileId: id,
                                  grantId: grant.grantId as number,
                                  studentName,
                                  teacherName: grant.teacherName ?? 'учителя',
                                })}
                              >
                                <X className="size-3.5" aria-hidden="true" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <GrantModal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        studentProfileIds={selected}
        defaultTeacherProfileId={homeroom.data?.assignment?.teacherProfileId ?? null}
        yearEndDate={homeroom.data?.yearEndDate ?? null}
        onDone={(outcome) => {
          setGrantOpen(false);
          setSelected([]);
          toast.success(grantOutcomeMessage(outcome));
        }}
      />

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        loading={revoke.isPending}
        onConfirm={() => void confirmRevoke()}
        title="Отозвать разрешение?"
        message={revoking
          ? `${revoking.teacherName} больше не сможет выпустить код ученику ${revoking.studentName}. Уже выданный код продолжит работать — отзыв разрешения кода не меняет.`
          : ''}
        confirmLabel="Отозвать"
        danger
      />
    </div>
  );
}

/**
 * Одна выдача на всех выбранных учеников. Запроса «выдать пакетом» на сервере нет, и
 * заводить его ради экрана незачем: разрешения независимы, и частичный успех здесь —
 * нормальный исход, а не сломанная транзакция.
 */
function GrantModal({
  open,
  onClose,
  studentProfileIds,
  defaultTeacherProfileId,
  yearEndDate,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  studentProfileIds: number[];
  defaultTeacherProfileId: number | null;
  yearEndDate: string | null;
  onDone: (outcome: GrantOutcome) => void;
}) {
  const teachers = useAdminHomeroomTeachers(open);
  const grant = useGrantStudentCodeAccess();
  const toast = useToast();
  const [teacherId, setTeacherId] = useState<string>('');
  const [choice, setChoice] = useState<ExpiryChoice>('yearEnd');
  const [customDate, setCustomDate] = useState('');
  const [busy, setBusy] = useState(false);

  // Классный руководитель — тот, кому разрешение нужно в девяти случаях из десяти,
  // поэтому он подставлен; выбор остаётся за администратором.
  useEffect(() => {
    if (open) setTeacherId(defaultTeacherProfileId ? String(defaultTeacherProfileId) : '');
  }, [open, defaultTeacherProfileId]);

  const now = new Date();
  const problem = expiryProblem({ choice, yearEndDate, customDate, now });

  async function submit() {
    if (!teacherId || problem) return;
    const expiresAt = expiresAtIso({ choice, yearEndDate, customDate, now });
    setBusy(true);
    const outcome: GrantOutcome = { granted: 0, existed: 0, failed: 0 };
    // Последовательно, а не `Promise.all`: тридцать параллельных записей в одну таблицу
    // ничего не ускорят, а первый же отказ в пачке оставил бы итог неизвестным.
    for (const studentProfileId of studentProfileIds) {
      try {
        await grant.mutateAsync({
          studentProfileId,
          teacherProfileId: Number(teacherId),
          expiresAt,
        });
        outcome.granted += 1;
      } catch (error) {
        if (error instanceof ApiError && error.code === 'STUDENT_CODE_GRANT_EXISTS') {
          outcome.existed += 1;
        } else {
          outcome.failed += 1;
        }
      }
    }
    setBusy(false);
    if (outcome.granted === 0 && outcome.failed > 0 && outcome.existed === 0) {
      toast.error('Не удалось выдать разрешение. Попробуйте ещё раз.');
      return;
    }
    onDone(outcome);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Разрешить выдавать код"
      subtitle={`Выбрано учеников: ${studentProfileIds.length}`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Отмена</Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!teacherId || Boolean(problem)}>
            Выдать разрешение
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Учитель" required>
          <Select
            value={teacherId}
            disabled={teachers.isPending}
            placeholder={teachers.isPending ? 'Загружаем…' : 'Выберите учителя'}
            onChange={(event) => setTeacherId(event.target.value)}
          >
            {(teachers.data ?? []).map((teacher) => (
              <option key={teacher.id} value={String(teacher.id)}>
                {formatPersonName(teacher.lastName ?? '', teacher.firstName ?? '', teacher.middleName)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Срок разрешения" error={problem ?? undefined}>
          <Select value={choice} onChange={(event) => setChoice(event.target.value as ExpiryChoice)}>
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </Field>

        {choice === 'custom' && (
          <Field label="Действует до" required>
            <TextInput
              type="date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
            />
          </Field>
        )}

        <p className="text-13 leading-5 text-slate-500">
          Учитель сможет <span className="font-medium text-slate-700">выпустить новый</span> персональный
          код этим ученикам — в своей панели «Мой класс». Действующий код не показывается никому: в базе
          он лежит хэшем, поэтому «посмотреть» означает «выпустить новый», и прежний перестанет работать.
          Сбрасывать PIN учитель по-прежнему не сможет — это делает только администратор.
        </p>
        <p className="text-13 leading-5 text-slate-500">
          Выдача попадает в журнал доступа. Срок истекает сам, продлевать вручную не нужно.
        </p>
      </div>
      {teachers.isError && (
        <div className="mt-3">
          <ErrorBlock message="Не удалось загрузить список учителей." onRetry={() => void teachers.refetch()} />
        </div>
      )}
    </Modal>
  );
}
