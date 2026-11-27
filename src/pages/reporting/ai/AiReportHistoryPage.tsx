import { useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { AlertTriangle, History } from 'lucide-react';
import { DataTable, TableCell, TableHead } from '@/components/ui/DataTable';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useAiReportContext, useAiReports, type AiReportListFilter, type AiReportReader } from '@/hooks/aiReportQueries';
import { useAdminClassStudents, useAdminHomeroomTeachers } from '@/hooks/queries';
import { useReportClasses, useReportPeriods, useReportSubjects, useReportYears } from '@/hooks/reportingQueries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { TYPE_LABELS, formatDate, objectText, reportStatus, subjectText, type AiReportSummary } from '@/lib/aiReportModel';
import { ROUTES } from '@/lib/routes';
import { AiReportDrawer } from './AiReportDrawer';
import { StatusBadge } from './AiReportParts';

const PAGE_SIZE = 20;
const collator = new Intl.Collator('ru-RU', { numeric: true });

export type AiHistoryScope = 'teacher' | 'homeroom' | 'admin';

const COPY: Record<AiHistoryScope, { title: string; description: string; back: string; backTo: string }> = {
  teacher: {
    title: 'История AI-отчётов',
    description: 'Черновики и утверждённые сводки по вашим классам и предметам',
    back: 'К отчётности',
    backTo: ROUTES.myReporting,
  },
  homeroom: {
    title: 'История AI-отчётов',
    description: 'Сводки классного руководителя по ученикам и классу — по всем предметам',
    back: 'К моему классу',
    backTo: `${ROUTES.myClass}?tab=report`,
  },
  admin: {
    title: 'AI-отчёты учителей',
    description: 'Утверждённые и опубликованные сводки учителей — только просмотр',
    back: 'К отчётности школы',
    backTo: ROUTES.reporting,
  },
};

const STATES = [
  { value: 'DRAFT', label: 'Черновик' },
  { value: 'APPROVED', label: 'Утверждён' },
  { value: 'PUBLISHED', label: 'Опубликован' },
  { value: 'WITHDRAWN', label: 'Снят' },
  { value: 'FAILED', label: 'Не сформирован' },
];

