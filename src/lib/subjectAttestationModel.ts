import type {
  AttestationPeriodicity,
  AttestationPreview,
  AttestationResultFormat,
  AttestationSetting,
  AttestationSettingRequest,
  EffectiveFromOption,
} from './attestationSettingsApi';
import { pluralRu } from './format';

/**
 * «Итоговая аттестация по предметам» глазами администрации (макеты А1–А10): слова, сводки и
 * чтение предпросмотра. Правил здесь нет — с какого периода можно начать, что пересекается и
 * какие итоги помешают, отвечает сервер (`preview`); модель только называет ответ.
 */

export const RESULT_FORMAT_LABELS: Record<AttestationResultFormat, string> = {
  NUMERIC: '10-балльная',
  PASS_FAIL: 'Зачёт / Незачёт',
};

/** Коротко — в сводке колонки «Аттестация» (А1): «Зачёт · Полугодие · Без СОЧ». */
const RESULT_FORMAT_SHORT: Record<AttestationResultFormat, string> = { NUMERIC: '10-балльная', PASS_FAIL: 'Зачёт' };

export const PERIODICITY_LABELS: Record<AttestationPeriodicity, string> = {
  QUARTER: 'Четверть',
  HALF_YEAR: 'Полугодие',
};

/** Умолчание ТЗ: 10-балльная, четверть, СОЧ предусмотрен. Так оценивается класс без настройки. */
export const DEFAULT_RULE = { resultFormat: 'NUMERIC', periodicity: 'QUARTER', sochProvided: true } as const satisfies {
  resultFormat: AttestationResultFormat; periodicity: AttestationPeriodicity; sochProvided: boolean;
};

export const DEFAULT_RULE_LINE = '10-балльная, четверть, СОЧ предусмотрен';

type Rule = { resultFormat?: AttestationResultFormat; periodicity?: AttestationPeriodicity; sochProvided?: boolean };

/** «Зачёт / Незачёт · полугодие · без СОЧ» — правило строкой (А2). */
export function ruleLine(rule: Rule): string {
  return [
    RESULT_FORMAT_LABELS[rule.resultFormat ?? 'NUMERIC'],
    PERIODICITY_LABELS[rule.periodicity ?? 'QUARTER'].toLowerCase(),
    rule.sochProvided === false ? 'без СОЧ' : 'СОЧ',
  ].join(' · ');
}

/** Только то, чем правило отличается от умолчания: «Зачёт · Полугодие · Без СОЧ» (А1). */
export function ruleDifference(rule: Rule): string {
  const parts: string[] = [];
  if (rule.resultFormat && rule.resultFormat !== DEFAULT_RULE.resultFormat) parts.push(RESULT_FORMAT_SHORT[rule.resultFormat]);
  if (rule.periodicity && rule.periodicity !== DEFAULT_RULE.periodicity) parts.push(PERIODICITY_LABELS[rule.periodicity]);
  if (rule.sochProvided === false) parts.push('Без СОЧ');
  return parts.length > 0 ? parts.join(' · ') : '10-балльная · Четверть · СОЧ';
}

/** «5 параллель» или «5А». */
export function scopeTitle(setting: Pick<AttestationSetting, 'parallel' | 'className'>): string {
  return setting.parallel ? `${setting.parallel} параллель` : setting.className ?? 'Класс';
}

/** «5 параллели» / «класса 5А» — для «настройка …». */
export function scopeGenitive(setting: Pick<AttestationSetting, 'parallel' | 'className'>): string {
  return setting.parallel ? `${setting.parallel} параллели` : `класса ${setting.className ?? ''}`;
}

/** Затронутые классы: до четырёх — списком, больше — числом («12 классов»). */
export function classesCaption(classNames: readonly string[] | null | undefined): string {
  const names = classNames ?? [];
  if (names.length === 0) return 'нет действующих классов';
  if (names.length <= 4) return names.join(', ');
  return `${names.length} ${pluralRu(names.length, ['класс', 'класса', 'классов'])}`;
}

export type StateTone = 'green' | 'blue' | 'gray';

