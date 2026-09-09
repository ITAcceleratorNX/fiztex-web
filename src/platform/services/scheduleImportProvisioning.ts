/**
 * Создание недостающих сущностей перед импортом расписания.
 *
 * Пишет теми же эндпоинтами, что и разделы «Классы», «Предметы», «Шаблоны звонков»
 * и «Подгруппы»: заведённый отсюда класс ничем не отличается от заведённого руками.
 * Своего «импортного» способа создания нет — иначе у школы появились бы сущности,
 * которые прошли мимо обычных проверок.
 *
 * Создаётся только то, что файл описывает полностью. **Учителя здесь нет:** от него в
 * файле остались две буквы, а карточке нужны фамилия, имя и уникальный телефон.
 * Неизвестные инициалы остаются строкой отчёта, где администратор выбирает из тех,
 * кто в школе уже есть.
 *
 * Порядок шагов задан зависимостями, а не удобством: звонки привязываются к классам,
 * подгруппы живут в классе, поэтому классы создаются раньше и того, и другого.
 * Шаг, который не удался, не отменяет остальные — его строка уходит в отчёт.
 */

import { ApiError } from '@/lib/api';
import { scheduleSettingsApi } from '@/lib/scheduleSettingsApi';
import { subgroupsApi } from '@/lib/schedule2bApi';
import type { ProvisioningPlan } from '@/lib/scheduleImport/planProvisioning';
import { createClass } from './classes';
import { createSchoolSubject } from './schoolSubjects';

/** Классов одновременно: создание каждого — отдельная транзакция на бэкенде. */
const CREATE_CONCURRENCY = 4;

export type ProvisionKind = 'subject' | 'class' | 'bellTemplate' | 'subgroups';

export interface ProvisionItemResult {
  kind: ProvisionKind;
  /** Что создавалось: имя класса, название предмета, инициалы. */
  label: string;
  ok: boolean;
  message: string | null;
}

export interface ProvisionProgress {
  kind: ProvisionKind;
  label: string;
  done: number;
  total: number;
}

export interface ProvisionOptions {
  academicYearId: number;
  /** Что именно создавать — снятая галочка означает «этот вид пропустить». */
  kinds: Record<ProvisionKind, boolean>;
  /**
   * Класс из справочника по имени в файле. Звонки и подгруппы нужны и тем классам,
   * которые уже существуют, — без этого шаг работал бы только для новых.
   */
  resolveClassId?: (fileClassName: string) => number | null;
  onProgress?: (progress: ProvisionProgress) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

async function pool<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function run() {
    for (;;) {
      const item = items[cursor++];
      if (item === undefined) return;
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CREATE_CONCURRENCY, items.length) }, run));
}

export async function runProvisioning(
  plan: ProvisioningPlan,
  options: ProvisionOptions,
): Promise<ProvisionItemResult[]> {
  const results: ProvisionItemResult[] = [];
  const classIdByName = new Map<string, number>();

  const report = (kind: ProvisionKind, label: string, done: number, total: number) =>
    options.onProgress?.({ kind, label, done, total });

  // ── Предметы ─────────────────────────────────────────────────────────────────
  if (options.kinds.subject) {
    let done = 0;
    await pool(plan.subjects, async (subject) => {
      try {
        await createSchoolSubject(subject.name);
        results.push({ kind: 'subject', label: subject.name, ok: true, message: null });
      } catch (error) {
        results.push({
          kind: 'subject',
          label: subject.name,
          ok: false,
          message: errorMessage(error),
        });
      }
      report('subject', subject.name, ++done, plan.subjects.length);
    });
  }

  // ── Классы ───────────────────────────────────────────────────────────────────
  if (options.kinds.class) {
    let done = 0;
    await pool(plan.classes, async (item) => {
      try {
        const created = await createClass({
          academicYearId: String(options.academicYearId),
          name: item.name,
          grade: item.grade,
          letter: item.letter,
        });
        classIdByName.set(item.name, Number(created.id));
        results.push({ kind: 'class', label: item.name, ok: true, message: null });
      } catch (error) {
        results.push({ kind: 'class', label: item.name, ok: false, message: errorMessage(error) });
      }
      report('class', item.name, ++done, plan.classes.length);
    });
  }

  // ── Шаблоны звонков ──────────────────────────────────────────────────────────
  // Последовательно: шаблонов единицы, а привязка классов должна идти строго после
  // того, как у шаблона появились периоды — иначе класс встанет на пустой звонок.
  if (options.kinds.bellTemplate) {
    let done = 0;
    for (const template of plan.bellTemplates) {
      try {
        const created = await scheduleSettingsApi.createBellTemplate({
          academicYearId: options.academicYearId,
          name: template.name,
        });
        for (const period of template.periods) {
          await scheduleSettingsApi.addPeriod(created.id, {
            lessonNumber: period.lessonNumber,
            startTime: `${period.startTime}:00`,
            endTime: `${period.endTime}:00`,
          });
        }
        const classIds = template.classNames
          .map((name) => classIdByName.get(name) ?? options.resolveClassId?.(name) ?? null)
          .filter((id): id is number => id != null);
        if (classIds.length > 0) {
          await scheduleSettingsApi.assignBindings(created.id, {
            classIds,
            replaceExisting: true,
          });
        }
        results.push({
          kind: 'bellTemplate',
          label: `${template.name} — классов: ${classIds.length}`,
          ok: true,
          message: null,
        });
      } catch (error) {
        results.push({
          kind: 'bellTemplate',
          label: template.name,
          ok: false,
          message: errorMessage(error),
        });
      }
      report('bellTemplate', template.name, ++done, plan.bellTemplates.length);
    }
  }

  // ── Подгруппы ────────────────────────────────────────────────────────────────
  if (options.kinds.subgroups) {
    let done = 0;
    await pool(plan.subgroups, async (item) => {
      const classId = classIdByName.get(item.className) ?? options.resolveClassId?.(item.className);
      if (classId == null) {
        results.push({
          kind: 'subgroups',
          label: item.className,
          ok: false,
          message: 'Класс не создан — подгруппы некуда добавить',
        });
        report('subgroups', item.className, ++done, plan.subgroups.length);
        return;
      }
      try {
        const groupSet = await subgroupsApi.createGroupSet({
          classId,
          name: 'Деление класса',
        });
        for (const label of item.labels) {
          await subgroupsApi.createSubgroup({ groupSetId: groupSet.id, name: `Группа ${label}` });
        }
        results.push({
          kind: 'subgroups',
          label: `${item.className}: ${item.labels.map((l) => `Группа ${l}`).join(', ')}`,
          ok: true,
          message: null,
        });
      } catch (error) {
        results.push({
          kind: 'subgroups',
          label: item.className,
          ok: false,
          message: errorMessage(error),
        });
      }
      report('subgroups', item.className, ++done, plan.subgroups.length);
    });
  }

  return results;
}
