import { useEffect, useMemo, useState } from 'react';
import { FileText, Users } from 'lucide-react';
import { DateRangeInput } from '@/components/ui/DateRangeInput';
import { Field } from '@/components/ui/Field';
import { FilterChip } from '@/components/ui/FilterChip';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Select } from '@/components/ui/Select';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { useAiReportStudents, type useAiReportContext } from '@/hooks/aiReportQueries';
import type { Schema } from '@/lib/apiSchemas';
import {
  PERIOD_KIND_LABELS,
  TYPE_LABELS,
  periodProblem,
  periodRequest,
  todayIso,
  yearMonths,
  type AiPeriodKind,
  type AiReportOwner,
  type AiReportType,
  type PeriodDraft,
} from '@/lib/aiReportModel';

const collator = new Intl.Collator('ru-RU', { numeric: true });

/** Что подставить из фильтров страницы (ТЗ §3: меньше повторного выбора). */
export interface AiReportPreset {
  owner?: AiReportOwner;
  /** Роль задана разделом: «Мой класс» — всегда классный руководитель. */
  fixedOwner?: boolean;
  type?: AiReportType;
  classId?: number | null;
  subjectId?: number | null;
  studentProfileId?: number | null;
  academicPeriodId?: number | null;
}

export interface AiReportFormState {
  body: Schema<'AiReportCreateReportRequest'> | null;
  problem: string | null;
}

type Context = NonNullable<ReturnType<typeof useAiReportContext>['data']>;

/**
 * Форма «Новая AI-сводка» (Figma Т2–Т5, И2, К3). Что можно выбрать — из `/context`: роли,
 * пары «класс × предмет», классы руководства, периоды года. Недоступный режим погашен и
 * объяснён, а не спрятан. Смена роли или класса сбрасывает несовместимое (ТЗ §3).
 */