function idParam(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * «История AI-отчётов» (Figma В1, В5, А2) — вложенная страница отчётности. «← К отчётности»
 * возвращает с прежними фильтрами (их адрес приходит в `state.back`), свои фильтры живут в
 * адресе этой страницы, отчёт открывается шторкой по `?report=`. Фильтрует сервер.
 */
export function AiReportHistoryPage({ scope }: { scope: AiHistoryScope }) {
  const copy = COPY[scope];
  useDocumentTitle(copy.title);
  const reader: AiReportReader = scope === 'admin' ? 'admin' : 'teacher';
  const location = useLocation();
  const back = (location.state as { back?: string } | null)?.back ?? copy.backTo;
  const [params, setParams] = useSearchParams();
  const requestedYear = idParam(params.get('year'));

  // Учителю справочники — из своего `/context`, администрации — из каталогов школы.
  const context = useAiReportContext(requestedYear, scope !== 'admin');
  const years = useReportYears();
  const adminYearId = requestedYear ?? (years.data?.content ?? []).find((item) => item.status === 'ACTIVE')?.id
    ?? years.data?.content?.[0]?.id ?? null;
  const adminPeriods = useReportPeriods(scope === 'admin' ? adminYearId : null);
  const adminClasses = useReportClasses(scope === 'admin' ? adminYearId : null);
  const adminSubjects = useReportSubjects();
  const teachers = useAdminHomeroomTeachers(scope === 'admin');

  const yearId = scope === 'admin' ? adminYearId : context.data?.selectedYearId ?? null;
  const periods = useMemo(() => {
    const source = scope === 'admin' ? adminPeriods.data ?? [] : context.data?.periods ?? [];
    return [...source].map((item) => ({ id: item.id!, name: item.name ?? '', startDate: item.startDate, endDate: item.endDate }))
      .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  }, [adminPeriods.data, context.data?.periods, scope]);

  const classes = useMemo(() => {
    if (scope === 'admin') {
      return (adminClasses.data?.content ?? []).map((item) => ({ id: item.id!, name: item.name ?? '' }))
        .sort((a, b) => collator.compare(a.name, b.name));
    }
    if (scope === 'homeroom') return (context.data?.homeroomClasses ?? []).map((item) => ({ id: item.id!, name: item.name ?? '' }));
    const unique = new Map<number, string>();
    (context.data?.subjectPairs ?? []).forEach((pair) => pair.schoolClass?.id != null && unique.set(pair.schoolClass.id, pair.schoolClass.name ?? ''));
    return [...unique.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => collator.compare(a.name, b.name));
  }, [adminClasses.data, context.data, scope]);

  const subjects = useMemo(() => {
    if (scope === 'admin') {
      return (adminSubjects.data?.content ?? []).map((item) => ({ id: item.id!, name: item.name ?? '' }))
        .sort((a, b) => collator.compare(a.name, b.name));
    }
    const unique = new Map<number, string>();
    (context.data?.subjectPairs ?? []).forEach((pair) => pair.subject?.id != null && unique.set(pair.subject.id, pair.subject.name ?? ''));
    return [...unique.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => collator.compare(a.name, b.name));
  }, [adminSubjects.data, context.data, scope]);

  const periodId = idParam(params.get('period'));
  const period = periods.find((item) => item.id === periodId) ?? null;
  const classId = scope === 'homeroom' ? classes[0]?.id ?? null : idParam(params.get('classId'));
  const subjectId = scope === 'homeroom' ? null : idParam(params.get('subjectId'));
  const studentId = scope === 'admin' && classId != null ? idParam(params.get('student')) : null;
  const authorId = scope === 'admin' ? idParam(params.get('author')) : null;
  const type = params.get('type');
  const state = scope === 'admin' && params.get('state') === 'DRAFT' ? null : params.get('state');
  const page = Math.max(0, Number(params.get('page')) || 0);
  const reportId = idParam(params.get('report'));
  const students = useAdminClassStudents(scope === 'admin' ? classId : null);

  const ready = scope === 'admin' ? yearId != null : context.isSuccess && (scope !== 'homeroom' || classId != null);
  const filter: AiReportListFilter | null = !ready ? null : {
    academicYearId: yearId,
    owner: scope === 'teacher' ? 'SUBJECT_TEACHER' : scope === 'homeroom' ? 'HOMEROOM' : null,
    classId,
    subjectId,
    studentProfileId: studentId,
    authorTeacherProfileId: authorId,
    type: (type as AiReportListFilter['type']) ?? null,
    state,
    from: period?.startDate ?? null,
    to: period?.endDate ?? null,
    page,
    size: PAGE_SIZE,
  };
  const list = useAiReports(reader, filter);

  function update(changes: Record<string, string | null>, keepPage = false) {
    const next = new URLSearchParams(params);
    for (const [name, value] of Object.entries(changes)) {
      if (value == null || value === '') next.delete(name);
      else next.set(name, value);
    }
    if (!keepPage) next.delete('page');
    setParams(next);
  }

  const items = list.data?.items ?? [];
  const total = list.data?.totalElements ?? 0;
  const loadingCatalog = scope === 'admin' ? years.isPending : context.isPending;

  return (
    <div className="space-y-5">
      <PageHeader title={copy.title} description={copy.description} back={{ label: copy.back, to: back, appearance: 'link' }} />

      <div className="flex flex-wrap gap-3">
        <FilterSelect label="Период" value={period ? String(period.id) : ''} onChange={(value) => update({ period: value || null })}>
          <option value="">Весь учебный год</option>
          {periods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </FilterSelect>
        {scope !== 'homeroom' && (
          <FilterSelect label="Класс" value={classId == null ? '' : String(classId)} onChange={(value) => update({ classId: value || null, student: null })}>
            <option value="">{scope === 'admin' ? 'Все классы' : 'Все мои классы'}</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </FilterSelect>
        )}
        {scope === 'admin' && (
          <FilterSelect label="Ученик" value={studentId == null ? '' : String(studentId)} disabled={classId == null}
            onChange={(value) => update({ student: value || null })}>
            <option value="">{classId == null ? 'Сначала класс' : 'Все ученики'}</option>
            {(students.data ?? []).map((item) => <option key={item.id} value={item.id}>{`${item.lastName ?? ''} ${item.firstName ?? ''}`.trim()}</option>)}
          </FilterSelect>
        )}
        {scope !== 'homeroom' && (
          <FilterSelect label="Предмет" value={subjectId == null ? '' : String(subjectId)} onChange={(value) => update({ subjectId: value || null })}>
            <option value="">Все предметы</option>
            {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </FilterSelect>
        )}
        {scope === 'admin' ? (
          <FilterSelect label="Автор" value={authorId == null ? '' : String(authorId)} onChange={(value) => update({ author: value || null })}>
            <option value="">Все учителя</option>
            {(teachers.data ?? []).map((item) => <option key={item.id} value={item.id}>{`${item.lastName ?? ''} ${item.firstName ?? ''}`.trim()}</option>)}
          </FilterSelect>
        ) : (
          <FilterSelect label="Тип" value={type ?? ''} onChange={(value) => update({ type: value || null })}>
            <option value="">Все типы</option>
            {(scope === 'homeroom' ? (['STUDENT', 'CLASS'] as const) : (['STUDENT', 'CLASS', 'CLASSES'] as const))
              .map((item) => <option key={item} value={item}>{TYPE_LABELS[item]}</option>)}
          </FilterSelect>
        )}
        <FilterSelect label="Статус" value={state ?? ''} onChange={(value) => update({ state: value || null })}>
          <option value="">Все статусы</option>
          {STATES.filter((item) => scope !== 'admin' || item.value === 'APPROVED' || item.value === 'PUBLISHED' || item.value === 'WITHDRAWN')
            .map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </FilterSelect>
      </div>

      {loadingCatalog || list.isPending ? <LoadingBlock label="Загрузка AI-отчётов…" /> : list.isError ? (
        <ErrorBlock message="Не удалось загрузить AI-отчёты." onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyBlock icon={<History className="h-7 w-7" />} title="AI-отчётов пока нет"
          description={scope === 'admin'
            ? 'Здесь появятся сводки, которые учителя проверили и утвердили.'
            : 'Сформируйте AI-сводку в отчётности — черновик и все версии появятся здесь.'} />
      ) : (
        <>
          <DataTable label={copy.title} appearance="registry">
            <thead>
              <tr>
                <TableHead>Тип</TableHead>
                <TableHead>Ученик / класс</TableHead>
                <TableHead>Предмет</TableHead>
                <TableHead>Период</TableHead>
                <TableHead>Автор</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Статус</TableHead>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => <HistoryRow key={item.id} item={item} selected={item.id === reportId}
                onOpen={() => update({ report: String(item.id) }, true)} />)}
            </tbody>
          </DataTable>
          {total > PAGE_SIZE && (
            <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} totalElements={total} pageSize={PAGE_SIZE}
              itemForms={['отчёт', 'отчёта', 'отчётов']} onPageChange={(next) => update({ page: String(next) }, true)} />
          )}
        </>
      )}

      {reportId != null && (
        <AiReportDrawer reader={reader} target={{ kind: 'report', reportId }} onClose={() => update({ report: null }, true)} />
      )}
    </div>
  );
}

function HistoryRow({ item, selected, onOpen }: { item: AiReportSummary; selected: boolean; onOpen: () => void }) {
  const status = reportStatus(item);
  return (
    <tr className={selected ? 'bg-info-bg' : 'cursor-pointer hover:bg-planning-canvas'} onClick={onOpen}>
      <TableCell>{TYPE_LABELS[item.type as keyof typeof TYPE_LABELS] ?? item.type}</TableCell>
      <TableCell>
        <button type="button" className="text-left font-semibold text-navy-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
          onClick={(event) => { event.stopPropagation(); onOpen(); }}>{objectText(item)}</button>
      </TableCell>
      <TableCell>{subjectText(item)}</TableCell>
      <TableCell>{item.period?.label ?? '—'}</TableCell>
      <TableCell>{item.author?.name ?? '—'}{item.owner === 'HOMEROOM' ? ' · кл. рук.' : ''}</TableCell>
      <TableCell>{formatDate(item.updatedAt ?? item.createdAt)}</TableCell>
      <TableCell>
        <StatusBadge status={status} />
        {item.state === 'FAILED' && <span className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="size-3" aria-hidden="true" />Повторите генерацию</span>}
      </TableCell>
    </tr>
  );
}
