import { ArrowLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { RadioCardGroup } from '@/components/ui/RadioCardGroup';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Select } from '@/components/ui/Select';
import { StatusNotice } from '@/components/ui/StatusNotice';
import type { AttestationPreview, AttestationSetting } from '@/lib/attestationSettingsApi';
import {
  earliestOption,
  fullDate,
  optionLabel,
  periodBefore,
  periodGenitive,
  periodTitle,
  previewProblem,
  RESULT_FORMAT_LABELS,
  scopeGenitive,
  scopeTitle,
  type AttestationForm,
  type PreviewProblem,
} from '@/lib/subjectAttestationModel';

export interface ClassOption {
  id: number;
  name: string;
  grade: string;
}

/**
 * Форма настройки аттестации (макеты А3 2224:1877, А6–А8, А10). Состояние живёт у окна предмета
 * (`SubjectEditModal`), здесь — поля и ответ предпросмотра словами.
 *
 * Доступные периоды начала, пересечения и мешающие итоги отвечает `preview` сервера; форма
 * ничего не высчитывает и не прячет: недопустимый период можно выбрать — под полем будет
 * объяснение и ближайший допустимый вариант одной кнопкой, как в макете А6.
 */
export function AttestationSettingForm({
  form,
  onChange,
  parallels,
  classes,
  settings,
  preview,
  previewPending,
  previewError,
  onRetryPreview,
  onBack,
  onEditConflict,
  disabled,
}: {
  form: AttestationForm;
  onChange: (patch: Partial<AttestationForm>) => void;
  parallels: string[];
  classes: ClassOption[];
  settings: readonly AttestationSetting[];
  preview: AttestationPreview | undefined;
  previewPending: boolean;
  previewError: string | null;
  onRetryPreview: () => void;
  onBack: () => void;
  onEditConflict: (setting: AttestationSetting) => void;
  disabled: boolean;
}) {
  const parallelClasses = classes.filter((item) => item.grade === form.parallel).map((item) => item.name);
  const problem = previewProblem(preview);
  const options = preview?.periods ?? [];
  const selectedPeriodId = form.effectiveFromPeriodId ?? preview?.effectiveFrom?.id ?? null;
  const scopeName = form.scope === 'PARALLEL'
    ? `${form.parallel ?? ''} параллель`
    : classes.find((item) => item.id === form.classId)?.name ?? 'класс';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button variant="link" size="inline" icon={<ArrowLeft className="size-4" />} onClick={onBack} disabled={disabled}
          className="font-semibold">
          К предмету
        </Button>
      </div>

      <Field label="Кому применить" required hint={form.scope === 'PARALLEL' && form.parallel
        ? `Классы: ${parallelClasses.length > 0 ? parallelClasses.join(', ') : 'в параллели нет действующих классов'}` : undefined}>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedTabs
            appearance="outlined"
            ariaLabel="Кому применить"
            value={form.scope}
            options={[{ value: 'PARALLEL', label: 'Параллель' }, { value: 'CLASS', label: 'Класс' }]}
            onChange={(scope) => onChange({ scope, effectiveFromPeriodId: null })}
          />
          <span className="w-56">
            {form.scope === 'PARALLEL' ? (
              <Select aria-label="Параллель" value={form.parallel ?? ''} disabled={disabled}
                onChange={(event) => onChange({ parallel: event.target.value || null, effectiveFromPeriodId: null })}>
                {!form.parallel && <option value="">Выберите параллель</option>}
                {parallels.map((grade) => <option key={grade} value={grade}>{grade} параллель</option>)}
              </Select>
            ) : (
              <Select aria-label="Класс" value={form.classId != null ? String(form.classId) : ''} disabled={disabled}
                onChange={(event) => onChange({ classId: event.target.value ? Number(event.target.value) : null, effectiveFromPeriodId: null })}>
                {form.classId == null && <option value="">Выберите класс</option>}
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            )}
          </span>
        </div>
      </Field>

      <Field label="Итоговая оценка" required>
        <RadioCardGroup
          ariaLabel="Итоговая оценка"
          value={form.resultFormat}
          disabled={disabled}
          onChange={(resultFormat) => onChange({ resultFormat })}
          options={[
            { value: 'NUMERIC', title: '10-балльная', badge: 'по умолчанию', description: 'Итог числом по порогам политики оценивания' },
            { value: 'PASS_FAIL', title: 'Зачёт / Незачёт', description: 'Система рекомендует по критериям школы, итог выбирает учитель' },
          ]}
        />
      </Field>

      <Field label="Период аттестации" required>
        <RadioCardGroup
          ariaLabel="Период аттестации"
          value={form.periodicity}
          disabled={disabled}
          onChange={(periodicity) => onChange({ periodicity, effectiveFromPeriodId: null })}
          options={[
            { value: 'QUARTER', title: 'Четверть', badge: 'по умолчанию', description: 'Итог в конце каждой четверти' },
            { value: 'HALF_YEAR', title: 'Полугодие', description: 'Итог в конце 2 и 4 четверти; в 1 и 3 — только текущие результаты' },
          ]}
        />
      </Field>

      <Field label="СОЧ" required>
        <RadioCardGroup
          ariaLabel="СОЧ"
          value={form.sochProvided ? 'YES' : 'NO'}
          disabled={disabled}
          onChange={(value) => onChange({ sochProvided: value === 'YES' })}
          options={[
            { value: 'YES', title: 'Предусмотрен', badge: 'по умолчанию', description: 'Без СОЧ итог за период не считается' },
            { value: 'NO', title: 'Не предусмотрен', description: 'Итог выставляется без СОЧ' },
          ]}
        />
      </Field>

      <Field label="Вступает в силу" required
        error={problem?.kind === 'PERIOD' ? 'С этого периода начать нельзя — причина ниже' : undefined}
        hint={problem?.kind === 'PERIOD' ? undefined : `Ближайший период, который ещё не начался.${form.periodicity === 'HALF_YEAR'
          ? ' Полугодие начинается только с первой четверти своего полугодия.' : ''}`}>
        <span className="block w-80">
          <Select
            aria-label="Вступает в силу"
            value={selectedPeriodId != null ? String(selectedPeriodId) : ''}
            disabled={disabled || options.length === 0}
            onChange={(event) => onChange({ effectiveFromPeriodId: Number(event.target.value) })}
          >
            {options.length === 0 && <option value="">{previewPending ? 'Загрузка периодов…' : 'Нет периодов'}</option>}
            {options.map((option) => (
              <option key={option.period?.id} value={option.period?.id}>
                {optionLabel(option)}{option.available ? '' : ' — недоступен'}
              </option>
            ))}
          </Select>
        </span>
      </Field>

      {previewError ? (
        <StatusNotice tone="error">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>{previewError}</span>
            <Button variant="secondary" size="sm" onClick={onRetryPreview}>Повторить</Button>
          </span>
        </StatusNotice>
      ) : problem ? (
        <ProblemNotice problem={problem} preview={preview} form={form} scopeName={scopeName}
          onChoose={(periodId) => onChange({ effectiveFromPeriodId: periodId })} onEditConflict={onEditConflict} />
      ) : preview?.effectiveFrom ? (
        <ScheduleNotice preview={preview} scopeName={scopeName} settings={settings} />
      ) : null}
    </div>
  );
}

