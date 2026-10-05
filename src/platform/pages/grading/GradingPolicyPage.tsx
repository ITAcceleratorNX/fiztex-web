import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, FileText, Plus, Scale, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { Select } from '@/components/ui/Select';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  useActivateGradingPolicy,
  useCreateGradingPolicy,
  useDeleteGradingPolicy,
  useGradingPolicies,
  useGradingPolicyTemplates,
  useUpdateGradingPolicy,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { cx, formatWeekdayDayMonth } from '@/lib/format';
import {
  GRADING_POLICY_ERRORS,
  type AssessmentComponent,
  type GradingPolicy,
  type GradingPolicyContent,
  type PolicyBand,
  type PolicyWorkType,
  type TemplateCode,
  type WorkScoring,
} from '@/lib/gradingApi';
import {
  COMPONENT_SHORT,
  MISSING_RULE_LABELS,
  POLICY_STATUS_LABELS,
  SCORING_LABELS,
  weightsCaption,
  weightsSum,
} from '@/lib/gradingModel';
import type { GradeType } from '@/lib/gradesApi';
import { GRADE_TYPE_LABELS } from '@/lib/gradesModel';
import { platformCoreApi } from '@/lib/platformCoreApi';

type Issue = { code?: string; field?: string; message?: string };
type ScopeConflict = { periodId?: number; periodName?: string; reason?: string; count?: number };

/**
 * Политика оценивания школы (GRADES-003): веса ФО, СОР и СОЧ, как учитывается каждый вид
 * работы, пороги «процент → оценка» и вес экзамена.
 *
 * <p><b>Числа здесь — решение школы, а не платформы.</b> Источники противоречат друг другу
 * (Kundelik 25/25/50 против формы журнала 2026 года 50/50 без ФО), поэтому оба варианта
 * предложены шаблонами, и ни один не действует сам. Пока политика года не активирована,
 * журнал считает по-старому: средний балл и шкала 2…5.
 *
 * <p><b>Действующая версия не редактируется.</b> Поменять веса — значит сделать копию,
 * поправить черновик и активировать его: прошлая версия уходит в историю, и у каждого
 * посчитанного процента остаётся ответ «по каким правилам». Проверку содержимого и
 * конфликтов со старыми оценками делает сервер — экран показывает его ответ целиком.
 */
