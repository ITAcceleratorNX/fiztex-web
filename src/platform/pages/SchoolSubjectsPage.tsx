import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { SCHOOL_STATUS_LABELS } from '../labels';
import { mergeSearchParams } from '@/lib/listNavigation';
import { useSchoolSubjects, useArchiveSchoolSubject, useAdminAcademicYears, useAttestationSettings } from '@/hooks/queries';
import type { SchoolRecordStatus, SchoolSubject } from '../types';
import { useListSearchParams } from '@/hooks/useListNavigation';
import { FORMULA_PROFILES } from '@/lib/formulaProfiles';
import type { AttestationSetting } from '@/lib/attestationSettingsApi';
import { subjectSummary } from '@/lib/subjectAttestationModel';
import { SubjectEditModal } from './subject-attestation/SubjectEditModal';

export function SchoolSubjectsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useListSearchParams('school-subjects', ['status']);
  const rawStatus = searchParams.get('status');
  const status: SchoolRecordStatus | 'ALL' = rawStatus === 'ALL' || rawStatus === 'ARCHIVED'
    ? rawStatus
    : 'ACTIVE';
  const query = useSchoolSubjects(status);
  const archiveSubject = useArchiveSchoolSubject();
  const items = query.data ?? [];
  const loading = query.isPending;
  const error = query.isError ? 'Не удалось загрузить предметы' : null;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolSubject | null>(null);
  // Колонка «Аттестация» (А1): действующие версии всех предметов текущего учебного года — один запрос.
  const years = useAdminAcademicYears();
  const activeYearId = years.data?.find((year) => year.status === 'ACTIVE')?.id ?? null;
  const settings = useAttestationSettings(activeYearId);
  const settingsBySubject = useMemo(() => {
    const map = new Map<number, AttestationSetting[]>();
    for (const setting of settings.data ?? []) {
      if (setting.subjectId == null) continue;
      map.set(setting.subjectId, [...(map.get(setting.subjectId) ?? []), setting]);
    }
    return map;
  }, [settings.data]);

  useEffect(() => {
    const next = mergeSearchParams(searchParams, { status: status === 'ACTIVE' ? null : status });
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, status]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: SchoolSubject) {
    setEditing(item);
    setFormOpen(true);
  }

  async function handleArchive(item: SchoolSubject) {
    if (!window.confirm(`Архивировать «${item.name}»?`)) return;
    try {
      await archiveSubject.mutateAsync(item.id);
      toast.success('Предмет архивирован');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось архивировать');
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Единый список предметов школы: используется в расписании, назначениях учителей, а также во
        вступительных тестах и учебных материалах.
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-44">
          <Select
            value={status}
            onChange={(e) => setSearchParams(mergeSearchParams(searchParams, {
              status: e.target.value === 'ACTIVE' ? null : e.target.value,
            }))}
          >
            <option value="ALL">Все</option>
            <option value="ACTIVE">Активные</option>
            <option value="ARCHIVED">Архив</option>
          </Select>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Создать предмет
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void query.refetch()} />}
      {!loading && !error && items.length === 0 && (
        <div className="card">
          <EmptyBlock
            title="Предметов нет"
            description="Создайте «Физика», «Математика» и т.д. — они появятся в назначении учителя."
          />
        </div>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Название</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Формулы</th>
                <th className="px-4 py-3 font-semibold">Аттестация</th>
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">{SCHOOL_STATUS_LABELS[item.status]}</td>
                  <td className="px-4 py-3 text-muted">{FORMULA_PROFILES[item.formulaProfile ?? 'GENERAL']}</td>
                  <td className="px-4 py-3">
                    <AttestationSummary
                      settings={settingsBySubject.get(item.id) ?? []}
                      state={activeYearId == null ? 'no-year' : settings.isPending ? 'loading' : settings.isError ? 'error' : 'ready'}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} disabled={item.status === 'ARCHIVED'}>
                        Изменить
                      </Button>
                      {item.status === 'ACTIVE' && (
                        <Button variant="ghost" size="sm" onClick={() => void handleArchive(item)}>
                          Архив
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SubjectEditModal open={formOpen} subject={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}

/**
 * Сводка колонки «Аттестация» (макет А1 2224:1579): действующие версии года, соседние параллели с
 * одинаковым правилом одной строкой. Ошибка — не «По умолчанию»: экран не знает, так ли это.
 */
function AttestationSummary({ settings, state }: {
  settings: AttestationSetting[];
  state: 'loading' | 'error' | 'ready' | 'no-year';
}) {
  if (state === 'loading') return <span className="block h-4 w-28 animate-pulse rounded bg-slate-100" aria-label="Загрузка" />;
  if (state === 'error') return <span className="text-13 text-muted" title="Не удалось загрузить настройки аттестации">—</span>;
  const lines = subjectSummary(settings);
  const scheduled = settings.some((setting) => setting.state === 'SCHEDULED');
  if (lines.length === 0) {
    return <span className="text-13 text-muted">{scheduled ? 'По умолчанию · есть изменения' : 'По умолчанию'}</span>;
  }
  return (
    <span className="flex flex-col gap-0.5 text-13 text-slate-700">
      {lines.map((line) => (
        <span key={line.scope}><span className="font-semibold text-ink">{line.scope}:</span> {line.rule}</span>
      ))}
      {scheduled && <span className="text-11 text-muted">есть запланированные изменения</span>}
    </span>
  );
}