/** Отказ сервера словами и действие, которое его снимает (А6, А7, А8). */
function ProblemNotice({ problem, preview, form, scopeName, onChoose, onEditConflict }: {
  problem: PreviewProblem;
  preview: AttestationPreview | undefined;
  form: AttestationForm;
  scopeName: string;
  onChoose: (periodId: number) => void;
  onEditConflict: (setting: AttestationSetting) => void;
}) {
  if (problem.kind === 'PERIOD') {
    const earliest = earliestOption(preview);
    return (
      <StatusNotice tone="error">
        <span className="flex flex-col items-start gap-3">
          <span>
            <strong>{problem.option.message}.</strong>
            {earliest ? ` Ближайший доступный период — ${periodTitle(earliest.period)}, с ${fullDate(earliest.period?.startDate)}.` : ''}
          </span>
          {earliest?.period?.id != null && (
            <Button variant="secondary" size="sm" onClick={() => onChoose(earliest.period!.id!)}>
              Выбрать {periodTitle(earliest.period)}
            </Button>
          )}
        </span>
      </StatusNotice>
    );
  }
  if (problem.kind === 'NO_PERIOD') {
    return (
      <StatusNotice tone="error">
        В этом учебном году не осталось периода, с которого настройка могла бы вступить в силу.
      </StatusNotice>
    );
  }
  if (problem.kind === 'OVERLAP') {
    const other = scopeTitle(problem.conflict);
    const otherGenitive = scopeGenitive(problem.conflict);
    return (
      <StatusNotice tone="error">
        <span className="flex flex-col items-start gap-3">
          <span>
            <strong>
              {form.scope === 'CLASS'
                ? `Для ${scopeName} уже действует настройка ${otherGenitive}.`
                : `Для класса ${problem.conflict.className} этой параллели уже есть своя настройка.`}
            </strong>
            {' '}Класс и его параллель не могут иметь разные настройки в одном периоде.
            {form.scope === 'CLASS'
              ? ' Измените настройку всей параллели или выберите период, когда настройка параллели уже закончится.'
              : ' Измените настройку класса или выберите период, когда она уже закончится.'}
          </span>
          <Button variant="secondary" size="sm" onClick={() => onEditConflict(problem.conflict)}>
            Изменить настройку {problem.conflict.parallel ? otherGenitive : other}
          </Button>
        </span>
      </StatusNotice>
    );
  }
  const from = preview?.effectiveFrom ? periodTitle(preview.effectiveFrom) : null;
  return (
    <StatusNotice tone="error">
      <strong>
        {from ? `С ${periodGenitive(from)}` : 'В этих периодах'}
        {problem.classNames.length > 0 ? ` у ${problem.classNames.join(' и ')}` : ''} уже есть итоги в прежнем формате
        ({problem.count}).
      </strong>
      {' '}Сохранение изменило бы их форму, поэтому система его не выполнит. Выберите более поздний период или
      сначала разберите эти итоги в журнале.
    </StatusNotice>
  );
}

