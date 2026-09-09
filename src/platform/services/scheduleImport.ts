/**
 * Запись разобранного расписания в школу.
 *
 * Импорт не получает своего эндпоинта: он пишет тем же `POST …/lessons`, которым
 * пользуется конструктор. Отсюда и главное свойство — импортированный урок ничем не
 * отличается от поставленного руками, его так же видит движок конфликтов и так же
 * правит администратор. Отдельный «импортный» путь записи означал бы вторые правила
 * валидации.
 *
 * Черновик на класс берётся через `resolveScheduleDraft`: он возвращает уже существующий,
 * если тот был. Действующую публикацию импорт не трогает — бэкенд на неё отвечает
 * отказом, и класс попадает в отчёт, а не переписывается молча.
 */

import { ApiError } from '@/lib/api';
import type { ClassImportPlan } from '@/lib/scheduleImport/resolveScheduleImport';
import {
  createScheduleLesson,
  deleteScheduleLesson,
  listScheduleLessons,
  resolveScheduleDraft,
} from './schedules';

/** Что делать с черновиком, в котором уже есть уроки. */
export type ExistingDraftMode = 'skip' | 'replace';

export type ClassImportOutcome = 'imported' | 'skipped' | 'failed';

export interface ClassImportResult {
  className: string;
  classId: number;
  outcome: ClassImportOutcome;
  scheduleId: number | null;
  created: number;
  /** Уроки, которые бэкенд отклонил: показываем причину, а не «частично готово». */
  failures: Array<{ lesson: string; message: string }>;
  message: string | null;
}

export interface ImportProgress {
  className: string;
  classIndex: number;
  classCount: number;
  lessonsDone: number;
  lessonsTotal: number;
}

export interface RunImportOptions {
  academicYearId: number;
  academicPeriodId: number;
  existingDraftMode: ExistingDraftMode;
  onProgress?: (progress: ImportProgress) => void;
  signal?: AbortSignal;
}

/** Уроков в запросе одновременно: больше — быстрее, но лог ошибок становится нечитаемым. */
const LESSON_CONCURRENCY = 6;

function describeLesson(plan: ClassImportPlan['lessons'][number]): string {
  const day = plan.source.weekday;
  return `${day} · урок ${plan.source.lessonNumber} · ${plan.subjectName}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

async function createLessons(
  scheduleId: number,
  plan: ClassImportPlan,
  report: (done: number) => void,
  signal?: AbortSignal,
): Promise<ClassImportResult['failures']> {
  const failures: ClassImportResult['failures'] = [];
  let done = 0;
  let cursor = 0;

  async function worker() {
    for (;;) {
      if (signal?.aborted) return;
      const index = cursor++;
      const lesson = plan.lessons[index];
      if (!lesson) return;
      try {
        await createScheduleLesson(scheduleId, {
          weekday: lesson.weekday,
          lessonPeriodId: lesson.lessonPeriodId,
          subjectId: lesson.subjectId,
          teacherId: lesson.teacherId,
          targetType: lesson.targetType,
          subgroupId: lesson.subgroupId,
          room: lesson.room,
        });
      } catch (error) {
        failures.push({ lesson: describeLesson(lesson), message: errorMessage(error) });
      }
      report(++done);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(LESSON_CONCURRENCY, plan.lessons.length) }, worker),
  );
  return failures;
}

export async function runScheduleImport(
  plans: ClassImportPlan[],
  options: RunImportOptions,
): Promise<ClassImportResult[]> {
  const results: ClassImportResult[] = [];

  for (let index = 0; index < plans.length; index++) {
    const plan = plans[index];
    if (options.signal?.aborted) break;
    if (plan.classId == null) continue;

    const base = {
      className: plan.className,
      classId: plan.classId,
      created: 0,
      failures: [] as ClassImportResult['failures'],
    };
    options.onProgress?.({
      className: plan.className,
      classIndex: index,
      classCount: plans.length,
      lessonsDone: 0,
      lessonsTotal: plan.lessons.length,
    });

    let scheduleId: number;
    try {
      const draft = await resolveScheduleDraft({
        academicYearId: options.academicYearId,
        academicPeriodId: options.academicPeriodId,
        classId: plan.classId,
      });
      scheduleId = draft.id;
    } catch (error) {
      results.push({
        ...base,
        outcome: 'failed',
        scheduleId: null,
        message: errorMessage(error),
      });
      continue;
    }

    const existing = await listScheduleLessons(scheduleId).catch(() => []);
    if (existing.length > 0) {
      if (options.existingDraftMode === 'skip') {
        results.push({
          ...base,
          outcome: 'skipped',
          scheduleId,
          message: `В черновике уже ${existing.length} уроков — класс пропущен`,
        });
        continue;
      }
      for (const lesson of existing) {
        await deleteScheduleLesson(scheduleId, lesson.id).catch(() => undefined);
      }
    }

    const failures = await createLessons(
      scheduleId,
      plan,
      (done) =>
        options.onProgress?.({
          className: plan.className,
          classIndex: index,
          classCount: plans.length,
          lessonsDone: done,
          lessonsTotal: plan.lessons.length,
        }),
      options.signal,
    );

    results.push({
      ...base,
      outcome: failures.length === plan.lessons.length && plan.lessons.length > 0 ? 'failed' : 'imported',
      scheduleId,
      created: plan.lessons.length - failures.length,
      failures,
      message:
        failures.length > 0 ? `Не удалось создать ${failures.length} из ${plan.lessons.length}` : null,
    });
  }

  return results;
}
