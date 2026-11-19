import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import {
  useAdminAcademicYears,
  useAdminYearClasses,
  useAttestationPreview,
  useAttestationSettings,
  useSaveAttestationSetting,
  useSaveSchoolSubject,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { AttestationSetting } from '@/lib/attestationSettingsApi';
import { FORMULA_PROFILES, type FormulaProfile } from '@/lib/formulaProfiles';
import {
  changeRows,
  classesCaption,
  fullDate,
  initialForm,
  parallelsOf,
  periodGenitive,
  periodTitle,
  previewProblem,
  toRequest,
  type AttestationForm,
} from '@/lib/subjectAttestationModel';
import type { SchoolSubject } from '../../types';
import { AttestationConfirmDialog } from './AttestationConfirmDialog';
import { AttestationSettingForm, type ClassOption } from './AttestationSettingForm';
import { SubjectAttestationSection } from './SubjectAttestationSection';

/** Отказ без ответа сервера — связь, а не правило: форма остаётся, кнопка повторяет. */
function isNetworkFailure(failure: unknown): boolean {
  return !(failure instanceof ApiError) || failure.status === 0 || failure.status >= 500;
}

/**
 * Окно предмета: «Создать / Редактировать предмет» и внутри него — «Настройка аттестации»
 * (макеты А2–А10). Одно окно, а не два: настройка открывается вместо полей предмета со ссылкой
 * «← К предмету» и возвращается туда же после сохранения (А5), так что администратор не теряет
 * место, откуда пришёл.
 */
export function SubjectEditModal({ open, subject, onClose }: {
  open: boolean;
  /** `null` — создание предмета: настраивать аттестацию ещё не у чего. */
  subject: SchoolSubject | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const saveSubject = useSaveSchoolSubject();
  const [name, setName] = useState('');
  const [formulaProfile, setFormulaProfile] = useState<FormulaProfile>('GENERAL');
  const [formError, setFormError] = useState<string | null>(null);

  const years = useAdminAcademicYears(open && subject != null);
  const yearOptions = useMemo(() => (years.data ?? [])
    .filter((year): year is typeof year & { id: number } => year.id != null)
    .map((year) => ({ id: year.id, name: year.name ?? '', active: year.status === 'ACTIVE' })), [years.data]);
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYearId = yearId ?? yearOptions.find((year) => year.active)?.id ?? yearOptions[0]?.id ?? null;
  const yearName = yearOptions.find((year) => year.id === effectiveYearId)?.name ?? '';

  const [view, setView] = useState<'subject' | 'attestation'>('subject');
  const classesQuery = useAdminYearClasses(view === 'attestation' ? effectiveYearId : null);
  const classes: ClassOption[] = useMemo(() => (classesQuery.data ?? [])
    .map((item) => ({ id: item.id as number, name: item.name ?? '', grade: item.grade ?? '' })), [classesQuery.data]);
  const parallels = useMemo(() => parallelsOf(classes), [classes]);
  const [form, setForm] = useState<AttestationForm>(() => initialForm(null, null));
  const settings = useAttestationSettings(view === 'attestation' ? effectiveYearId : null, subject?.id ?? null);

  const body = view === 'attestation' && effectiveYearId != null && subject
    ? toRequest(form, effectiveYearId, subject.id) : null;
  const preview = useAttestationPreview(body);
  const saveSetting = useSaveAttestationSetting();
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(subject?.name ?? '');
    setFormulaProfile(subject?.formulaProfile ?? 'GENERAL');
    setFormError(null);
    setView('subject');
    setYearId(null);
    setConfirmOpen(false);
  }, [open, subject]);

  // Параллель по умолчанию — первая из классов года, когда они загрузились.
  useEffect(() => {
    if (view === 'attestation' && form.scope === 'PARALLEL' && !form.parallel && parallels.length > 0) {
      setForm((current) => ({ ...current, parallel: parallels[0] }));
    }
  }, [view, form.scope, form.parallel, parallels]);

  function openForm(base: AttestationSetting | null) {
    setForm(initialForm(base, parallels[0] ?? null));
    setView('attestation');
  }

  async function onSubmitSubject(event?: FormEvent) {
    event?.preventDefault();
    setFormError(null);
    try {
      await saveSubject.mutateAsync({ id: subject?.id, name, formulaProfile });
      toast.success(subject ? 'Предмет обновлён' : 'Предмет создан');
      onClose();
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Ошибка сохранения');
    }
  }

  async function saveAttestation() {
    if (!body) return;
    try {
      const saved = await saveSetting.mutateAsync({ ...body, effectiveFromPeriodId: body.effectiveFromPeriodId ?? preview.data?.effectiveFrom?.id });
      setConfirmOpen(false);
      setView('subject');
      toast.success(
        `Вступит в силу с ${periodGenitive(periodTitle(saved.effectiveFrom))} (${fullDate(saved.effectiveFrom?.startDate)}).`,
        'Настройка сохранена',
      );
    } catch (failure) {
      setConfirmOpen(false);
      if (isNetworkFailure(failure)) {
        toast.error('Нет связи с сервером. Параметры остались в форме, повторите попытку.', 'Не удалось сохранить настройку');
      } else {
        // Правило изменилось между предпросмотром и сохранением — показываем свежий ответ под формой.
        toast.error((failure as ApiError).message, 'Не удалось сохранить настройку');
        void preview.refetch();
      }
    }
  }

  const problem = previewProblem(preview.data);
  const previewError = preview.isError && !preview.data
    ? preview.error instanceof ApiError && preview.error.status > 0 && preview.error.status < 500
      ? preview.error.message
      : 'Не удалось проверить настройку: нет связи с сервером.'
    : null;
  const canSave = Boolean(body && preview.data?.canSave && !preview.isFetching && !previewError);
  const scopeCaption = form.scope === 'PARALLEL'
    ? `${form.parallel} параллель: ${classesCaption(classes.filter((item) => item.grade === form.parallel).map((item) => item.name))}`
    : classes.find((item) => item.id === form.classId)?.name ?? '';
  const ending = (settings.data ?? []).find((setting) => setting.id === preview.data?.endsSettingId) ?? null;
  const from = preview.data?.effectiveFrom;
  const subtitle = `${subject?.name ?? ''} · ${yearName} учебный год`;

  if (view === 'attestation' && subject && effectiveYearId != null) {
    return (
      <>
        <Modal
          open={open}
          size="lg"
          title="Настройка аттестации"
          subtitle={subtitle}
          onClose={() => { if (!saveSetting.isPending) onClose(); }}
          footer={(
            <div className="flex justify-end gap-3">
              <Button variant="secondary" disabled={saveSetting.isPending} onClick={() => setView('subject')}>Отмена</Button>
              <Button disabled={!canSave || problem != null} loading={saveSetting.isPending} onClick={() => setConfirmOpen(true)}>
                Сохранить настройку
              </Button>
            </div>
          )}
        >
          <AttestationSettingForm
            form={form}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            parallels={parallels}
            classes={classes}
            settings={settings.data ?? []}
            preview={preview.data}
            previewPending={preview.isPending}
            previewError={previewError}
            onRetryPreview={() => void preview.refetch()}
            onBack={() => setView('subject')}
            onEditConflict={(conflict) => setForm({ ...initialForm(conflict, null), effectiveFromPeriodId: null })}
            disabled={saveSetting.isPending}
          />
        </Modal>
        <AttestationConfirmDialog
          open={confirmOpen}
          subtitle={subtitle}
          rows={changeRows(form, scopeCaption,
            from ? `С ${periodGenitive(periodTitle(from))}, ${fullDate(from.startDate)}` : '—', ending)}
          effectiveFromName={from ? periodTitle(from) : null}
          busy={saveSetting.isPending}
          onBack={() => setConfirmOpen(false)}
          onConfirm={() => void saveAttestation()}
        />
      </>
    );
  }

  return (
    <Modal
      open={open}
      size={subject ? 'lg' : 'md'}
      onClose={() => { if (!saveSubject.isPending) onClose(); }}
      title={subject ? 'Редактировать предмет' : 'Создать предмет'}
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saveSubject.isPending}>Отмена</Button>
          <Button onClick={() => void onSubmitSubject()} loading={saveSubject.isPending}>Сохранить</Button>
        </div>
      )}
    >
      <form onSubmit={(event) => void onSubmitSubject(event)} className="flex flex-col gap-4">
        <Field label="Название" required>
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Профиль формул">
          <Select value={formulaProfile} onChange={(event) => setFormulaProfile(event.target.value as FormulaProfile)}>
            {Object.entries(FORMULA_PROFILES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        {formError && <p className="text-sm text-red-500">{formError}</p>}
      </form>
      {subject && (
        years.isError ? (
          <p className="mt-5 border-t border-line pt-5 text-13 text-danger-fg">
            Не удалось загрузить учебные годы — настройки аттестации недоступны.{' '}
            <Button variant="link" size="text" onClick={() => void years.refetch()}>Повторить</Button>
          </p>
        ) : effectiveYearId != null ? (
          <div className="mt-5">
            <SubjectAttestationSection
              subjectId={subject.id}
              subjectName={subject.name}
              years={yearOptions}
              yearId={effectiveYearId}
              onChangeYear={setYearId}
              onAdd={() => openForm(null)}
              onEdit={(setting) => openForm(setting)}
            />
          </div>
        ) : years.isPending ? (
          <div className="mt-5 h-28 animate-pulse rounded-xl bg-slate-100" aria-busy="true" aria-label="Загрузка учебных годов" />
        ) : (
          <p className="mt-5 border-t border-line pt-5 text-13 text-muted">
            В школе нет действующего учебного года — итоговую аттестацию настроить не для чего.
          </p>
        )
      )}
    </Modal>
  );
}
