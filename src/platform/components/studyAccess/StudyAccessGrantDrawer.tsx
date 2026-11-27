import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, School, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CheckCardGroup } from '@/components/ui/CheckCardGroup';
import { Field, Select, TextInput, focusFirstInvalidField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { useToast } from '@/context/ToastContext';
import { keys, useCreateStudyAccessGrant, useStudyAccessOptions, useUpdateStudyAccessGrant } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { withDemoMark } from '@/lib/demoClass';
import type { StudyAccessGrant } from '@/lib/studyAccessApi';
import {
  SCOPE_OPTIONS,
  SECTION_OPTIONS,
  TERM_OPTIONS,
  emptyGrantForm,
  grantForm,
  grantRequest,
  isConnectionFailure,
  localIsoDate,
  reissueForm,
  schoolScopeNotice,
  serverGrantErrors,
  validateGrantForm,
  withScopeType,
  withYear,
  yearOf,
  yearOptionLabel,
  type GrantForm,
  type GrantFormErrors,
  type GrantFormField,
} from '@/lib/studyAccessModel';

export type GrantDrawerMode =
  | { kind: 'create' }
  | { kind: 'edit'; grant: StudyAccessGrant }
  | { kind: 'reissue'; grant: StudyAccessGrant };

/**
 * Шторка «Предоставить доступ» / «Изменить доступ» (Figma `phyztex` А2–А5, А9, А14, А15).
 *
 * Состояние формы живёт только здесь, поэтому родитель монтирует шторку заново на каждое
 * открытие (`key`): прошлая отмена не должна подставить свои поля в новую выдачу.
 *
 * **Отправка одна за раз и не дублирует право.** Пока запрос идёт, кнопки выключены. После
 * сбоя связи кнопка становится «Повторить», и повтор того же содержимого уходит с тем же
 * `Idempotency-Key`: если первый запрос всё-таки дошёл, сервер вернёт уже выданное право.
 * Изменённая форма — уже новая попытка с новым ключом.
 */
export function StudyAccessGrantDrawer({
  open,
  onClose,
  teacherProfileId,
  teacherName,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  teacherProfileId: number;
  teacherName: string;
  mode: GrantDrawerMode;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const options = useStudyAccessOptions(open);
  const create = useCreateStudyAccessGrant(teacherProfileId);
  const update = useUpdateStudyAccessGrant();
  const bodyRef = useRef<HTMLDivElement>(null);
  const attempt = useRef<{ body: string; key: string } | null>(null);

  const [form, setForm] = useState<GrantForm | null>(null);
  const [errors, setErrors] = useState<GrantFormErrors>({});
  const [offline, setOffline] = useState(false);
  const today = useMemo(() => localIsoDate(), []);
  const editing = mode.kind === 'edit';
  const keptValidUntil = editing ? mode.grant.validUntil ?? null : null;
  const saving = create.isPending || update.isPending;

  // Форма заполняется, когда пришёл справочник: без него не знать ни текущего года, ни классов.
  useEffect(() => {
    if (form || !options.data) return;
    setForm(mode.kind === 'create'
      ? emptyGrantForm(options.data.defaultYearId)
      : mode.kind === 'edit' ? grantForm(mode.grant) : reissueForm(mode.grant, options.data, today));
  }, [form, mode, options.data, today]);

  const year = yearOf(options.data, form?.academicYearId ?? null);
  const yearOptions = useMemo(() => {
    const years = options.data?.years ?? [];
    // Право прошлого года, которого уже нет в справочнике, всё равно показывается своим годом.
    if (editing && mode.grant.academicYear && !years.some((item) => item.id === mode.grant.academicYear?.id)) {
      return [...years, { ...mode.grant.academicYear }];
    }
    return years;
  }, [editing, mode, options.data]);

  function change(next: GrantForm, field: GrantFormField) {
    setForm(next);
    setOffline(false);
    setErrors((current) => {
      if (!current[field]) return current;
      const { [field]: _cleared, ...rest } = current;
      const fieldsLeft = (Object.keys(rest) as Array<keyof GrantFormErrors>).some((key) => key !== 'form');
      return fieldsLeft ? rest : {};
    });
  }

  async function submit() {
    if (!form || saving) return;
    const found = validateGrantForm(form, today, keptValidUntil);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setOffline(false);
      requestAnimationFrame(() => focusFirstInvalidField(bodyRef.current));
      return;
    }
    setErrors({});
    setOffline(false);
    const body = grantRequest(form);
    try {
      if (mode.kind === 'edit') {
        await update.mutateAsync({ grantId: mode.grant.id as number, body: { ...body, expectedRevision: mode.grant.revision } });
        toast.success('Новые права действуют сразу', 'Изменения сохранены');
      } else {
        const request = { ...body, reissuedFromGrantId: mode.kind === 'reissue' ? mode.grant.id : null };
        const serialized = JSON.stringify(request);
        if (attempt.current?.body !== serialized) attempt.current = { body: serialized, key: crypto.randomUUID() };
        await create.mutateAsync({ body: request, idempotencyKey: attempt.current.key });
        toast.success('Права действуют сразу — учитель увидит данные в своих разделах', 'Доступ предоставлен');
      }
      onClose();
    } catch (error) {
      if (isConnectionFailure(error)) {
        setOffline(true);
        return;
      }
      const fields = serverGrantErrors(error);
      if (fields) {
        setErrors(fields);
        requestAnimationFrame(() => focusFirstInvalidField(bodyRef.current));
        return;
      }
      // 409: право изменили или отозвали в другом окне, учитель отключён. Показываем причину
      // сервера и перечитываем карточку — форма остаётся, чтобы не потерять выбор.
      if (error instanceof ApiError && error.status === 409) void client.invalidateQueries({ queryKey: keys.studyAccess });
      setErrors({ form: error instanceof Error ? error.message : 'Не удалось сохранить доступ' });
    }
  }

  const title = editing ? 'Изменить доступ' : 'Предоставить доступ';
  const submitLabel = offline ? 'Повторить' : editing ? 'Сохранить изменения' : 'Предоставить доступ';

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      title={title}
      subtitle={`${teacherName} · Учитель`}
      appearance="drawer"
      size="drawer"
      placement="right"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Отмена</Button>
          <Button loading={saving} disabled={!form} onClick={() => void submit()}>{submitLabel}</Button>
        </>
      }
    >
      {options.isPending ? (
        <LoadingBlock label="Загружаем учебные годы и классы…" />
      ) : options.isError || !form ? (
        <ErrorBlock
          message={options.error instanceof Error ? options.error.message : 'Не удалось загрузить учебные годы'}
          onRetry={() => void options.refetch()}
        />
      ) : (
        <div ref={bodyRef} className="flex flex-col gap-6">
          <StatusNotice tone="navy" icon={Eye}>
            <strong className="font-bold">Только просмотр.</strong> Учитель сможет открыть эти данные в своих
            разделах, но не сможет ставить или менять оценки, СОР/СОЧ, посещаемость и итоги. Роль, свои уроки
            и назначенные классы не меняются.
          </StatusNotice>

          {offline ? (
            <StatusNotice tone="invalid" icon={WifiOff}>
              <strong className="font-bold">Не удалось сохранить — нет связи с сервером.</strong>
              <span className="font-normal"> Выбор остался в форме, нажмите «Повторить».</span>
            </StatusNotice>
          ) : errors.form ? (
            <StatusNotice tone="invalid">{errors.form}</StatusNotice>
          ) : null}

          <Field label="Разделы" hint={errors.sections ? undefined : 'Можно выбрать один, несколько или все'} error={errors.sections}>
            <CheckCardGroup
              ariaLabel="Разделы"
              options={SECTION_OPTIONS}
              values={form.sections}
              onChange={(sections) => change({ ...form, sections }, 'sections')}
              disabled={saving}
            />
          </Field>

          <Field
            label="Учебный год"
            hint={errors.academicYearId ? undefined : 'Нужен другой год — выдайте отдельное право: классы разных лет не смешиваются'}
            error={errors.academicYearId}
          >
            <Select
              value={form.academicYearId ?? ''}
              disabled={saving}
              onChange={(event) => change(withYear(form, event.target.value ? Number(event.target.value) : null), 'academicYearId')}
            >
              {yearOptions.map((item) => (
                <option key={item.id} value={item.id}>{yearOptionLabel(item)}</option>
              ))}
            </Select>
          </Field>

          <Field label="Область доступа" error={errors.scope}>
            <div className="flex flex-col gap-3">
              <SegmentedTabs
                appearance="block"
                ariaLabel="Область доступа"
                value={form.scopeType}
                options={SCOPE_OPTIONS}
                onChange={(scopeType) => change(withScopeType(form, scopeType), 'scope')}
              />
              {form.scopeType === 'CLASSES' && (
                <MultiSelect
                  aria-label="Классы"
                  placeholder="Выберите классы"
                  emptyLabel="В этом учебном году нет классов"
                  disabled={saving}
                  error={Boolean(errors.scope)}
                  options={(year?.classes ?? []).map((item) => ({ value: String(item.id), label: withDemoMark(item.name ?? '', item.demo) }))}
                  value={form.classIds.map(String)}
                  onChange={(next) => change({ ...form, classIds: next.map(Number) }, 'scope')}
                />
              )}
              {form.scopeType === 'PARALLELS' && (
                <MultiSelect
                  aria-label="Параллели"
                  placeholder="Выберите параллели"
                  emptyLabel="В этом учебном году нет классов"
                  disabled={saving}
                  error={Boolean(errors.scope)}
                  options={(year?.parallels ?? []).map((item) => ({ value: item.grade ?? '', label: `${item.grade} параллель` }))}
                  value={form.parallels}
                  onChange={(next) => change({ ...form, parallels: next }, 'scope')}
                />
              )}
              {form.scopeType === 'SCHOOL' && (
                <StatusNotice tone="warning" icon={School}>
                  <strong className="font-bold">{schoolScopeNotice(year).lead}</strong>
                  {schoolScopeNotice(year).rest}
                </StatusNotice>
              )}
            </div>
          </Field>

          <Field label="Срок" error={errors.validUntil}>
            <div className="flex flex-col gap-3">
              <SegmentedTabs
                appearance="block"
                ariaLabel="Срок"
                value={form.term}
                options={TERM_OPTIONS}
                onChange={(term) => change({ ...form, term }, 'validUntil')}
              />
              {form.term === 'UNTIL' && (
                <TextInput
                  type="date"
                  aria-label="Действует до"
                  value={form.validUntil}
                  disabled={saving}
                  error={Boolean(errors.validUntil)}
                  onChange={(event) => change({ ...form, validUntil: event.target.value }, 'validUntil')}
                />
              )}
            </div>
          </Field>
        </div>
      )}
    </Modal>
  );
}
