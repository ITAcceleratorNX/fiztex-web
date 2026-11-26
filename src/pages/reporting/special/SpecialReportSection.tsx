import { useState } from 'react';
import { ClipboardList, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import type { ReportOwner } from '@/hooks/reportingQueries';
import {
  downloadSpecialReport,
  EXPORT_FORMATS,
  useSpecialReport,
  type AssessmentAnalysisReport,
  type PerformanceFormReport,
  type SpecialExportFormat,
  type SpecialForm,
  type SpecialReportFilter,
} from '@/hooks/specialReportQueries';
import { ApiError } from '@/lib/api';
import { FORM_TITLES, specialFileStem } from '@/lib/specialReportModel';
import { AssessmentAnalysisPanel } from './AssessmentAnalysisPanel';
import { PerformancePanel } from './PerformancePanel';

const FORMAT_LABELS: Record<SpecialExportFormat, string> = { XLSX: 'Excel', DOCX: 'Word', PDF: 'PDF' };

/**
 * Специальная форма в разделе «Отчётность»: «Анализ СОР и СОЧ», «Успеваемость класса» или
 * «Учителю по предмету». Год, период, класс, предмет и учитель — фильтры страницы-хозяина;
 * подгруппа — свой фильтр формы, варианты приходят в ответе (`subgroupOptions`), поэтому
 * учителю не нужен админский справочник подгрупп.
 *
 * <p>`filter = null` с `blocked` — форме не хватает обязательного выбора (учитель у
 * «Учителю по предмету» администратора): запрос не уходит, экран говорит, что выбрать.
 */
export function SpecialReportSection({ owner, form, filter, blocked, fileParts, onSubgroup }: {
  owner: ReportOwner;
  form: SpecialForm;
  filter: SpecialReportFilter | null;
  blocked?: { title: string; description: string };
  /** Имена фильтров для имени файла: год, период, класс, предмет. */
  fileParts: Array<string | null | undefined>;
  onSubgroup: (subgroupId: number | null) => void;
}) {
  const query = useSpecialReport(owner, form, filter);
  const report = query.isError ? undefined : query.data;
  const subgroupOptions = report?.subgroupOptions ?? [];

  if (filter == null) {
    return (
      <section className="rounded-2xl border border-line bg-surface shadow-soft">
        <EmptyBlock icon={<ClipboardList className="h-7 w-7" />}
          title={blocked?.title ?? 'Выберите фильтры'} description={blocked?.description} />
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {filter.classId != null && subgroupOptions.length > 0 && (
            <FilterSelect label="Подгруппа" className="w-64" value={filter.subgroupId == null ? '' : String(filter.subgroupId)}
              onChange={(value) => onSubgroup(value ? Number(value) : null)}>
              <option value="">Весь класс</option>
              {subgroupOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </FilterSelect>
          )}
        </div>
        <ExportButtons owner={owner} form={form} filter={filter} fileStem={specialFileStem(form, fileParts)}
          disabled={query.isPending || query.isError || report?.demo === true} />
      </div>

      {query.isPending ? <LoadingBlock label={`Загрузка: ${FORM_TITLES[form]}…`} /> : query.isError ? (
        <ErrorBlock message={errorText(query.error, form)} onRetry={() => void query.refetch()} />
      ) : form === 'assessment' ? (
        <AssessmentAnalysisPanel report={report as AssessmentAnalysisReport} />
      ) : (
        <PerformancePanel report={report as PerformanceFormReport} />
      )}
    </div>
  );
}

function errorText(error: unknown, form: SpecialForm): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Нет доступа к этим данным.';
    if (error.status === 400 && error.message) return error.message;
  }
  return `Не удалось загрузить форму «${FORM_TITLES[form]}».`;
}

function ExportButtons({ owner, form, filter, fileStem, disabled }: {
  owner: ReportOwner;
  form: SpecialForm;
  filter: SpecialReportFilter;
  fileStem: string;
  disabled: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<SpecialExportFormat | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Выгрузка формы">
      {EXPORT_FORMATS[form].map((format) => (
        <Button key={format} variant="secondary" size="sm" icon={<Download className="h-4 w-4" aria-hidden="true" />}
          loading={busy === format} disabled={disabled || busy != null}
          onClick={async () => {
            setBusy(format);
            try {
              await downloadSpecialReport(owner, form, filter, format, fileStem);
            } catch (error) {
              toast.error(error instanceof ApiError && error.status === 403
                ? 'Нет доступа к этим данным.' : 'Не удалось выгрузить форму. Попробуйте ещё раз.');
            } finally {
              setBusy(null);
            }
          }}>
          {FORMAT_LABELS[format]}
        </Button>
      ))}
    </div>
  );
}
