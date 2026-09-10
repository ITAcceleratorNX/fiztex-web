import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, EyeOff, Info, LockKeyhole, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GradeChip } from '@/components/ui/GradeChip';
import { GradePicker } from '@/components/ui/GradePicker';
import { NoticeBar } from '@/components/ui/NoticeBar';
import {
  useCreateGrade,
  useDeleteGrade,
  useGradeScale,
  useLesson,
  useLessonGradeSheet,
  useUpdateGrade,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { cx, formatWeekdayDayMonth, pluralRu } from '@/lib/format';
import type {
  GradeScaleValue,
  GradeType,
  LessonGradeEntry,
  LessonGradeRow,
} from '@/lib/gradesApi';
import { GRADE_TYPE_LABELS, writeStateNotice } from '@/lib/gradesModel';
import type { Lesson } from '@/lib/lessonsApi';
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
 * (`maxGradesPerStudent`, сегодня три). Число приходит с сервера: свой лимит на
 * клиенте разошёлся бы с тем, что принимает бэкенд.
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

  /** Какая клетка открыта: ученик плюс место в его строке. */
  const [openCell, setOpenCell] = useState<{ studentProfileId: number; slot: number } | null>(null);
  /** Тип, выбранный до значения: у новой оценки он остаётся в поповере до нажатия на балл. */
  const [draftType, setDraftType] = useState<GradeType | null>(null);
  const [cellError, setCellError] = useState<string | null>(null);

  const lesson = lessonQuery.data;
  const sheet = sheetQuery.data;
  const busy = createGrade.isPending || updateGrade.isPending || deleteGrade.isPending;

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
  const maxGrades = sheet.maxGradesPerStudent ?? 3;
  const canManage = Boolean(sheet.canManageGrades);
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
                  до {maxGrades} {pluralRu(maxGrades, ['оценки', 'оценок', 'оценок'])} за урок
                </span>
              )}
            </div>

            {rows.map((row) => (
              <StudentRow
                key={row.studentProfileId}
                row={row}
                maxGrades={maxGrades}
                canManage={canManage}
                busy={busy}
                scale={scaleQuery.data ?? []}
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
                onPickType={(grade, type) => void pickType(grade, type)}
                onRemove={(grade) => void removeGrade(grade)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Строка ученика: сначала выставленные оценки, потом свободные места до лимита.
 *
 * <p>Свободные места показываются только тому, кто может ставить: в режиме чтения «+»
 * выглядел бы приглашением к действию, которого нет. Читателю остаётся прочерк — он
 * говорит «оценок нет» и ничего не обещает.
 */
function StudentRow({
  row,
  maxGrades,
  canManage,
  busy,
  scale,
  openSlot,
  draftType,
  error,
  onOpen,
  onClose,
  onPickValue,
  onPickType,
  onRemove,
}: {
  row: LessonGradeRow;
  maxGrades: number;
  canManage: boolean;
  busy: boolean;
  scale: GradeScaleValue[];
  openSlot: number | null;
  draftType: GradeType | null;
  error: string | null;
  onOpen: (slot: number) => void;
  onClose: () => void;
  onPickValue: (grade: LessonGradeEntry | null, scaleCode: string) => void;
  onPickType: (grade: LessonGradeEntry | null, type: GradeType | null) => void;
  onRemove: (grade: LessonGradeEntry) => void;
}) {
  const grades = row.grades ?? [];
  const freeSlots = canManage ? Math.max(0, maxGrades - grades.length) : 0;
  const open = openSlot != null;

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
      <p className="min-w-0 flex-1 truncate text-sm text-slate-900">{row.fullName}</p>

      <div className="flex shrink-0 items-center gap-2">
        {grades.length === 0 && !canManage && <span className="text-sm text-slate-400">—</span>}

        {grades.map((grade, index) => (
          <div key={grade.id} className="relative">
            <GradeChip
              value={grade.scaleCode}
              active={openSlot === index}
              disabled={!grade.canEdit}
              title={gradeTitle(grade)}
              onClick={grade.canEdit ? () => onOpen(index) : undefined}
            />
            {openSlot === index && (
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
              {openSlot === slot && (
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
      </div>
    </div>
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