export const STATE_BADGES: Record<NonNullable<AttestationSetting['state']>, { label: string; tone: StateTone }> = {
  ACTIVE: { label: 'Действует', tone: 'green' },
  SCHEDULED: { label: 'Запланирована', tone: 'blue' },
  ENDED: { label: 'Завершена', tone: 'gray' },
  CANCELLED: { label: 'Отменена', tone: 'gray' },
};

const PERIOD_WORDS: Record<string, string> = { QUARTER: 'четверть', TRIMESTER: 'триместр', SEMESTER: 'полугодие', CUSTOM: 'период' };

/**
 * Название периода для текста. Школа называет периоды как хочет — бывает и просто «2»; голый номер
 * дополняется типом периода из ответа: «2 четверть».
 */
export function periodTitle(period: { name?: string | null; type?: string | null } | null | undefined): string {
  const name = (period?.name ?? '').trim();
  if (!/^\d+$/.test(name)) return name;
  return `${name} ${PERIOD_WORDS[period?.type ?? 'QUARTER'] ?? 'четверть'}`;
}

/** «1 четверть» → «1 четверти»: родительный падеж названия периода для «с …», «после …». */
export function periodGenitive(name: string | null | undefined): string {
  const value = (name ?? '').trim();
  return value
    .replace(/четверть$/i, 'четверти')
    .replace(/полугодие$/i, 'полугодия')
    .replace(/триместр$/i, 'триместра');
}

/**
 * «12.01.2027» из даты сервера. В ответах дата — ISO-строка, а в снимках аудита настроек
 * (`AttestationHistoryView.before/after`) Jackson пишет `LocalDate` массивом `[2027, 1, 12]`:
 * читаются оба вида, остальное — пустая строка, а не падение окна истории.
 */
