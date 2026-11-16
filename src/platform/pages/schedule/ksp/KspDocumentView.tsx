import type { ReactNode } from 'react';
import { Download, Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { KspDocument, KspExportFormat } from '@/lib/kspApi';
import { EXPORT_LABEL, dateLabel, dateTimeLabel } from '@/lib/kspModel';
import { cx } from '@/lib/format';

/**
 * Сохранённый КСП в том порядке, в каком он ляжет в файл (Figma С1 2212:8655): организация,
 * название формы, шапка приложения №4 и «Ход урока» из пяти колонок. Пустое значение — пустая
 * ячейка или «—» у счётчиков, ноль не подставляется.
 */
export function KspDocumentView({ document }: { document: KspDocument }) {
  const count = (value: number | undefined) => (value == null ? '—' : String(value));
  return (
    <article className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-8">
      <header className="flex flex-col items-center gap-1.5 text-center">
        {document.organizationName && <p className="text-sm font-medium text-ink">{document.organizationName}</p>}
        <h2 className="text-base font-bold text-ink">Краткосрочный (поурочный) план</h2>
      </header>

      <KspHeaderTable rows={[
        { label: 'Раздел', value: document.section },
        { label: 'ФИО педагога', value: document.teacherName },
        { label: 'Дата', value: dateLabel(document.lessonDate) },
        {
          label: 'Класс',
          value: [
            document.className,
            `Количество присутствующих: ${count(document.presentCount)}`,
            `отсутствующих: ${count(document.absentCount)}`,
          ].filter(Boolean).join(' · '),
        },
        { label: 'Тема урока', value: document.topic },
        { label: 'Цели обучения в соответствии с учебной программой', value: document.learningObjectives },
        { label: 'Цели урока', value: document.lessonObjectives },
      ]} />

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-bold text-ink">Ход урока</h3>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <StagesHead grid="grid-cols-ksp-stages" />
          {(document.stages ?? []).map((stage, index) => (
            <div key={index} className="grid grid-cols-ksp-stages gap-3 border-t border-slate-200 px-2 py-3">
              <div className="flex flex-col gap-1">
                <p className="whitespace-pre-line text-13 font-semibold text-ink">{stage.stage}</p>
                {stage.durationMinutes != null && <p className="text-xs text-planning-muted">{stage.durationMinutes} мин</p>}
              </div>
              <Cell>{stage.teacherActions}</Cell>
              <Cell>{stage.studentActions}</Cell>
              <Cell>{stage.assessment}</Cell>
              <Cell>{stage.resources}</Cell>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <p className="min-w-0 whitespace-pre-line break-words text-13 leading-5 text-planning-ink">{children}</p>;
}

/** Шапка таблицы этапов — общая для просмотра и редактора (Figma 2212:8086 / 2212:8094). */
export function StagesHead({ grid, editable = false, className }: { grid: string; editable?: boolean; className?: string }) {
  const titles = ['Этап урока / время', 'Действия педагога', 'Действия ученика', 'Оценивание', 'Ресурсы'];
  return (
    <div className={cx('grid gap-3 bg-slate-50 px-2 py-2.5 text-11 font-bold uppercase text-slate-400', grid, className)}>
      {editable && <span aria-hidden="true" />}
      {titles.map((title) => <span key={title}>{title}</span>)}
      {editable && <span aria-hidden="true" />}
    </div>
  );
}

/** Шапка приложения №4 в просмотре: метка слева на сером, значение справа. */
function KspHeaderTable({ rows }: { rows: { label: string; value: string | undefined }[] }) {
  return (
    <dl className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-ksp-header">
          <dt className="bg-slate-50 px-4 py-3.5 text-13 font-semibold text-slate-600">{row.label}</dt>
          <dd className="min-w-0 whitespace-pre-line break-words px-4 py-3.5 text-sm text-planning-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * «КСП сохранён за уроком» с действиями (Figma С1, С2, Н2, Н4). Файл — всегда последняя
 * сохранённая версия; ошибка выгрузки — под панелью, у кнопки, а кнопка становится «Повторить».
 */
export function KspSavedBar({
  updatedAt,
  canEdit,
  canRegenerate,
  busy,
  exporting,
  exportError,
  onRegenerate,
  onEdit,
  onExport,
}: {
  updatedAt: string | undefined;
  canEdit: boolean;
  canRegenerate: boolean;
  /** Идёт повторная генерация (Н2): править и запускать ещё одну нельзя, скачивать — можно. */
  busy: boolean;
  exporting: KspExportFormat | null;
  exportError: KspExportFormat | null;
  onRegenerate: () => void;
  onEdit: () => void;
  onExport: (format: KspExportFormat) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-ink">КСП сохранён за уроком</p>
          <p className="text-13 text-planning-muted">
            {updatedAt ? `${dateTimeLabel(updatedAt)} · ` : ''}скачивается последняя сохранённая версия
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <Button variant="ghost" disabled={busy || !canRegenerate} onClick={onRegenerate}
                icon={<RefreshCw className="size-4" aria-hidden="true" />}>
                Сгенерировать заново
              </Button>
              <Button variant="secondary" disabled={busy} onClick={onEdit}
                icon={<Pencil className="size-4" aria-hidden="true" />}>
                Редактировать
              </Button>
            </>
          )}
          {(['docx', 'pdf'] as const).map((format) => (
            <Button key={format} variant="secondary" loading={exporting === format} disabled={exporting != null}
              onClick={() => onExport(format)} icon={<Download className="size-4" aria-hidden="true" />}>
              {exportError === format ? `Повторить ${EXPORT_LABEL[format]}` : `Скачать ${EXPORT_LABEL[format]}`}
            </Button>
          ))}
        </div>
      </section>
      {exportError && (
        <p role="alert" className="text-13 font-medium text-red-600">
          Не удалось подготовить файл {EXPORT_LABEL[exportError]}. Сохранённый КСП не изменён, повторите скачивание.
        </p>
      )}
    </div>
  );
}
