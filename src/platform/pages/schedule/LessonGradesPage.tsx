import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  EyeOff,
  Flag,
  History,
  Info,
  LockKeyhole,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { CollapsibleCard } from '@/components/ui/CollapsibleCard';
import { Button } from '@/components/ui/Button';
import { GradeChip } from '@/components/ui/GradeChip';
import { GradePicker } from '@/components/ui/GradePicker';
import { PointsPicker, type PointsValue } from '@/components/ui/PointsPicker';
import { NoticeBar } from '@/components/ui/NoticeBar';
import {
  useCompleteCorrection,
  useCreateCorrection,
  useCreateGrade,
  useDeleteGrade,
  useGradeScale,
  useLesson,
  useLessonCorrectionHistory,
  useLessonCorrections,
  useLessonGradeSheet,
  useUpdateCorrection,
  useUpdateGrade,
} from '@/hooks/queries';
import type { CorrectionGradeValue, GradeCorrection } from '@/lib/gradeCorrectionsApi';
import {
  correctionBadge,
  correctionEventActor,
  describeCorrectionEvent,
  eventTime,
  gradeValueKey,
  rowCorrection,
  temporaryGradeLabel,
} from '@/lib/gradeCorrectionModel';
import { ApiError } from '@/lib/api';
import { cx, formatWeekdayDayMonth, pluralRu } from '@/lib/format';
import type {
  GradeScaleValue,
  GradeType,
  LessonGradeEntry,
  LessonGradeRow,
  SheetWorkType,
} from '@/lib/gradesApi';
import { GRADE_TYPE_LABELS, gradeValueLabel, writeStateNotice } from '@/lib/gradesModel';
import type { Lesson } from '@/lib/lessonsApi';
import {
  CorrectionExpiredModal,
  CorrectionFormModal,
  type CorrectionFormValues,
  type TemporaryGradeOptions,
} from './GradeCorrectionModals';
import { LessonDatePicker } from './LessonDatePicker';
import { hhmm } from './lessonHistory';

/**
 * Оценки за урок (Figma «Оценки — Частично заполнено», node 2098:241).
 *
 * <p><b>Что разрешено, решает бэкенд.</b> Лист приходит с посчитанными
 * `canManageGrades`, `writeState` и `canEdit` у каждой оценки
 * (`grades-read-contract.md` §12): экран не проверяет ни роль, ни время урока, ни
 * авторство. Правило окна замещающего живёт на сервере и меняется там же — повторить
 * его здесь значило бы получить активную кнопку и отказ в ответ на неё.
 *
 * <p><b>Админ сюда заходит, но ничего не ставит</b> (GRADES-002 §9): у него лист
 * открывается только на чтение, и об этом говорит строка сверху, а не пустые клетки.
 *
 * <p>Пустых мест ровно столько, сколько разрешено оценок за урок
 * (`maxGradesPerStudent`, сейчас одно — решение школы от 02.10.2026). Число приходит с сервера: свой лимит на
 * клиенте разошёлся бы с тем, что принимает бэкенд.
 *
 * <p><b>Шкала или баллы — тоже решает сервер</b> (GRADES-003): в периоде, который считается
 * по политике оценивания, лист приходит с `valueMode: POINTS` и типами работ, и вместо
 * сетки «2…5±» открывается выбор вида работы и балла.
 *
 * <p><b>Исправление работы</b> (Figma 1956:1399 и соседние): флажок у ученика без оценки
 * открывает «Отметить исправление»; у активного — ту же форму с текущими данными, у
 * просроченного — окно «Срок истёк». Временная оценка стоит пунктиром, а выбор значения в её
 * клетке ставит итоговую — сервер закрывает исправление и пишет обычную оценку урока.
 * Статус, просрочку и события истории экран не вычисляет: всё приходит с сервера.
 */
export function LessonGradesPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const id = Number(lessonId);
  const validId = Number.isFinite(id) && id > 0 ? id : null;

  if (validId === null) return <NoAccessState onBack={() => navigate('/lesson-schedule')} />;
  // Тот же приём, что у листа посещаемости: при переходе на другую дату занятия роут
  // не меняется, и без `key` открытый поповер уехал бы на соседний урок.
  return <LessonGradesScreen key={validId} lessonId={validId} />;
}