export function fullDate(value: unknown): string {
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value.map((part) => String(part));
    return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
  }
  if (typeof value !== 'string' || !value) return '';
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day.slice(0, 2)}.${month}.${year}` : value;
}

type PeriodRef = { id?: number; name?: string; startDate?: string; type?: string };

/**
 * Срок версии словами (А2, А5): «с 1 четверти», «с 1 по 2 четверть», «с 3 четверти, 12.01.2027».
 * Конец версии — начало следующей (`effectiveTo` не входит), поэтому «по» — период перед ним
 * в календаре года.
 */
export function termCaption(setting: AttestationSetting, yearPeriods: readonly PeriodRef[] = []): string {
  const from = setting.effectiveFrom;
  const start = `с ${periodGenitive(periodTitle(from))}`;
  if (setting.state === 'SCHEDULED') return `${start}, ${fullDate(from?.startDate)}`;
  if (!setting.effectiveTo) return start;
  const index = yearPeriods.findIndex((period) => period.id === setting.effectiveTo?.id);
  const last = index > 0 ? yearPeriods[index - 1] : null;
  if (!last?.name) return `${start} до ${periodGenitive(periodTitle(setting.effectiveTo))}`;
  const fromMatch = /^(\d+)\s+(.+)$/.exec(periodTitle(from));
  const lastMatch = /^(\d+)\s+(.+)$/.exec(periodTitle(last));
  if (fromMatch && lastMatch && fromMatch[2] === lastMatch[2]) {
    return fromMatch[1] === lastMatch[1] ? `${lastMatch[1]} ${lastMatch[2]}` : `с ${fromMatch[1]} по ${periodTitle(last)}`;
  }
  return `${start} по ${periodTitle(last)}`;
}

/** Порядок списка версий: действующие, запланированные, завершённые; внутри — по области и началу. */
export function sortSettings(settings: readonly AttestationSetting[]): AttestationSetting[] {
  const rank = { ACTIVE: 0, SCHEDULED: 1, ENDED: 2, CANCELLED: 3 } as const;
  return [...settings].sort((a, b) =>
    rank[a.state ?? 'ACTIVE'] - rank[b.state ?? 'ACTIVE']
    || scopeOrder(a).localeCompare(scopeOrder(b), 'ru', { numeric: true })
    || (a.effectiveFrom?.startDate ?? '').localeCompare(b.effectiveFrom?.startDate ?? ''));
}

function scopeOrder(setting: AttestationSetting): string {
  return setting.parallel ? `${setting.parallel.padStart(3, '0')}` : `${(setting.className ?? '').padStart(4, '0')}`;
}

/**
 * Сводка колонки «Аттестация» (А1) по действующим версиям предмета: соседние параллели с
 * одинаковым правилом склеиваются — «5–9 кл.: Зачёт · Полугодие · Без СОЧ». Пусто — «По умолчанию».
 */
export function subjectSummary(settings: readonly AttestationSetting[]): { scope: string; rule: string }[] {
  const active = settings.filter((setting) => setting.state === 'ACTIVE');
  const parallels = active.filter((setting) => setting.parallel)
    .sort((a, b) => Number(a.parallel) - Number(b.parallel) || (a.parallel ?? '').localeCompare(b.parallel ?? ''));
  const lines: { scope: string; rule: string }[] = [];
  let group: AttestationSetting[] = [];
  const flush = () => {
    if (group.length === 0) return;
    const first = group[0].parallel!;
    const last = group[group.length - 1].parallel!;
    lines.push({ scope: first === last ? `${first} кл.` : `${first}–${last} кл.`, rule: ruleDifference(group[0]) });
    group = [];
  };
  for (const setting of parallels) {
    const previous = group[group.length - 1];
    const consecutive = previous && Number(setting.parallel) === Number(previous.parallel) + 1
      && ruleDifference(setting) === ruleDifference(previous);
    if (!consecutive) flush();
    group.push(setting);
  }
  flush();
  active.filter((setting) => !setting.parallel)
    .sort((a, b) => (a.className ?? '').localeCompare(b.className ?? '', 'ru', { numeric: true }))
    .forEach((setting) => lines.push({ scope: setting.className ?? 'Класс', rule: ruleDifference(setting) }));
  return lines;
}

/** Параллели года из его классов — не константа: у школы бывают и 0-е, и 12-е. */
export function parallelsOf(classes: readonly { grade?: string | null }[]): string[] {
  const grades = new Set(classes.map((item) => item.grade?.trim()).filter((grade): grade is string => Boolean(grade)));
  return [...grades].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, 'ru', { numeric: true }));
}

// ---------------------------------------------------------------- форма настройки (А3)

export type ScopeKind = 'PARALLEL' | 'CLASS';

export interface AttestationForm {
  scope: ScopeKind;
  parallel: string | null;
  classId: number | null;
  resultFormat: AttestationResultFormat;
  periodicity: AttestationPeriodicity;
  sochProvided: boolean;
  /** `null` — ближайший допустимый период, его выбирает сервер. */
  effectiveFromPeriodId: number | null;
}

/** Новая настройка — по умолчанию ТЗ; «Изменить» — правило выбранной версии. */
export function initialForm(base: AttestationSetting | null, fallbackParallel: string | null): AttestationForm {
  return {
    scope: base?.classId != null ? 'CLASS' : 'PARALLEL',
    parallel: base?.parallel ?? (base?.classId != null ? null : fallbackParallel),
    classId: base?.classId ?? null,
    resultFormat: base?.resultFormat ?? DEFAULT_RULE.resultFormat,
    periodicity: base?.periodicity ?? DEFAULT_RULE.periodicity,
    sochProvided: base?.sochProvided ?? DEFAULT_RULE.sochProvided,
    effectiveFromPeriodId: null,
  };
}

/** Тело запроса; `null` — область ещё не выбрана, спрашивать сервер не о чем. */
export function toRequest(form: AttestationForm, academicYearId: number, subjectId: number): AttestationSettingRequest | null {
  const scopeReady = form.scope === 'PARALLEL' ? Boolean(form.parallel) : form.classId != null;
  if (!scopeReady) return null;
  return {
    academicYearId,
    subjectId,
    parallel: form.scope === 'PARALLEL' ? form.parallel ?? undefined : undefined,
    classId: form.scope === 'CLASS' ? form.classId ?? undefined : undefined,
    resultFormat: form.resultFormat,
    periodicity: form.periodicity,
    sochProvided: form.sochProvided,
    effectiveFromPeriodId: form.effectiveFromPeriodId ?? undefined,
  };
}

/** Вариант «Вступает в силу», который сейчас стоит в поле: выбранный или назначенный сервером. */
export function chosenOption(preview: AttestationPreview | null | undefined): EffectiveFromOption | null {
  const id = preview?.effectiveFrom?.id;
  if (id == null) return null;
  return preview?.periods?.find((option) => option.period?.id === id) ?? null;
}

/** «3 четверть (с 12.01.2027)» — подпись варианта. */
export function optionLabel(option: EffectiveFromOption): string {
  const date = fullDate(option.period?.startDate);
  return `${periodTitle(option.period)}${date ? ` (с ${date})` : ''}`;
}

/** Ближайший допустимый период — в него ведёт «Выбрать 3 четверть» (А6). */
export function earliestOption(preview: AttestationPreview | null | undefined): EffectiveFromOption | null {
  const id = preview?.earliestAllowed?.id;
  return id == null ? null : preview?.periods?.find((option) => option.period?.id === id) ?? null;
}

export type PreviewProblem =
  | { kind: 'PERIOD'; option: EffectiveFromOption }
  | { kind: 'NO_PERIOD' }
  | { kind: 'OVERLAP'; conflict: AttestationSetting }
  | { kind: 'FINALS'; count: number; classNames: string[] };

/** Почему сохранить нельзя — первым то, что исправляется в самом поле (А6 → А7 → А8). */
export function previewProblem(preview: AttestationPreview | null | undefined): PreviewProblem | null {
  if (!preview) return null;
  const option = chosenOption(preview);
  if (option && !option.available) return { kind: 'PERIOD', option };
  if (!preview.effectiveFrom) return { kind: 'NO_PERIOD' };
  const conflict = preview.conflicts?.[0];
  if (conflict) return { kind: 'OVERLAP', conflict };
  if ((preview.finalsInScope ?? 0) > 0) {
    return { kind: 'FINALS', count: preview.finalsInScope ?? 0, classNames: preview.finalsClassNames ?? [] };
  }
  return null;
}

/** Строка окна подтверждения (А4): параметр, новое значение и «было: …», если оно другое. */
export interface ChangeRow {
  key: string;
  label: string;
  value: string;
  was: string | null;
}

/**
 * Что изменится (А4). «Было» — действующая версия той же области (`endsSettingId` предпросмотра)
 * или умолчание, если её нет.
 */
export function changeRows(
  form: AttestationForm,
  scopeCaption: string,
  effectiveFrom: string,
  previous: Rule | null,
): ChangeRow[] {
  const before = previous ?? DEFAULT_RULE;
  const was = (now: string, then: string) => (now === then ? null : then);
  const soch = (value: boolean | undefined) => (value === false ? 'не предусмотрен' : 'предусмотрен');
  return [
    { key: 'scope', label: 'Кому применить', value: scopeCaption, was: null },
    {
      key: 'format', label: 'Итоговая оценка', value: RESULT_FORMAT_LABELS[form.resultFormat],
      was: was(RESULT_FORMAT_LABELS[form.resultFormat], RESULT_FORMAT_LABELS[before.resultFormat ?? 'NUMERIC']),
    },
    {
      key: 'period', label: 'Период аттестации', value: PERIODICITY_LABELS[form.periodicity],
      was: was(PERIODICITY_LABELS[form.periodicity], PERIODICITY_LABELS[before.periodicity ?? 'QUARTER']),
    },
    {
      key: 'soch', label: 'СОЧ', value: form.sochProvided ? 'Предусмотрен' : 'Не предусмотрен',
      was: was(soch(form.sochProvided), soch(before.sochProvided)),
    },
    { key: 'from', label: 'Вступает в силу', value: effectiveFrom, was: null },
  ];
}

/** Период перед `periodId` в списке вариантов — «закончится после 2 четверти» (А3). */
export function periodBefore(preview: AttestationPreview | null | undefined, periodId: number | null | undefined): string | null {
  const periods = preview?.periods ?? [];
  const index = periods.findIndex((option) => option.period?.id === periodId);
  return index > 0 ? periodTitle(periods[index - 1].period) || null : null;
}
