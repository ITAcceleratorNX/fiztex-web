import type {
  CalendarEvent,
  CalendarEventTarget,
} from '@/lib/scheduleSettingsTypes';

/** Format LocalDate string YYYY-MM-DD for display without TZ conversion. */
export function formatLocalDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function formatEventDateRange(dateFrom: string, dateTo: string): string {
  if (dateFrom === dateTo) return formatLocalDate(dateFrom);
  const from = formatLocalDate(dateFrom);
  const to = formatLocalDate(dateTo);
  // Short form when same year: 30.12–08.01.2026 vs 30.12.2025–08.01.2026
  const fy = dateFrom.slice(0, 4);
  const ty = dateTo.slice(0, 4);
  if (fy === ty) {
    return `${dateFrom.slice(8, 10)}.${dateFrom.slice(5, 7)}–${dateTo.slice(8, 10)}.${dateTo.slice(5, 7)}.${fy}`;
  }
  return `${from}–${to}`;
}

export function formatEventScope(event: CalendarEvent): string {
  if (event.scope === 'SCHOOL') return 'Вся школа';
  if (event.scope === 'GRADES') {
    const grades = event.targets
      .filter((t) => t.targetType === 'GRADE' && t.grade)
      .map((t) => t.grade!)
      .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
    return grades.length ? `Параллели: ${grades.join(', ')}` : 'Параллели';
  }
  const names = event.targets
    .filter((t) => t.targetType === 'CLASS')
    .map((t) => t.className ?? String(t.classId))
    .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
  return names.length ? `Классы: ${names.join(', ')}` : 'Классы';
}

const MONTH_TITLES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

/** Group by month of dateFrom (YYYY-MM), preserve chronological order. */
export function groupEventsByMonth(events: CalendarEvent[]): Array<{
  key: string;
  title: string;
  events: CalendarEvent[];
}> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = event.dateFrom.slice(0, 7);
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, group]) => {
      const year = key.slice(0, 4);
      const monthIdx = Number(key.slice(5, 7)) - 1;
      const month = MONTH_TITLES[monthIdx] ?? key;
      return {
        key,
        title: `${month} ${year}`,
        events: [...group].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)),
      };
    });
}

export function targetsFromEvent(targets: CalendarEventTarget[]): {
  grades: string[];
  classIds: number[];
} {
  const grades: string[] = [];
  const classIds: number[] = [];
  for (const t of targets) {
    if (t.targetType === 'GRADE' && t.grade) grades.push(t.grade);
    if (t.targetType === 'CLASS' && t.classId != null) classIds.push(t.classId);
  }
  return { grades, classIds };
}