export function GradingPolicyPage() {
  useDocumentTitle('Политика оценивания');

  const yearsQuery = useQuery({
    queryKey: ['academic-years', 'list'],
    queryFn: ({ signal }) => platformCoreApi.listAcademicYears(signal),
  });
  const years = useMemo(() => yearsQuery.data?.content ?? [], [yearsQuery.data]);
  const [yearId, setYearId] = useState<number | null>(null);
  const selectedYearId = yearId ?? years.find((year) => year.status === 'ACTIVE')?.id ?? years[0]?.id ?? null;

  const periodsQuery = useQuery({
    queryKey: ['academic-years', selectedYearId ?? 0, 'periods'],
    queryFn: ({ signal }) => platformCoreApi.listPeriods(selectedYearId as number, signal),
    enabled: selectedYearId != null,
  });
  const policiesQuery = useGradingPolicies(selectedYearId);
  const templatesQuery = useGradingPolicyTemplates();
  const createPolicy = useCreateGradingPolicy();

  const policies = policiesQuery.data ?? [];
  const active = policies.find((policy) => policy.status === 'ACTIVE') ?? null;
  const drafts = policies.filter((policy) => policy.status === 'DRAFT');
  const retired = policies.filter((policy) => policy.status === 'RETIRED');
  const [openDraftId, setOpenDraftId] = useState<number | null>(null);
  const openDraft = drafts.find((draft) => draft.id === openDraftId) ?? drafts[0] ?? null;
  const [createError, setCreateError] = useState<string | null>(null);

  async function create(body: { template?: TemplateCode; copyFromPolicyId?: number }) {
    if (selectedYearId == null) return;
    setCreateError(null);
    try {
      const created = await createPolicy.mutateAsync({ academicYearId: selectedYearId, ...body });
      setOpenDraftId(created.id ?? null);
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.message : 'Не удалось создать черновик');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-28 font-bold text-ink">Политика оценивания</h1>
          <p className="text-13 text-muted">
            Веса формативного и суммативного оценивания, пороги итоговой оценки и правила, по
            которым журнал считает процент за четверть.
          </p>
        </div>
        <div className="w-64">
          <Select
            aria-label="Учебный год"
            value={selectedYearId != null ? String(selectedYearId) : ''}
            onChange={(event) => {
              setYearId(Number(event.target.value));
              setOpenDraftId(null);
            }}
            placeholder="Учебный год"
          >
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {`${year.name}${year.status === 'ACTIVE' ? ' · текущий' : ''}`}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {policiesQuery.isError ? (
        <div className="card">
          <ErrorBlock message="Не удалось загрузить политику оценивания" onRetry={() => void policiesQuery.refetch()} />
        </div>
      ) : policiesQuery.isPending || yearsQuery.isPending ? (
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200/50" aria-busy="true" />
      ) : (
        <>
          {active ? (
            <ActivePolicyCard
              policy={active}
              busy={createPolicy.isPending}
              onCopy={() => void create({ copyFromPolicyId: active.id })}
            />
          ) : (
            <div className="card">
              <EmptyBlock
                icon={<Scale className="size-7" />}
                title="Политика на этот год не действует"
                description="Журнал считает по-старому: средний балл и итог 2–5. Создайте черновик из шаблона, проверьте числа со школой и активируйте."
              />
            </div>
          )}

          {!active && drafts.length === 0 && (
            <section className="grid gap-4 md:grid-cols-2">
              {(templatesQuery.data ?? []).map((template) => (
                <article key={template.code} className="card flex flex-col gap-3 p-5">
                  <p className="flex items-center gap-2 text-11 font-bold uppercase text-muted">
                    <FileText className="size-4" />
                    Шаблон из источника
                  </p>
                  <h3 className="text-15 font-bold text-ink">{template.title}</h3>
                  <p className="text-13 text-slate-600">{weightsCaption(template.content?.components)}</p>
                  <p className="text-11 text-muted">{template.content?.sourceNote}</p>
                  <div className="mt-auto">
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={createPolicy.isPending}
                      onClick={() => void create({ template: template.code })}
                    >
                      <Plus className="size-4" />
                      Создать черновик
                    </Button>
                  </div>
                </article>
              ))}
            </section>
          )}

          {createError && <NoticeBar tone="warning">{createError}</NoticeBar>}

          {drafts.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => setOpenDraftId(draft.id ?? null)}
                  className={cx(
                    'rounded-lg border px-3 py-1.5 text-13 font-medium transition',
                    openDraft?.id === draft.id
                      ? 'border-navy-700 bg-navy-50 text-navy-700'
                      : 'border-line text-slate-600 hover:border-navy-400',
                  )}
                >
                  {draft.name}
                </button>
              ))}
            </div>
          )}

          {openDraft && (
            <DraftEditor
              key={`${openDraft.id}-${openDraft.version}`}
              policy={openDraft}
              periods={periodsQuery.data ?? []}
              replacesActive={active != null}
            />
          )}

          {retired.length > 0 && (
            <section className="card flex flex-col gap-3 p-5">
              <h2 className="text-15 font-bold text-ink">Прошлые версии</h2>
              {retired.map((policy) => (
                <div key={policy.id} className="flex flex-wrap items-center justify-between gap-2 text-13">
                  <span className="text-slate-700">{policy.name}</span>
                  <span className="text-muted">
                    {weightsCaption(policy.components)} · действовала{' '}
                    {policy.activatedAt ? `с ${formatWeekdayDayMonth(policy.activatedAt)}` : ''}
                    {policy.retiredAt ? ` по ${formatWeekdayDayMonth(policy.retiredAt)}` : ''}
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ActivePolicyCard({
  policy,
  busy,
  onCopy,
}: {
  policy: GradingPolicy;
  busy: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="card flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            <Badge tone="green" dot>
              {POLICY_STATUS_LABELS.ACTIVE}
            </Badge>
            {policy.activatedAt && (
              <span className="text-11 text-muted">
                с {formatWeekdayDayMonth(policy.activatedAt)}
                {policy.activatedByName ? ` · ${policy.activatedByName}` : ''}
              </span>
            )}
          </span>
          <h2 className="text-lg font-bold text-ink">{policy.name}</h2>
        </div>
        <Button variant="secondary" size="sm" loading={busy} onClick={onCopy}>
          <Copy className="size-4" />
          Новая версия
        </Button>
      </div>

      <dl className="grid gap-4 text-13 md:grid-cols-2">
        <Term label="Веса компонентов" value={weightsCaption(policy.components)} />
        <Term
          label="Пороги итоговой"
          value={(policy.bands ?? []).map((band) => `с ${band.minPercent}% — ${band.value}`).join(' · ')}
        />
        <Term
          label="Нет компонента в четверти"
          value={policy.missingComponentRule ? MISSING_RULE_LABELS[policy.missingComponentRule] : '—'}
        />
        <Term
          label="Вес экзамена в итоговой"
          value={policy.examWeightPercent != null ? `${policy.examWeightPercent}%` : 'Не утверждён — итоговую ставят вручную'}
        />
        <Term label="Действует" value={policy.effectiveFromPeriodName ? `с периода «${policy.effectiveFromPeriodName}»` : 'весь учебный год'} />
        <Term label="Источник" value={policy.sourceNote ?? '—'} />
      </dl>

      <WorkTypesSummary workTypes={policy.workTypes ?? []} />
    </section>
  );
}

function WorkTypesSummary({ workTypes }: { workTypes: PolicyWorkType[] }) {
  const groups = new Map<string, string[]>();
  for (const type of workTypes) {
    const key = type.component ? COMPONENT_SHORT[type.component] : 'Не учитывается';
    const label = GRADE_TYPE_LABELS[type.workType as GradeType] ?? type.workType ?? '';
    groups.set(key, [...(groups.get(key) ?? []), label]);
  }
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface p-4 text-13">
      {[...groups.entries()].map(([key, labels]) => (
        <p key={key}>
          <span className="font-semibold text-ink">{key}:</span>{' '}
          <span className="text-slate-600">{labels.join(', ')}</span>
        </p>
      ))}
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-11 font-bold uppercase text-muted">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}

/**
 * Редактор черновика. Форма держит содержимое целиком и отправляет его целиком (`PUT`):
 * так в черновике можно и добавить, и убрать — «не прислал, значит оставить» этого не
 * позволяло бы. `expectedVersion` ловит правку из соседней вкладки.
 */
function DraftEditor({
  policy,
  periods,
  replacesActive,
}: {
  policy: GradingPolicy;
  periods: { id: number; name: string }[];
  replacesActive: boolean;
}) {
  const update = useUpdateGradingPolicy();
  const activate = useActivateGradingPolicy();
  const remove = useDeleteGradingPolicy();

  const [form, setForm] = useState<GradingPolicyContent>(() => contentOf(policy));
  const [examText, setExamText] = useState(policy.examWeightPercent != null ? String(policy.examWeightPercent) : '');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [conflicts, setConflicts] = useState<ScopeConflict[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(contentOf(policy));
    setDirty(false);
  }, [policy]);

  const sum = weightsSum(form.components ?? []);

  function patch(next: Partial<GradingPolicyContent>) {
    setForm((current) => ({ ...current, ...next }));
    setDirty(true);
  }

  function payload(): GradingPolicyContent {
    const exam = examText.trim() === '' ? undefined : Number(examText.replace(',', '.'));
    return { ...form, examWeightPercent: exam, expectedVersion: policy.version };
  }

  function readFailure(error: unknown, fallback: string) {
    if (error instanceof ApiError) {
      const details = error.details as { issues?: Issue[]; periods?: ScopeConflict[] } | undefined;
      setIssues(details?.issues ?? []);
      setConflicts(error.code === GRADING_POLICY_ERRORS.gradesOutsideScope ? details?.periods ?? [] : []);
      setMessage(error.message);
      return;
    }
    setMessage(fallback);
  }

  async function save(): Promise<boolean> {
    setIssues([]);
    setConflicts([]);
    setMessage(null);
    try {
      await update.mutateAsync({ policyId: policy.id as number, content: payload() });
      setDirty(false);
      return true;
    } catch (error) {
      readFailure(error, 'Не удалось сохранить черновик');
      return false;
    }
  }

  async function doActivate() {
    setConfirmActivate(false);
    if (dirty && !(await save())) return;
    setIssues([]);
    setConflicts([]);
    setMessage(null);
    try {
      await activate.mutateAsync(policy.id as number);
    } catch (error) {
      readFailure(error, 'Не удалось активировать политику');
    }
  }

  return (
    <section className="card flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Badge tone="amber" dot>
            {POLICY_STATUS_LABELS.DRAFT}
          </Badge>
          {dirty && <span className="text-11 text-muted">есть несохранённые изменения</span>}
        </span>
        <span className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
            Удалить черновик
          </Button>
          <Button variant="secondary" size="sm" loading={update.isPending} disabled={!dirty} onClick={() => void save()}>
            Сохранить
          </Button>
          <Button size="sm" loading={activate.isPending} onClick={() => setConfirmActivate(true)}>
            Активировать
          </Button>
        </span>
      </div>

      {(message || issues.length > 0 || conflicts.length > 0) && (
        <NoticeBar tone="warning">
          <span className="flex flex-col gap-1">
            {message && <span className="font-semibold">{message}</span>}
            {issues.map((issue, index) => (
              <span key={`${issue.code}-${index}`}>• {issue.message}</span>
            ))}
            {conflicts.map((conflict) => (
              <span key={conflict.periodId}>
                • «{conflict.periodName}»: {conflict.count}{' '}
                {conflict.reason === 'SCALE_GRADES_IN_SCOPE'
                  ? 'оценок по шкале 2–5 попадают в область политики — начните её действие с более позднего периода'
                  : 'оценок в баллах остаются вне области политики — начните её действие раньше'}
              </span>
            ))}
          </span>
        </NoticeBar>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Название" required>
          <TextInput value={form.name ?? ''} onChange={(event) => patch({ name: event.target.value })} />
        </Field>
        <Field label="Действует" hint="Прошлые периоды останутся на шкале 2–5 — переводить их оценки в баллы никто не будет">
          <Select
            value={form.effectiveFromPeriodId != null ? String(form.effectiveFromPeriodId) : ''}
            onChange={(event) =>
              patch({ effectiveFromPeriodId: event.target.value ? Number(event.target.value) : undefined })
            }
          >
            <option value="">Весь учебный год</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {`С периода «${period.name}»`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Если в четверти нет работ одного из компонентов">
          <Select
            value={form.missingComponentRule}
            onChange={(event) =>
              patch({ missingComponentRule: event.target.value as GradingPolicyContent['missingComponentRule'] })
            }
          >
            <option value="RENORMALIZE">{MISSING_RULE_LABELS.RENORMALIZE}</option>
            <option value="REQUIRE_ALL">{MISSING_RULE_LABELS.REQUIRE_ALL}</option>
          </Select>
        </Field>
        <Field
          label="Вес экзамена в итоговой, %"
          hint="Пусто — правило не утверждено, рекомендации итоговой нет"
        >
          <TextInput
            inputMode="decimal"
            value={examText}
            onChange={(event) => {
              setExamText(event.target.value.replace(/[^\d.,]/g, ''));
              setDirty(true);
            }}
          />
        </Field>
        <Field label="Источник чисел" className="md:col-span-2" hint="Откуда взяты веса и пороги: приказ, решение педсовета, протокол">
          <TextArea rows={2} value={form.sourceNote ?? ''} onChange={(event) => patch({ sourceNote: event.target.value })} />
        </Field>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-15 font-bold text-ink">Компоненты процента</h3>
          <span className={cx('text-13 font-semibold', sum === 100 ? 'text-success-fg' : 'text-red-600')}>
            Сумма весов: {sum}%
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(form.components ?? []).map((component, index) => (
            <div key={component.code} className="flex flex-col gap-2 rounded-xl border border-line p-3">
              <span className="text-11 font-bold uppercase text-muted">{COMPONENT_SHORT[component.code]}</span>
              <TextInput
                aria-label={`Название ${COMPONENT_SHORT[component.code]}`}
                value={component.title}
                onChange={(event) =>
                  patch({ components: replaceAt(form.components ?? [], index, { ...component, title: event.target.value }) })
                }
              />
              <label className="flex items-center gap-2 text-13 text-slate-600">
                Вес
                <TextInput
                  className="w-20"
                  inputMode="decimal"
                  value={String(component.weightPercent)}
                  onChange={(event) =>
                    patch({
                      components: replaceAt(form.components ?? [], index, {
                        ...component,
                        weightPercent: toNumber(event.target.value),
                      }),
                    })
                  }
                />
                %
              </label>
            </div>
          ))}
        </div>
        <p className="text-11 text-muted">
          Доля компонента = Σ балл / Σ максимум его работ (с весами видов работ). Процент
          четверти = Σ доля × вес / Σ весов присутствующих компонентов. Компонент с весом 0
          виден в журнале, но в процент не входит.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-15 font-bold text-ink">Виды работ</h3>
        <table className="w-full text-13">
          <thead>
            <tr className="border-b border-line text-left text-11 font-bold uppercase text-slate-400">
              <th className="py-2 pr-3">Вид работы</th>
              <th className="py-2 pr-3">Куда идёт</th>
              <th className="py-2 pr-3">Как оценивается</th>
              <th className="w-24 py-2">Вес</th>
            </tr>
          </thead>
          <tbody>
            {(form.workTypes ?? []).map((type, index) => (
              <tr key={type.workType} className="border-b border-line last:border-b-0">
                <td className="py-2 pr-3 text-slate-800">{GRADE_TYPE_LABELS[type.workType as GradeType] ?? type.workType}</td>
                <td className="py-2 pr-3">
                  <select
                    aria-label="Компонент"
                    className="input-base h-9 py-1 text-13"
                    value={type.component ?? ''}
                    onChange={(event) =>
                      patch({
                        workTypes: replaceAt(form.workTypes ?? [], index, {
                          ...type,
                          component: (event.target.value || undefined) as AssessmentComponent | undefined,
                        }),
                      })
                    }
                  >
                    {(form.components ?? []).map((component) => (
                      <option key={component.code} value={component.code}>
                        {COMPONENT_SHORT[component.code]}
                      </option>
                    ))}
                    <option value="">Не учитывается</option>
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <select
                    aria-label="Способ оценивания"
                    className="input-base h-9 py-1 text-13"
                    value={type.scoring}
                    onChange={(event) =>
                      patch({
                        workTypes: replaceAt(form.workTypes ?? [], index, {
                          ...type,
                          scoring: event.target.value as WorkScoring,
                        }),
                      })
                    }
                  >
                    <option value="TEN_POINT">{SCORING_LABELS.TEN_POINT}</option>
                    <option value="RAW_POINTS">{SCORING_LABELS.RAW_POINTS}</option>
                  </select>
                </td>
                <td className="py-2">
                  <TextInput
                    aria-label="Вес вида работы"
                    inputMode="decimal"
                    value={String(type.weight)}
                    onChange={(event) =>
                      patch({
                        workTypes: replaceAt(form.workTypes ?? [], index, {
                          ...type,
                          weight: toNumber(event.target.value),
                        }),
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-15 font-bold text-ink">Пороги итоговой оценки</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => patch({ bands: [...(form.bands ?? []), { minPercent: 100, value: 10, label: '' }] })}
          >
            <Plus className="size-4" />
            Порог
          </Button>
        </div>
        <p className="text-11 text-muted">
          Процент четверти округляется до целого по математическим правилам от точного значения
          (84,49 → 84, 84,5 → 85), затем выбирается самый высокий порог, не превышающий его.
        </p>
        {(form.bands ?? []).map((band, index) => (
          <div key={index} className="flex flex-wrap items-center gap-3 text-13">
            <span className="text-slate-600">с</span>
            <TextInput
              aria-label="Процент"
              className="w-20"
              inputMode="numeric"
              value={String(band.minPercent)}
              onChange={(event) => patch({ bands: replaceAt(form.bands ?? [], index, { ...band, minPercent: toNumber(event.target.value) }) })}
            />
            <span className="text-slate-600">% — оценка</span>
            <TextInput
              aria-label="Оценка"
              className="w-16"
              inputMode="numeric"
              value={String(band.value)}
              onChange={(event) => patch({ bands: replaceAt(form.bands ?? [], index, { ...band, value: toNumber(event.target.value) }) })}
            />
            <TextInput
              aria-label="Подпись"
              className="w-56"
              placeholder="Подпись"
              value={band.label ?? ''}
              onChange={(event) => patch({ bands: replaceAt(form.bands ?? [], index, { ...band, label: event.target.value }) })}
            />
            <button
              type="button"
              aria-label="Удалить порог"
              className="text-slate-400 transition hover:text-red-600"
              onClick={() => patch({ bands: (form.bands ?? []).filter((_, i) => i !== index) })}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </section>

      <ConfirmDialog
        open={confirmActivate}
        title="Активировать политику?"
        message={
          <span className="flex flex-col gap-2">
            <span>
              Журнал, итоги и экраны учеников начнут считать процент по этим правилам
              {form.effectiveFromPeriodId != null ? ' с выбранного периода' : ' за весь учебный год'}.
              Оценки в этих периодах будут ставиться баллами.
            </span>
            {replacesActive && (
              <span>
                Действующая версия уйдёт в историю. Выставленные итоги не изменятся — у строк, где
                рекомендация теперь другая, учитель увидит предупреждение.
              </span>
            )}
          </span>
        }
        confirmLabel="Активировать"
        loading={activate.isPending}
        onConfirm={() => void doActivate()}
        onClose={() => setConfirmActivate(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Удалить черновик?"
        message="Черновик ещё не действовал — по нему ничего не посчитано. Удаление нельзя отменить."
        confirmLabel="Удалить"
        loading={remove.isPending}
        onConfirm={() => {
          setConfirmDelete(false);
          remove.mutate(policy.id as number, {
            onError: (error) => readFailure(error, 'Не удалось удалить черновик'),
          });
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </section>
  );
}

function contentOf(policy: GradingPolicy): GradingPolicyContent {
  return {
    name: policy.name ?? '',
    effectiveFromPeriodId: policy.effectiveFromPeriodId,
    missingComponentRule: policy.missingComponentRule ?? 'RENORMALIZE',
    yearMethod: policy.yearMethod ?? 'AVERAGE_OF_PERIOD_FINALS',
    examWeightPercent: policy.examWeightPercent,
    sourceNote: policy.sourceNote,
    components: (policy.components ?? []).map((component) => ({ ...component })),
    workTypes: (policy.workTypes ?? []).map((type) => ({ ...type })),
    bands: (policy.bands ?? []).map((band: PolicyBand) => ({ ...band })),
    expectedVersion: policy.version,
  };
}

function replaceAt<T>(items: T[], index: number, next: T): T[] {
  return items.map((item, i) => (i === index ? next : item));
}

function toNumber(raw: string): number {
  const value = Number(raw.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(value) ? value : 0;
}
