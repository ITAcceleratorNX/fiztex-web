import { useSearchParams } from 'react-router-dom';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { useMyClassSubjects } from '@/hooks/queries';
import type { Schema } from '@/lib/apiSchemas';
import { defaultSubjectId, periodLabel } from '@/lib/myClassGradesModel';

type Period = Schema<'MyClassContextPeriodView'>;
type Subject = Schema<'MyClassSubjectView'>;

/**
 * Предмет вкладок «Оценки» и «Посещаемость»: один параметр `subjectId` в адресе, поэтому
 * переход между вкладками сохраняет выбор. Исправлять адрес (`replace`) каждая вкладка
 * будет сама, одной правкой вместе со своими параметрами, — два `replace` подряд затирали
 * бы друг друга.
 */
export function useMyClassSubject(classId: number, periodId: number | null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMyClassSubjects(classId, periodId);
  const subjects = query.data?.items ?? [];
  const requestedSubjectId = Number(searchParams.get('subjectId'));
  const subjectId = subjects.find((subject) => subject.subjectId === requestedSubjectId)?.subjectId
    ?? defaultSubjectId(subjects);

  function selectSubject(nextId: string) {
    const next = new URLSearchParams(searchParams);
    next.set('subjectId', nextId);
    setSearchParams(next);
  }

  /** Предмет из адреса, которого у класса нет за этот период, не должен молча жить в ссылке. */
  function correctSubject(next: URLSearchParams) {
    if (!query.data || !next.has('subjectId') || requestedSubjectId === subjectId) return;
    if (subjectId == null) next.delete('subjectId');
    else next.set('subjectId', String(subjectId));
  }

  return { query, subjects, subjectId, selectSubject, correctSubject };
}

export function SubjectFilter({
  subjects,
  subjectId,
  onChange,
}: {
  subjects: Subject[];
  subjectId: number | null;
  onChange: (subjectId: string) => void;
}) {
  return (
    <FilterSelect
      label="Предмет"
      className="w-60"
      value={subjectId == null ? '' : String(subjectId)}
      disabled={subjects.length === 0}
      onChange={onChange}
    >
      {subjects.map((subject) => (
        <option key={subject.subjectId} value={subject.subjectId}>{subject.subjectName}</option>
      ))}
    </FilterSelect>
  );
}

export function PeriodFilter({
  periods,
  periodId,
  onChange,
}: {
  periods: Period[];
  periodId: number | null;
  onChange: (periodId: string) => void;
}) {
  return (
    <FilterSelect
      label="Период"
      className="w-60"
      value={periodId == null ? '' : String(periodId)}
      disabled={periods.length === 0}
      onChange={onChange}
    >
      {periods.filter((item) => item.id != null).map((item) => (
        <option key={item.id} value={item.id}>{periodLabel(item)}</option>
      ))}
    </FilterSelect>
  );
}