function LessonGradesScreen({ lessonId }: { lessonId: number }) {
  const navigate = useNavigate();
  const lessonQuery = useLesson(lessonId);
  const sheetQuery = useLessonGradeSheet(lessonId);
  const scaleQuery = useGradeScale();

  const createGrade = useCreateGrade(lessonId);
  const updateGrade = useUpdateGrade(lessonId);
  const deleteGrade = useDeleteGrade(lessonId);
  // Исправления — при том же праве, что и лист: без листа их не показать и не спросить.
  const correctionsQuery = useLessonCorrections(lessonId, sheetQuery.isSuccess);
  const correctionHistoryQuery = useLessonCorrectionHistory(lessonId, sheetQuery.isSuccess);
  const createCorrection = useCreateCorrection(lessonId);
  const updateCorrection = useUpdateCorrection(lessonId);
  const completeCorrection = useCompleteCorrection(lessonId);

  /** Какая клетка открыта: ученик плюс место в его строке. */
  const [openCell, setOpenCell] = useState<{ studentProfileId: number; slot: number } | null>(null);
  /** Тип, выбранный до значения: у новой оценки он остаётся в поповере до нажатия на балл. */
  const [draftType, setDraftType] = useState<GradeType | null>(null);
  const [cellError, setCellError] = useState<string | null>(null);
  /** Открытое окно исправления: форма (создание или правка) либо «Срок истёк». */
  const [correctionDialog, setCorrectionDialog] = useState<{
    kind: 'form' | 'expired';
    studentProfileId: number;
  } | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const lesson = lessonQuery.data;
  const sheet = sheetQuery.data;
  const busy =
    createGrade.isPending || updateGrade.isPending || deleteGrade.isPending || completeCorrection.isPending;
  const correctionBusy = createCorrection.isPending || updateCorrection.isPending;

  if (lessonQuery.isPending || sheetQuery.isPending) return <GradesSkeleton />;

  const notFound =
    (lessonQuery.error instanceof ApiError && lessonQuery.error.status === 404) ||
    (sheetQuery.error instanceof ApiError &&
      (sheetQuery.error.status === 404 || sheetQuery.error.status === 403));
  if (notFound) return <NoAccessState onBack={() => navigate('/lesson-schedule')} />;

  if (lessonQuery.isError || sheetQuery.isError || !lesson || !sheet) {
    return (
      <LoadFailedState
        onRetry={() => {
          void lessonQuery.refetch();
          void sheetQuery.refetch();
        }}
      />
    );
  }

  const rows = sheet.students ?? [];
  const maxGrades = sheet.maxGradesPerStudent ?? 1;
  const pointsMode = sheet.valueMode === 'POINTS';
  const workTypes = sheet.workTypes ?? [];
  const defaultWorkType = (sheet.defaultWorkType ?? 'FORMATIVE') as GradeType;
  /**
   * Максимум СОР/СОЧ общий для всего класса — строка «Максимальные баллы» в форме журнала.
   * Поэтому новый ввод подставляет последний максимум такой работы на этом уроке, а не
   * заставляет набирать «20» тридцать раз.
   */
  const suggestedMax = (type: GradeType): number | null => {
    let found: number | null = null;
    for (const row of rows) {
      for (const grade of row.grades ?? []) {
        if (grade.gradeType === type && grade.maxScore != null) found = Number(grade.maxScore);
      }
    }
    return found;
  };
  const canManage = Boolean(sheet.canManageGrades);
  const corrections = correctionsQuery.data ?? [];
  const correctionEvents = correctionHistoryQuery.data ?? [];
  const temporaryOptions: TemporaryGradeOptions = {
    pointsMode,
    scale: scaleQuery.data ?? [],
    defaultWorkType,
  };
  const dialogRow =
    correctionDialog != null
      ? rows.find((row) => row.studentProfileId === correctionDialog.studentProfileId) ?? null
      : null;
  const dialogCorrection = dialogRow ? rowCorrection(corrections, dialogRow.studentProfileId).open : null;
  const notice = writeStateNotice(sheet.writeState);
  const cancelled = lesson.status === 'CANCELLED';
  const target = [lesson.className, lesson.subgroupName].filter(Boolean).join(' · ');
  const meta = [target, lesson.room ? `Каб. ${lesson.room}` : null, actingTeacher(lesson)]
    .filter(Boolean)
    .join(' · ');

  function closeCell() {
    setOpenCell(null);
    setDraftType(null);
    setCellError(null);
  }

  /**
   * Одно действие на нажатие балла: у пустого места это создание, у занятого — правка.
   * Ошибка остаётся в поповере, а не всплывает баннером наверху: она относится к
   * конкретной клетке, и учителю нужно видеть, какой именно.
   */
  /** Баллы (GRADES-003): тип уходит вместе со значением — смена типа может сменить шкалу. */
  async function pickPoints(row: LessonGradeRow, grade: LessonGradeEntry | null, value: PointsValue) {
    setCellError(null);
    try {
      if (grade?.id != null) {
        await updateGrade.mutateAsync({
          gradeId: grade.id,
          score: value.score,
          maxScore: value.maxScore,
          gradeType: value.gradeType,
        });
      } else {
        await createGrade.mutateAsync({
          studentProfileId: row.studentProfileId as number,
          score: value.score,
          maxScore: value.maxScore,
          gradeType: value.gradeType,
        });
      }
      closeCell();
    } catch (error) {
      setCellError(error instanceof ApiError ? error.message : 'Не удалось сохранить оценку');
    }
  }

  async function pickValue(row: LessonGradeRow, grade: LessonGradeEntry | null, scaleCode: string) {
    setCellError(null);
    try {
      if (grade?.id != null) {
        await updateGrade.mutateAsync({
          gradeId: grade.id,
          scaleCode,
          gradeType: grade.gradeType ?? null,
        });
      } else {
        await createGrade.mutateAsync({
          studentProfileId: row.studentProfileId as number,
          scaleCode,
          gradeType: draftType,
        });
      }
      closeCell();
    } catch (error) {
      setCellError(error instanceof ApiError ? error.message : 'Не удалось сохранить оценку');
    }
  }

  /**
   * Тип у существующей оценки сохраняется сразу — отдельной кнопки «применить» в
   * макете нет. У новой сохранять ещё нечего, поэтому он ждёт выбора балла.
   */
  async function pickType(grade: LessonGradeEntry | null, type: GradeType | null) {
    setCellError(null);
    if (grade?.id == null || grade.scaleCode == null) {
      setDraftType(type);
      return;
    }
    try {
      await updateGrade.mutateAsync({ gradeId: grade.id, scaleCode: grade.scaleCode, gradeType: type });
    } catch (error) {
      setCellError(error instanceof ApiError ? error.message : 'Не удалось изменить тип оценки');
    }
  }

  function openCorrection(row: LessonGradeRow, open: GradeCorrection | null) {
    closeCell();
    setDialogError(null);
    setCorrectionDialog({
      kind: open?.overdue ? 'expired' : 'form',
      studentProfileId: row.studentProfileId as number,
    });
  }

  function closeCorrection() {
    setCorrectionDialog(null);
    setDialogError(null);
  }

  /**
   * Создание — всё сразу; правка — только изменённое: каждое поле на сервере становится своим
   * событием истории, и пересланный без изменений срок записал бы «срок изменён», которого не было.
   */
  async function saveCorrection(row: LessonGradeRow, open: GradeCorrection | null, values: CorrectionFormValues) {
    setDialogError(null);
    try {
      if (!open) {
        await createCorrection.mutateAsync({
          studentProfileId: row.studentProfileId as number,
          comment: values.comment,
          deadline: values.deadline,
          temporaryGrade: values.temporaryGrade,
        });
      } else {
        const temporaryChanged =
          gradeValueKey(values.temporaryGrade) !== gradeValueKey(open.temporaryGrade ?? null);
        const patch = {
          ...(values.comment !== open.comment ? { comment: values.comment } : {}),
          ...(values.deadline !== open.deadline ? { deadline: values.deadline } : {}),
          ...(temporaryChanged
            ? values.temporaryGrade
              ? { temporaryGrade: values.temporaryGrade }
              : { removeTemporaryGrade: true }
            : {}),
        };
        if (Object.keys(patch).length > 0) {
          await updateCorrection.mutateAsync({ correctionId: open.id as number, ...patch });
        }
      }
      closeCorrection();
    } catch (error) {
      setDialogError(error instanceof ApiError ? error.message : 'Не удалось сохранить исправление');
    }
  }

  async function extendCorrection(open: GradeCorrection, deadline: string) {
    setDialogError(null);
    try {
      await updateCorrection.mutateAsync({ correctionId: open.id as number, deadline });
      closeCorrection();
    } catch (error) {
      setDialogError(error instanceof ApiError ? error.message : 'Не удалось продлить срок');
    }
  }

  /** «Выставить итоговую оценку» из окна просрочки: выбор открывается в клетке ученика. */
  function gradeFromExpired(row: LessonGradeRow) {
    closeCorrection();
    setDraftType(null);
    setCellError(null);
    setOpenCell({ studentProfileId: row.studentProfileId as number, slot: CORRECTION_SLOT });
  }

  async function completeWith(open: GradeCorrection, value: CorrectionGradeValue) {
    setCellError(null);
    try {
      await completeCorrection.mutateAsync({ correctionId: open.id as number, ...value });
      closeCell();
    } catch (error) {
      setCellError(error instanceof ApiError ? error.message : 'Не удалось выставить итоговую оценку');
    }
  }

  async function removeGrade(grade: LessonGradeEntry) {
    setCellError(null);
    try {
      await deleteGrade.mutateAsync({ gradeId: grade.id as number });
      closeCell();
    } catch (error) {
      setCellError(error instanceof ApiError ? error.message : 'Не удалось снять оценку');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to={`/lesson-schedule/lessons/${lessonId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:text-navy-800"
        >
          <ArrowLeft className="size-4" />К уроку
        </Link>
        <span className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600">
            {formatWeekdayDayMonth(lesson.date)}
          </span>
          {/* Оценки смотрят и за прошлые занятия — тот же переключатель дат, что у
              посещаемости: уходить ради этого в расписание значит терять контекст. */}
          <LessonDatePicker
            lesson={lesson}
            onPick={(nextLessonId) => navigate(`/lesson-schedule/lessons/${nextLessonId}/grades`)}
          />
        </span>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-lesson-hero p-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="truncate text-lg font-bold text-slate-900">{lesson.subjectName}</h1>
          <span className="shrink-0 text-sm font-semibold text-slate-600">
            {hhmm(lesson.startTime)} – {hhmm(lesson.endTime)}
          </span>
        </div>
        {meta && <p className="text-13 text-slate-600">{meta}</p>}
      </section>

      {notice && (
        <NoticeBar
          tone={cancelled ? 'solid' : 'soft'}
          icon={
            cancelled ? (
              <EyeOff className="size-5" />
            ) : (
              <Info className="size-4 text-brand-600" />
            )
          }
        >
          {notice}
        </NoticeBar>
      )}

      <section className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">Оценки</h2>
          <span className="text-sm text-slate-600">{target || 'Класс не указан'}</span>
        </div>

        {pointsMode && canManage && (
          <p className="-mt-3 text-13 text-slate-500">
            Четверть считается по политике оценивания: формативные работы — от 1 до 10, СОР и
            СОЧ — балл из максимума.
          </p>
        )}

        {rows.length === 0 ? (
          <EmptyRoster />
        ) : (
          <div className="flex flex-col">
            {/* `px-3` повторяет отступ строки: с обводкой строка получила поля, и без
                этого шапка перестала стоять над колонкой имён. */}
            <div className="flex items-center justify-between border-b border-slate-200 px-3 pb-2">
              <span className="text-11 font-bold uppercase text-slate-400">ФИО Ученика</span>
              {canManage && (
                <span className="text-11 font-bold uppercase text-slate-400">
                  {maxGrades === 1
                    ? 'одна оценка за урок'
                    : `до ${maxGrades} ${pluralRu(maxGrades, ['оценки', 'оценок', 'оценок'])} за урок`}
                </span>
              )}
            </div>

            {rows.map((row) => (
              <StudentRow
                key={row.studentProfileId}
                row={row}
                correction={rowCorrection(corrections, row.studentProfileId)}
                onOpenCorrection={(open) => openCorrection(row, open)}
                onShowHistory={() =>
                  document.getElementById(HISTORY_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                onCompleteValue={(open, scaleCode) =>
                  void completeWith(open, { scaleCode, gradeType: draftType })
                }
                onCompletePoints={(open, value) => void completeWith(open, value)}
                maxGrades={maxGrades}
                canManage={canManage}
                busy={busy}
                scale={scaleQuery.data ?? []}
                pointsMode={pointsMode}
                workTypes={workTypes}
                defaultWorkType={defaultWorkType}
                suggestedMax={suggestedMax}
                openSlot={
                  openCell != null && openCell.studentProfileId === row.studentProfileId
                    ? openCell.slot
                    : null
                }
                draftType={draftType}
                error={cellError}
                onOpen={(slot) => {
                  setDraftType(null);
                  setCellError(null);
                  setOpenCell({ studentProfileId: row.studentProfileId as number, slot });
                }}
                onClose={closeCell}
                onPickValue={(grade, scaleCode) => void pickValue(row, grade, scaleCode)}
                onPickPoints={(grade, value) => void pickPoints(row, grade, value)}
                onPickType={(grade, type) => void pickType(grade, type)}
                onRemove={(grade) => void removeGrade(grade)}
              />
            ))}
          </div>
        )}

        {correctionEvents.length > 0 && (
          <div id={HISTORY_ID}>
            <CollapsibleCard
              icon={<Clock className="size-[18px] text-slate-900" />}
              title={`История изменений (${correctionEvents.length})`}
              defaultOpen
            >
              <ul className="flex flex-col gap-3">
                {correctionEvents.map((event, index) => (
                  <li key={event.id ?? `expired-${event.correctionId}-${index}`} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
                    <span className="text-13 text-slate-600">
                      {eventTime(event.createdAt)} ·{' '}
                      <span className="font-semibold text-slate-900">{correctionEventActor(event)}</span> ·{' '}
                      {event.studentName ? `${event.studentName}: ` : ''}
                      {describeCorrectionEvent(event)}
                    </span>
                  </li>
                ))}
              </ul>
            </CollapsibleCard>
          </div>
        )}
      </section>

      {correctionDialog?.kind === 'form' && dialogRow && (
        <CorrectionFormModal
          lessonId={lessonId}
          studentName={dialogRow.fullName ?? ''}
          correction={dialogCorrection}
          options={temporaryOptions}
          busy={correctionBusy}
          error={dialogError}
          onSubmit={(values) => void saveCorrection(dialogRow, dialogCorrection, values)}
          onClose={closeCorrection}
        />
      )}
      {correctionDialog?.kind === 'expired' && dialogRow && dialogCorrection && (
        <CorrectionExpiredModal
          lessonId={lessonId}
          correction={dialogCorrection}
          busy={correctionBusy}
          error={dialogError}
          onExtend={(deadline) => void extendCorrection(dialogCorrection, deadline)}
          onGrade={() => gradeFromExpired(dialogRow)}
          onClose={closeCorrection}
        />
      )}
    </div>
  );
}

/** Клетка исправления в строке — не номер места под оценку, а отдельное значение `openSlot`. */
const CORRECTION_SLOT = -1;
const HISTORY_ID = 'grade-corrections-history';

/**
 * Строка ученика: сначала выставленные оценки, потом свободные места до лимита.
 *
 * <p>Свободные места показываются только тому, кто может ставить: в режиме чтения «+»
 * выглядел бы приглашением к действию, которого нет. Читателю остаётся прочерк — он
 * говорит «оценок нет» и ничего не обещает.
 */
function StudentRow({
  row,
  correction,
  onOpenCorrection,
  onShowHistory,
  onCompleteValue,
  onCompletePoints,
  maxGrades,
  canManage,
  busy,
  scale,
  pointsMode,
  workTypes,
  defaultWorkType,
  suggestedMax,
  openSlot,
  draftType,
  error,
  onOpen,
  onClose,
  onPickValue,
  onPickPoints,
  onPickType,
  onRemove,
}: {
  row: LessonGradeRow;
  correction: { open: GradeCorrection | null; completed: GradeCorrection | null };
  onOpenCorrection: (open: GradeCorrection | null) => void;
  onShowHistory: () => void;
  onCompleteValue: (open: GradeCorrection, scaleCode: string) => void;
  onCompletePoints: (open: GradeCorrection, value: PointsValue) => void;
  maxGrades: number;
  canManage: boolean;
  busy: boolean;
  scale: GradeScaleValue[];
  pointsMode: boolean;
  workTypes: SheetWorkType[];
  defaultWorkType: GradeType;
  suggestedMax: (type: GradeType) => number | null;
  openSlot: number | null;
  draftType: GradeType | null;
  error: string | null;
  onOpen: (slot: number) => void;
  onClose: () => void;
  onPickValue: (grade: LessonGradeEntry | null, scaleCode: string) => void;
  onPickPoints: (grade: LessonGradeEntry | null, value: PointsValue) => void;
  onPickType: (grade: LessonGradeEntry | null, type: GradeType | null) => void;
  onRemove: (grade: LessonGradeEntry) => void;
}) {
  const grades = row.grades ?? [];
  const activeCorrection = correction.open;
  // Пока работа на исправлении, её место в строке — клетка временной оценки: выбор значения
  // в ней и есть итоговая оценка.
  const freeSlots = canManage && !activeCorrection ? Math.max(0, maxGrades - grades.length) : 0;
  const open = openSlot != null;
  const badge = activeCorrection ? correctionBadge(activeCorrection) : null;
  const temporary = activeCorrection ? temporaryGradeLabel(activeCorrection.temporaryGrade) : null;

  return (
    /*
      Строка обводится под курсором и остаётся обведённой, пока в ней открыт выбор
      (Figma 2138:5803). До этого клетки стояли в общей сетке одинаковых квадратов, и
      попасть в чужую строку было проще, чем в свою: поповер накрывал соседей, а ничего
      не говорило, чью работу оценивают.

      Разделитель — псевдоэлемент, а не `border-b`: обведённая строка должна выглядеть
      цельной рамкой, и линию под ней нужно убрать, не трогая высоту остальных.
      Обводка тоже `ring`, а не `border`, — иначе строка на ховере прыгала бы на пиксель.
    */
    <div
      className={cx(
        'relative flex min-h-[52px] items-center gap-3 rounded-xl px-3 py-3 transition',
        'after:pointer-events-none after:absolute after:inset-x-3 after:bottom-0',
        'after:h-px after:bg-slate-200 last:after:hidden',
        open
          ? 'z-10 bg-white ring-2 ring-navy-700 after:hidden'
          : canManage
            ? 'hover:bg-navy-50/60 hover:ring-1 hover:ring-navy-400/50'
            : null,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <p className="min-w-0 truncate text-sm text-slate-900">{row.fullName}</p>
        {badge && (
          <span
            className={cx(
              'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-11',
              badge.tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-amber-600',
            )}
          >
            {badge.tone === 'danger' ? (
              <TriangleAlert className="size-3" aria-hidden="true" />
            ) : (
              <Clock className="size-3" aria-hidden="true" />
            )}
            {badge.text}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {grades.length === 0 && !canManage && !activeCorrection && (
          <span className="text-sm text-slate-400">—</span>
        )}

        {grades.map((grade, index) => (
          <div key={grade.id} className="relative">
            <GradeChip
              value={gradeValueLabel(grade)}
              active={openSlot === index}
              disabled={!grade.canEdit}
              title={gradeTitle(grade)}
              onClick={grade.canEdit ? () => onOpen(index) : undefined}
            />
            {openSlot === index && pointsMode && (
              <PointsPicker
                workTypes={workTypes}
                value={grade}
                defaultType={defaultWorkType}
                suggestedMax={suggestedMax}
                studentName={row.fullName}
                busy={busy}
                error={error}
                canRemove
                onSubmit={(value) => onPickPoints(grade, value)}
                onRemove={() => onRemove(grade)}
                onClose={onClose}
              />
            )}
            {openSlot === index && !pointsMode && (
              <GradePicker
                scale={scale}
                studentName={row.fullName}
                value={grade.scaleCode}
                gradeType={grade.gradeType ?? null}
                busy={busy}
                error={error}
                canRemove
                onPick={(code) => onPickValue(grade, code)}
                onTypeChange={(type) => onPickType(grade, type)}
                onRemove={() => onRemove(grade)}
                onClose={onClose}
              />
            )}
          </div>
        ))}

        {Array.from({ length: freeSlots }, (_, index) => {
          const slot = grades.length + index;
          return (
            <div key={`empty-${slot}`} className="relative">
              <GradeChip active={openSlot === slot} onClick={() => onOpen(slot)} />
              {openSlot === slot && pointsMode && (
                <PointsPicker
                  workTypes={workTypes}
                  defaultType={defaultWorkType}
                  suggestedMax={suggestedMax}
                  studentName={row.fullName}
                  busy={busy}
                  error={error}
                  onSubmit={(value) => onPickPoints(null, value)}
                  onClose={onClose}
                />
              )}
              {openSlot === slot && !pointsMode && (
                <GradePicker
                  scale={scale}
                  studentName={row.fullName}
                  gradeType={draftType}
                  busy={busy}
                  error={error}
                  onPick={(code) => onPickValue(null, code)}
                  onTypeChange={(type) => onPickType(null, type)}
                  onClose={onClose}
                />
              )}
            </div>
          );
        })}

        {activeCorrection && (
          <div className="relative">
            <button
              type="button"
              disabled={!canManage}
              onClick={canManage ? () => onOpen(CORRECTION_SLOT) : undefined}
              title={temporary ? 'Временная оценка — не влияет на средний балл' : 'Выставить итоговую оценку'}
              aria-label={temporary ? `Временная оценка ${temporary}` : 'Выставить итоговую оценку'}
              className={cx(
                'flex h-8 min-w-8 items-center justify-center rounded-lg border border-dashed px-1 text-11 transition',
                'border-amber-600 bg-orange-50 text-amber-600',
                canManage ? 'hover:bg-orange-100' : 'cursor-default',
                openSlot === CORRECTION_SLOT && 'ring-2 ring-navy-700 ring-offset-1',
              )}
            >
              {temporary ?? '+'}
            </button>
            {openSlot === CORRECTION_SLOT && pointsMode && (
              <PointsPicker
                workTypes={workTypes}
                value={activeCorrection.temporaryGrade ?? null}
                defaultType={defaultWorkType}
                suggestedMax={suggestedMax}
                studentName={row.fullName}
                busy={busy}
                error={error}
                onSubmit={(value) => onCompletePoints(activeCorrection, value)}
                onClose={onClose}
              />
            )}
            {openSlot === CORRECTION_SLOT && !pointsMode && (
              <GradePicker
                scale={scale}
                studentName={row.fullName}
                gradeType={draftType}
                busy={busy}
                error={error}
                onPick={(code) => onCompleteValue(activeCorrection, code)}
                onTypeChange={(type) => onPickType(null, type)}
                onClose={onClose}
              />
            )}
          </div>
        )}

        {canManage && (
          <CorrectionAction
            correction={correction}
            graded={grades.length > 0}
            onOpenCorrection={onOpenCorrection}
            onShowHistory={onShowHistory}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Кнопка исправления справа от оценки (Figma 1956:1399, 1981:1893):
 * флажок у ученика без оценки — «Отметить исправление»; у активного исправления — открыть
 * его; приглушённый и неактивный у оценённого — исправлять нечего; значок истории у
 * завершённого — к ленте событий ниже.
 */
function CorrectionAction({
  correction,
  graded,
  onOpenCorrection,
  onShowHistory,
}: {
  correction: { open: GradeCorrection | null; completed: GradeCorrection | null };
  graded: boolean;
  onOpenCorrection: (open: GradeCorrection | null) => void;
  onShowHistory: () => void;
}) {
  const base = 'flex size-8 shrink-0 items-center justify-center rounded-lg border transition';

  if (correction.open) {
    return (
      <button
        type="button"
        onClick={() => onOpenCorrection(correction.open)}
        aria-label={correction.open.overdue ? 'Срок исправления истёк' : 'Открыть исправление'}
        title={correction.open.overdue ? 'Срок истёк' : 'Исправление'}
        className={cx(base, 'border-slate-300 text-navy-700 hover:border-navy-700')}
      >
        <Flag className="size-4" aria-hidden="true" />
      </button>
    );
  }
  if (graded && correction.completed) {
    return (
      <button
        type="button"
        onClick={onShowHistory}
        aria-label="История исправления"
        title="Исправление завершено — история ниже"
        className={cx(base, 'border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-600')}
      >
        <History className="size-4" aria-hidden="true" />
      </button>
    );
  }
  if (graded) {
    return (
      <button
        type="button"
        disabled
        aria-label="Отметить исправление"
        title="Оценка уже выставлена"
        className={cx(base, 'cursor-default border-slate-200 bg-slate-50 text-slate-300')}
      >
        <Flag className="size-4" aria-hidden="true" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpenCorrection(null)}
      aria-label="Отметить исправление"
      title="Отметить исправление"
      className={cx(base, 'border-slate-300 text-navy-700 hover:border-navy-700')}
    >
      <Flag className="size-4" aria-hidden="true" />
    </button>
  );
}

/** Подпись под курсором: чья оценка и какого она типа — обе строки необязательны. */
function gradeTitle(grade: LessonGradeEntry): string {
  const parts = [
    grade.gradeType ? GRADE_TYPE_LABELS[grade.gradeType] : null,
    grade.authorName ? `Выставил: ${grade.authorName}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function actingTeacher(lesson: Lesson): string | null {
  const acting = lesson.substituteTeacher ?? lesson.teacher;
  return acting?.fullName ?? null;
}

function EmptyRoster() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Users className="size-7" />
      </span>
      <p className="text-sm font-semibold text-slate-900">В уроке отсутствуют ученики</p>
      <p className="max-w-state-text-wide text-13 text-slate-500">
        Проверьте состав класса или подгруппы у администратора.
      </p>
    </div>
  );
}

function GradesSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Загрузка оценок">
      <div className="h-4 w-72 rounded bg-slate-200" />
      <div className="h-24 rounded-2xl bg-slate-200/70" />
      <div className="h-96 rounded-2xl bg-slate-200/50" />
    </div>
  );
}

function CenteredState({
  icon,
  title,
  description,
  action,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
  tone: 'neutral' | 'danger';
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-40 text-center">
      <div
        className={cx(
          'flex size-20 items-center justify-center rounded-full',
          tone === 'danger' ? 'bg-danger-bg text-red-500' : 'bg-slate-100 text-slate-400',
        )}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-lg font-bold text-slate-900">{title}</p>
        <p className="max-w-state-text-wide text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function NoAccessState({ onBack }: { onBack: () => void }) {
  return (
    <CenteredState
      tone="neutral"
      icon={<LockKeyhole className="size-8" />}
      title="У вас нет доступа к оценкам этого урока"
      description="Оценки видят администратор и учителя урока."
      action={
        <Button variant="secondary" onClick={onBack}>
          Вернуться к расписанию
        </Button>
      }
    />
  );
}

function LoadFailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <CenteredState
      tone="danger"
      icon={<AlertTriangle className="size-8" />}
      title="Не удалось загрузить оценки"
      description="Попробуйте обновить страницу"
      action={
        <Button variant="secondary" onClick={onRetry}>
          Повторить
        </Button>
      }
    />
  );
}