export function AiReportCreateForm({ context, preset, onChange, disabled }: {
  context: Context;
  preset: AiReportPreset;
  onChange: (state: AiReportFormState) => void;
  disabled?: boolean;
}) {
  const owners = useMemo(() => (context.owners ?? []).map((option) => option.owner as AiReportOwner), [context.owners]);
  const [owner, setOwner] = useState<AiReportOwner | null>(() =>
    preset.owner && owners.includes(preset.owner) ? preset.owner : owners[0] ?? null);
  const allowedTypes = useMemo(() => (context.owners ?? []).find((option) => option.owner === owner)?.reportTypes as AiReportType[] | undefined ?? [],
    [context.owners, owner]);

  const pairs = useMemo(() => context.subjectPairs ?? [], [context.subjectPairs]);
  const subjects = useMemo(() => {
    const unique = new Map<number, string>();
    pairs.forEach((pair) => pair.subject?.id != null && unique.set(pair.subject.id, pair.subject.name ?? ''));
    return [...unique.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => collator.compare(a.name, b.name));
  }, [pairs]);
  const [subjectId, setSubjectId] = useState<number | null>(() =>
    subjects.find((item) => item.id === preset.subjectId)?.id ?? subjects[0]?.id ?? null);

  const classes = useMemo(() => {
    if (owner === 'HOMEROOM') {
      return (context.homeroomClasses ?? []).map((item) => ({ id: item.id!, name: item.name ?? '' }));
    }
    return pairs.filter((pair) => pair.subject?.id === subjectId && pair.schoolClass?.id != null)
      .map((pair) => ({ id: pair.schoolClass!.id!, name: pair.schoolClass!.name ?? '' }))
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [context.homeroomClasses, owner, pairs, subjectId]);

  const severalClasses = owner === 'SUBJECT_TEACHER' && classes.length > 1;
  const [type, setType] = useState<AiReportType>(() => preset.type ?? (preset.studentProfileId ? 'STUDENT' : 'CLASS'));
  const [classId, setClassId] = useState<number | null>(() =>
    classes.find((item) => item.id === preset.classId)?.id ?? classes[0]?.id ?? null);
  const [classIds, setClassIds] = useState<number[]>(() => classes.map((item) => item.id));
  const [studentId, setStudentId] = useState<number | null>(preset.studentProfileId ?? null);

  const year = (context.years ?? []).find((item) => item.id === context.selectedYearId);
  const periods = useMemo(() => [...(context.periods ?? [])]
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')), [context.periods]);
  const today = todayIso();
  const currentPeriod = periods.find((item) => item.startDate && item.endDate && item.startDate <= today && today <= item.endDate);
  const kinds = (context.periodKinds ?? ['MONTH', 'ACADEMIC_PERIOD', 'CUSTOM']) as AiPeriodKind[];
  const months = useMemo(() => yearMonths(year?.startDate, year?.endDate, today), [today, year?.endDate, year?.startDate]);
  const [period, setPeriod] = useState<PeriodDraft>(() => ({
    kind: 'ACADEMIC_PERIOD',
    month: months[0]?.value ?? '',
    academicPeriodId: periods.find((item) => item.id === preset.academicPeriodId && (item.startDate ?? '') <= today)?.id
      ?? currentPeriod?.id ?? periods.filter((item) => (item.startDate ?? '') <= today).at(-1)?.id ?? null,
    from: '',
    to: '',
  }));

  // Смена роли/предмета: класс и ученик другого набора за ними не тянутся.
  useEffect(() => {
    if (classId != null && !classes.some((item) => item.id === classId)) {
      setClassId(classes[0]?.id ?? null);
      setStudentId(null);
    }
    setClassIds((current) => {
      const kept = current.filter((id) => classes.some((item) => item.id === id));
      return kept.length > 0 ? kept : classes.map((item) => item.id);
    });
  }, [classId, classes]);
  useEffect(() => {
    if (!allowedTypes.includes(type)) setType(allowedTypes.includes('CLASS') ? 'CLASS' : allowedTypes[0] ?? 'CLASS');
  }, [allowedTypes, type]);
  useEffect(() => {
    if (type === 'CLASSES' && !severalClasses) setType('CLASS');
  }, [severalClasses, type]);

  const students = useAiReportStudents(owner, context.selectedYearId ?? null, type === 'CLASSES' ? null : classId,
    owner === 'SUBJECT_TEACHER' ? subjectId : null);
  const studentOptions = useMemo(() => [...(students.data ?? [])].sort((a, b) => collator.compare(a.name ?? '', b.name ?? '')),
    [students.data]);
  useEffect(() => {
    if (studentId != null && students.data && !students.data.some((item) => item.id === studentId)) setStudentId(null);
  }, [studentId, students.data]);

  const problem = owner == null ? 'Нет назначений, по которым можно сформировать сводку.'
    : type === 'STUDENT' && studentId == null ? 'Выберите ученика.'
      : type === 'CLASSES' && classIds.length === 0 ? 'Выберите хотя бы один класс.'
        : type !== 'CLASSES' && classId == null ? 'Выберите класс.'
          : owner === 'SUBJECT_TEACHER' && subjectId == null ? 'Выберите предмет.'
            : periodProblem(period, year?.startDate, year?.endDate, today);

  useEffect(() => {
    onChange({
      problem,
      body: problem || owner == null || context.selectedYearId == null ? null : {
        owner,
        type,
        academicYearId: context.selectedYearId,
        subjectId: owner === 'SUBJECT_TEACHER' ? subjectId ?? undefined : undefined,
        classId: type === 'CLASSES' ? undefined : classId ?? undefined,
        classIds: type === 'CLASSES' ? classIds : undefined,
        studentProfileId: type === 'STUDENT' ? studentId ?? undefined : undefined,
        period: periodRequest(period),
      },
    });
  }, [classId, classIds, context.selectedYearId, onChange, owner, period, problem, studentId, subjectId, type]);

  const subjectName = subjects.find((item) => item.id === subjectId)?.name;
  const homeroomName = (context.homeroomClasses ?? [])[0]?.name;
  const selectedPeriod = periods.find((item) => item.id === period.academicPeriodId);
  const periodRunning = period.kind === 'ACADEMIC_PERIOD' ? selectedPeriod?.id === currentPeriod?.id
    : period.kind === 'MONTH' ? period.month === today.slice(0, 7) : false;

  return (
    <div className="space-y-5">
      {owners.length > 1 && !preset.fixedOwner && (
        <Field label="От чьего имени" hint={owner === 'HOMEROOM'
          ? `Все предметы класса ${homeroomName ?? ''}.`.replace(' .', '.')
          : `Только ${subjectName?.toLowerCase() ?? 'ваш предмет'} в ваших классах ${subjects.length ? classes.map((item) => item.name).join(', ') : ''}.`}>
          <div className="flex flex-wrap gap-2">
            {owners.map((item) => (
              <FilterChip key={item} appearance="check" disabled={disabled} selected={owner === item}
                label={item === 'HOMEROOM' ? `Классный руководитель ${homeroomName ?? ''}`.trim() : `Учитель · ${subjectName ?? 'предмет'}`}
                onClick={() => { setOwner(item); setStudentId(null); }} />
            ))}
          </div>
        </Field>
      )}

      <StatusNotice tone="navy" icon={owner === 'HOMEROOM' ? Users : FileText}>
        {owner === 'HOMEROOM'
          ? <>Классный руководитель <b>{homeroomName}</b> · все предметы класса</>
          : <>Учитель-предметник · <b>{subjectName}</b> · ваши классы {classes.map((item) => item.name).join(', ')}</>}
      </StatusNotice>

      <Field label="Что анализировать" hint={owner === 'HOMEROOM'
        ? '«Мои классы» — только для учителя-предметника с несколькими классами.'
        : !severalClasses ? '«Мои классы» — когда по предмету у вас несколько классов.' : undefined}>
        <div className="flex flex-wrap gap-2">
          {(['STUDENT', 'CLASS', 'CLASSES'] as const).map((item) => (
            <FilterChip key={item} appearance="check" label={TYPE_LABELS[item]} selected={type === item}
              disabled={disabled || !allowedTypes.includes(item) || (item === 'CLASSES' && !severalClasses)}
              onClick={() => setType(item)} />
          ))}
        </div>
      </Field>

      {type === 'CLASSES' ? (
        <Field label="Классы">
          <MultiSelect aria-label="Классы" disabled={disabled}
            options={classes.map((item) => ({ value: String(item.id), label: item.name }))}
            value={classIds.map(String)} onChange={(next) => setClassIds(next.map(Number))} />
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Класс">
            <Select value={classId == null ? '' : String(classId)} disabled={disabled || owner === 'HOMEROOM' || classes.length < 2}
              onChange={(event) => { setClassId(Number(event.target.value) || null); setStudentId(null); }}>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Ученик">
            <Select value={type === 'STUDENT' && studentId != null ? String(studentId) : ''}
              placeholder={type === 'STUDENT' ? (students.isPending ? 'Загрузка…' : 'Выберите ученика') : 'Весь класс'}
              disabled={disabled || type !== 'STUDENT' || students.isPending}
              onChange={(event) => setStudentId(Number(event.target.value) || null)}>
              {studentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
        </div>
      )}

      <Field label="Предмет">
        {owner === 'HOMEROOM' ? (
          <Select value="" placeholder="Все предметы класса" disabled onChange={() => undefined}><option value="">Все предметы класса</option></Select>
        ) : (
          <Select value={subjectId == null ? '' : String(subjectId)} disabled={disabled || subjects.length < 2}
            onChange={(event) => setSubjectId(Number(event.target.value) || null)}>
            {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        )}
      </Field>

      <Field label="Период" error={problem && period.kind === 'CUSTOM' && period.from && period.to ? problem : undefined}
        hint={periodRunning ? 'Период ещё идёт — в сводку попадут данные по сегодняшний день.' : undefined}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {kinds.map((kind) => (
              <FilterChip key={kind} appearance="check" label={PERIOD_KIND_LABELS[kind]} selected={period.kind === kind}
                disabled={disabled} onClick={() => setPeriod((current) => ({ ...current, kind }))} />
            ))}
          </div>
          {period.kind === 'MONTH' && (
            <Select aria-label="Месяц" value={period.month} disabled={disabled}
              onChange={(event) => setPeriod((current) => ({ ...current, month: event.target.value }))}>
              {months.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          )}
          {period.kind === 'ACADEMIC_PERIOD' && (
            <Select aria-label="Четверть" value={period.academicPeriodId == null ? '' : String(period.academicPeriodId)} disabled={disabled}
              onChange={(event) => setPeriod((current) => ({ ...current, academicPeriodId: Number(event.target.value) || null }))}>
              {periods.map((item) => (
                <option key={item.id} value={item.id} disabled={(item.startDate ?? '') > today}>
                  {item.name}{item.startDate && item.endDate ? ` (${item.startDate.slice(8)}.${item.startDate.slice(5, 7)} – ${item.endDate.slice(8)}.${item.endDate.slice(5, 7)})` : ''}
                </option>
              ))}
            </Select>
          )}
          {period.kind === 'CUSTOM' && (
            <DateRangeInput from={period.from} to={period.to} disabled={disabled}
              onFromChange={(from) => setPeriod((current) => ({ ...current, from }))}
              onToChange={(to) => setPeriod((current) => ({ ...current, to }))} />
          )}
        </div>
      </Field>

      <p className="text-xs text-planning-muted">
        Сводка строится только по оценкам, посещаемости и комментариям из журнала за выбранный период. Сама она не
        запускается — только по кнопке.
      </p>
    </div>
  );
}