/** Предупреждение «со следующего периода» и что станет с действующей версией (А3). */
function ScheduleNotice({ preview, scopeName, settings }: {
  preview: AttestationPreview; scopeName: string; settings: readonly AttestationSetting[];
}) {
  const from = preview.effectiveFrom!;
  const ending = settings.find((setting) => setting.id === preview.endsSettingId) ?? null;
  const replaced = settings.filter((setting) => preview.replacesSettingIds?.includes(setting.id ?? -1));
  const lastBefore = periodBefore(preview, from.id);
  return (
    <div className="flex flex-col gap-2">
      <StatusNotice tone="warning">
        <strong>Изменения действуют с {periodGenitive(periodTitle(from))} ({fullDate(from.startDate)}).</strong>
        {' '}Уже выставленные результаты не изменятся, до этого {scopeName} аттестуется по действующей настройке.
      </StatusNotice>
      {ending && (
        <p className="flex items-start gap-2 text-13 text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Действующая настройка {scopeGenitive(ending)} ({RESULT_FORMAT_LABELS[ending.resultFormat ?? 'NUMERIC']}) закончится
          {lastBefore ? ` после ${periodGenitive(lastBefore)}` : ` перед ${periodGenitive(periodTitle(from))}`}.
        </p>
      )}
      {replaced.length > 0 && (
        <p className="flex items-start gap-2 text-13 text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Запланированная настройка {replaced.map((setting) => `${scopeTitle(setting)} с ${periodGenitive(periodTitle(setting.effectiveFrom))}`).join(', ')}
          {' '}будет заменена этой.
        </p>
      )}
    </div>
  );
}
