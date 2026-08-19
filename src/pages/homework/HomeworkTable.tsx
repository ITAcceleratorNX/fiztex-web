import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { HomeworkStatusChip } from '@/components/ui/HomeworkStatusChip';
import { cx } from '@/lib/format';
import type { Homework } from '@/lib/homeworkApi';

const COLUMNS = [
  { key: 'title', label: 'Название', className: 'w-auto' },
  { key: 'subject', label: 'Предмет', className: 'w-40' },
  { key: 'class', label: 'Класс', className: 'w-24' },
  { key: 'lesson', label: 'Привязка', className: 'w-32' },
  { key: 'due', label: 'Дедлайн', className: 'w-28' },
  { key: 'status', label: 'Статус', className: 'w-36' },
  { key: 'progress', label: 'Прогресс', className: 'w-24' },
] as const;

const HEAD_CELL = 'px-5 py-3 text-left text-10 font-medium uppercase tracking-wide text-subtle';

/**
 * Таблица заданий, сгруппированная по классу (Figma 856:20520).
 *
 * Группы строятся по тому порядку, в котором задания пришли с сервера, а не сортируются
 * заново: порядок — часть контракта списка (ТЗ §7), и вторая сортировка на клиенте
 * рассыпала бы постраничную выдачу.
 */
export function HomeworkTable({ rows }: { rows: Homework[] }) {
  const navigate = useNavigate();
  const groups = groupByClass(rows);

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full border-collapse">
        <thead className="border-b border-line bg-neutral-bg/40">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className={cx(HEAD_CELL, column.className)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.className}>
              <tr className="bg-neutral-bg/40">
                <th
                  scope="colgroup"
                  colSpan={COLUMNS.length}
                  className="px-5 py-2 text-left text-13 font-semibold text-ink"
                >
                  {group.className}
                </th>
              </tr>
              {group.rows.map((row) => (
                <HomeworkRow
                  key={row.id}
                  row={row}
                  onOpen={() => navigate(`/homework/${row.id}`)}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HomeworkRow({ row, onOpen }: { row: Homework; onOpen: () => void }) {
  return (
    <tr
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Открыть задание «${row.title ?? ''}»`}
      className="cursor-pointer border-b border-line last:border-b-0 transition hover:bg-neutral-bg/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/50"
    >
      <td className="px-5 py-3 text-sm font-medium text-ink">{row.title}</td>
      <td className="px-5 py-3 text-13 text-muted">{row.subjectName}</td>
      <td className="px-5 py-3 text-13 text-muted">{classLabel(row)}</td>
      <td className="px-5 py-3">
        {row.lesson ? (
          <span className="inline-flex items-center rounded bg-neutral-bg px-2 py-0.5 text-11 text-neutral-fg">
            {lessonLabel(row)}
          </span>
        ) : (
          <span className="text-13 text-subtle">—</span>
        )}
      </td>
      <td className="px-5 py-3 text-13 text-muted">{dueLabel(row)}</td>
      <td className="px-5 py-3">
        <HomeworkStatusChip status={row.status} overdue={row.overdue} />
      </td>
      <td className="px-5 py-3 text-13 text-muted">{progressLabel(row)}</td>
    </tr>
  );
}

interface ClassGroup {
  className: string;
  rows: Homework[];
}

function groupByClass(rows: Homework[]): ClassGroup[] {
  const groups: ClassGroup[] = [];
  for (const row of rows) {
    const name = row.className ?? '—';
    const last = groups.at(-1);
    if (last && last.className === name) {
      last.rows.push(row);
    } else {
      groups.push({ className: name, rows: [row] });
    }
  }
  return groups;
}

/** Подгруппа дописывается к классу: «7А · Подгруппа 1» — получатели у них разные. */
function classLabel(row: Homework): string {
  const name = row.className ?? '—';
  return row.subgroupName ? `${name} · ${row.subgroupName}` : name;
}

/** Привязка к уроку: предмет задания и дата урока — как в макете «Мат · 14.10». */
function lessonLabel(row: Homework): string {
  const date = row.lesson?.lessonDate;
  const day = date ? formatDayMonth(date) : '';
  const subject = shortSubject(row.subjectName);
  return day ? `${subject} · ${day}` : subject;
}

/**
 * Короткое имя предмета для узкой колонки. Своего сокращения в модели нет — предметы
 * заводятся полным названием, — поэтому режем по первому слову и не выдумываем словарь
 * аббревиатур: «Мат.» вместо «Математика» и так узнаётся, а неверное сокращение — нет.
 */
function shortSubject(name: string | undefined): string {
  if (!name) return '—';
  const first = name.split(/[\s-]+/)[0];
  return first.length > 8 ? `${first.slice(0, 6)}.` : first;
}

function formatDayMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** «Без срока» — полноправный вариант, а не отсутствие данных (ТЗ §4.2). */
function dueLabel(row: Homework): string {
  if (row.dueType === 'NONE' || !row.dueAt) return 'Без срока';
  return new Date(row.dueAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/**
 * «Сдали / всего получателей» (ТЗ §4.2). У черновика получателей ещё нет — там прочерк,
 * а не «0 / 0»: ноль из нуля читается как «никто не сдал», хотя сдавать пока нечего.
 */
function progressLabel(row: Homework): string {
  const total = row.progress?.total ?? 0;
  if (row.status === 'DRAFT' || total === 0) return '—';
  return `${row.progress?.submitted ?? 0} / ${total}`;
}

/** Скелет строки таблицы (Figma 856:20805): та же сетка колонок, чтобы шапка не дёргалась. */
export function HomeworkTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full border-collapse">
        <thead className="border-b border-line bg-neutral-bg/40">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className={cx(HEAD_CELL, column.className)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, index) => (
            <tr key={index} className="border-b border-line last:border-b-0">
              {COLUMNS.map((column) => (
                <td key={column.key} className="px-5 py-3">
                  <span
                    className="block h-3.5 animate-pulse rounded bg-neutral-bg"
                    style={{ width: column.key === 'title' ? `${40 + ((index * 7) % 30)}%` : '70%' }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sr-only" role="status">
        Загрузка заданий
      </span>
    </div>
  );
}
