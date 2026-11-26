import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { ErrorBlock, LoadingBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { request, pageQuery } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

const KINDS = {
  ASSESSMENT: 'Анализ СОР и СОЧ',
  CLASS_PERFORMANCE: 'Успеваемость класса',
  TEACHER_PERFORMANCE: 'Учителю по предмету',
} as const;

type Kind = keyof typeof KINDS;
type Grant = Required<Schema<'SpecialReportGrantView'>>;

export function ReportGrantsModal({ yearId, yearName, classes, onClose }: {
  yearId: number;
  yearName: string;
  classes: Array<{ id?: number; name?: string }>;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const toast = useToast();
  const [teacherId, setTeacher] = useState('');
  const [classId, setClass] = useState('');
  const [kind, setKind] = useState<Kind>('ASSESSMENT');
  const teachers = useQuery({
    queryKey: ['special-report-grants', 'teachers'],
    queryFn: async ({ signal }) => {
      const result: Schema<'TeacherProfileView'>[] = [];
      for (let page = 0; page < 100; page++) {
        const response = await request<Schema<'PageTeacherProfileView'>>(`/admin/teachers${pageQuery({ page, size: 100 })}`, { signal });
        result.push(...(response.content ?? []));
        if (response.last || (response.content?.length ?? 0) < 100) return result;
      }
      throw new Error('Слишком много учителей для списка');
    },
  });
  const grants = useQuery({
    queryKey: ['special-report-grants', 'list'],
    queryFn: ({ signal }) => request<Grant[]>('/admin/academic-reports/grants', { signal }),
    staleTime: 0,
  });
  const mutation = useMutation({
    mutationFn: (id: number | null) => id == null
      ? request('/admin/academic-reports/grants', { method: 'POST', body: {
        teacherProfileId: Number(teacherId), academicYearId: yearId, classId: Number(classId), reportKind: kind,
      } })
      : request(`/admin/academic-reports/grants/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['special-report-grants', 'list'] });
      await client.invalidateQueries({ queryKey: ['academic-reports', 'teacher', 'context'] });
      await client.invalidateQueries({ queryKey: ['special-reports'] });
      toast.success('Права обновлены');
    },
    onError: () => toast.error('Не удалось изменить права. Обновите список и попробуйте снова.'),
  });
  const teacherName = (id: number) => {
    const teacher = teachers.data?.find(item => item.id === id);
    return teacher ? [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ') : `Учитель №${id}`;
  };
  return (
    <Modal open onClose={onClose} title="Доступ к учебной аналитике" subtitle={yearName} size="xl">
      <div className="space-y-5">
        <p className="text-sm text-slate-600">Разрешение открывает только выбранный отчёт по классу за этот учебный год.
          Оно не разрешает редактировать оценки, открывать чужие журналы или сохранять педагогический анализ.</p>
        {teachers.isError || grants.isError ? <ErrorBlock message="Не удалось загрузить права доступа."
          onRetry={() => { void teachers.refetch(); void grants.refetch(); }} />
          : teachers.isPending || grants.isPending ? <LoadingBlock /> : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <FilterSelect label="Получатель" value={teacherId} onChange={setTeacher} className="w-64">
                  <option value="">Выберите учителя</option>
                  {teachers.data.filter(teacher => teacher.status === 'ACTIVE' && teacher.accountStatus === 'ACTIVE')
                    .map(teacher => <option key={teacher.id} value={teacher.id}>{teacherName(teacher.id!)}</option>)}
                </FilterSelect>
                <FilterSelect label="Разрешённый класс" value={classId} onChange={setClass} className="w-44">
                  <option value="">Выберите класс</option>
                  {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </FilterSelect>
                <FilterSelect label="Разрешённый отчёт" value={kind} onChange={value => setKind(value as Kind)} className="w-60">
                  {Object.entries(KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </FilterSelect>
                <Button disabled={!teacherId || !classId || mutation.isPending} onClick={() => mutation.mutate(null)}>Выдать доступ</Button>
              </div>
              <ul className="divide-y divide-line">
                {grants.data.filter(grant => grant.academicYearId === yearId).map(grant => (
                  <li key={grant.id} className="flex items-center justify-between gap-4 py-3">
                    <div><p className="font-semibold">{teacherName(grant.teacherProfileId)}</p>
                      <p className="text-sm text-slate-600">{classes.find(item => item.id === grant.classId)?.name ?? `Класс №${grant.classId}`} · {KINDS[grant.reportKind]}</p></div>
                    <Button variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate(grant.id)}
                      aria-label={`Отозвать доступ: ${teacherName(grant.teacherProfileId)}, ${KINDS[grant.reportKind]}`}>Отозвать</Button>
                  </li>
                ))}
              </ul>
              {!grants.data.some(grant => grant.academicYearId === yearId) && <EmptyBlock title="Дополнительных разрешений нет" />}
            </>
          )}
      </div>
    </Modal>
  );
}
