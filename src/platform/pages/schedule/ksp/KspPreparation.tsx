import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { FilterChip } from '@/components/ui/FilterChip';
import { KeyValueList, type KeyValueRow } from '@/components/ui/KeyValueList';
import { StatusNotice } from '@/components/ui/StatusNotice';
import type { KspContext } from '@/lib/kspApi';
import {
  ORIGIN_LABEL,
  dateLabel,
  hasKtpValue,
  resolvePrepFields,
  type PrepErrors,
  type PrepForm,
  type TopicChoice,
} from '@/lib/kspModel';
import type { Lesson } from '@/lib/lessonsApi';
import { cx } from '@/lib/format';
import { hhmm } from '../lessonHistory';

/**
 * Подготовка генерации (Figma П1–П4, пояснение 2212:9600): данные урока с источниками, тема и
 * цели обучения, посещаемость, пожелания. Одна кнопка — «Сгенерировать КСП».
 *
 * * У каждого значения подписан источник: настройки школы, расписание, КТП.
 * * Нет КТП — раздел, тему и цели вводят руками (П2): официальные цели ИИ не придумывает.
 * * Темы КТП и урока расходятся (П4) — показываем обе, и выбирает учитель: правило «по
 *   фактической теме» из макета не утверждено (ТЗ, «Вопрос для согласования»).
 * * Пустые обязательные поля подсвечиваются после нажатия (П3), запрос не уходит.
 * * Посещаемость пустая, пока лист не опубликован, — нули не подставляем.
 */
export function KspPreparation({
  context,
  lesson,
  form,
  onChange,
  errors,
  submitted,
  submitting,
  submitError,
  blockedReason,
  onSubmit,
}: {
  context: KspContext;
  lesson: Lesson | undefined;
  form: PrepForm;
  onChange: (next: PrepForm) => void;
  errors: PrepErrors;
  /** Ошибки полей показываются только после первой попытки — пустая форма не должна кричать. */
  submitted: boolean;
  submitting: boolean;
  submitError: string | null;
  /** Почему генерацию не запустить (закрыт период, генерация выключена). */
  blockedReason: string | null;
  onSubmit: () => void;
}) {
  const set = <K extends keyof PrepForm>(field: K, value: PrepForm[K]) => onChange({ ...form, [field]: value });
  const shown = submitted ? errors : {};
  const manualTopic = !hasKtpValue(context, 'topic');
  const time = lesson?.startTime && lesson?.endTime ? `${hhmm(lesson.startTime)}–${hhmm(lesson.endTime)}` : null;

  const lessonRows: KeyValueRow[] = [
    {
      key: 'organization',
      label: 'Организация',
      value: context.organizationName || <span className="font-normal text-planning-subtle">Не указана в настройках школы</span>,
      aside: <SourceBadge tone="gray">из настроек школы</SourceBadge>,
    },
    {
      key: 'class',
      label: 'Класс и предмет',
      value: [context.className, context.subjectName].filter(Boolean).join(' · '),
      aside: <SourceBadge tone="gray">из расписания</SourceBadge>,
    },
    {
      key: 'date',
      label: 'Дата и длительность',
      value: [dateLabel(context.lessonDate), time, context.durationMinutes ? `${context.durationMinutes} мин` : null]
        .filter(Boolean).join(' · '),
      aside: <SourceBadge tone="gray">из расписания</SourceBadge>,
    },
    { key: 'teacher', label: 'Педагог', value: context.teacherName, aside: <SourceBadge tone="gray">из расписания</SourceBadge> },
  ];

  // При расхождении раздел и цели следуют за выбранной темой: у фактической темы они свои.
  const resolved = resolvePrepFields(context, form);
  const resolvedBadge = (origin: keyof typeof ORIGIN_LABEL) =>
    <SourceBadge tone={origin === 'KTP' ? 'navy' : 'gray'}>{ORIGIN_LABEL[origin]}</SourceBadge>;
  const ktpRows: KeyValueRow[] = [];
  if (hasKtpValue(context, 'section')) {
    ktpRows.push({ key: 'section', label: 'Раздел', value: resolved.section.value, aside: resolvedBadge(resolved.section.origin) });
  }
  if (!manualTopic) {
    ktpRows.push({
      key: 'topic',
      label: 'Тема урока',
      value: context.topicMismatch
        ? <TopicChoiceGroup context={context} value={form.topicChoice} invalid={Boolean(shown.topicChoice)}
          onChange={(choice) => set('topicChoice', choice)} />
        : context.ktp?.topic,
      aside: context.topicMismatch ? null : <SourceBadge>из КТП</SourceBadge>,
    });
  }
  if (hasKtpValue(context, 'learningObjectives')) {
    ktpRows.push({
      key: 'objectives', label: 'Цели обучения', value: resolved.learningObjectives.value,
      aside: resolvedBadge(resolved.learningObjectives.origin),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-8">
        <p className="text-sm text-planning-muted">
          Проверьте данные урока и добавьте пожелания. ИИ составит план по форме приказа №130.
        </p>

        <Block title="Данные урока">
          <KeyValueList rows={lessonRows} />
        </Block>

        <Block title="Тема и цели обучения">
          {ktpRows.length > 0 && <KeyValueList rows={ktpRows} />}
          {context.topicMismatch && (
            <StatusNotice tone="attention">
              Фактическая тема отличается от темы по КТП. Выберите, по какой теме составить КСП, и проверьте,
              подходят ли к ней цели обучения. КТП при этом не изменится.
            </StatusNotice>
          )}
          {shown.topicChoice && <p className="text-xs text-red-600">{shown.topicChoice}</p>}
          {!context.ktp && (
            <StatusNotice tone="attention">
              Тема урока не связана с КТП. Введите раздел, тему и цели обучения вручную: официальные цели обучения
              ИИ не придумывает.
            </StatusNotice>
          )}
          {!hasKtpValue(context, 'section') && (
            <Field label="Раздел" required error={shown.section}>
              <TextInput value={form.section} maxLength={500} error={Boolean(shown.section)}
                placeholder="Например: Раздел 2. Обыкновенные дроби"
                onChange={(event) => set('section', event.target.value)} />
            </Field>
          )}
          {manualTopic && (
            <Field label="Тема урока" required error={shown.topic}>
              <TextInput value={form.topic} maxLength={1000} error={Boolean(shown.topic)}
                placeholder="Например: Умножение обыкновенных дробей"
                onChange={(event) => set('topic', event.target.value)} />
            </Field>
          )}
          {!hasKtpValue(context, 'learningObjectives') && (
            <Field label="Цели обучения по учебной программе" required error={shown.learningObjectives}
              hint={shown.learningObjectives ? undefined : 'Код и формулировка из учебной программы'}>
              <TextArea value={form.learningObjectives} maxLength={8000} error={Boolean(shown.learningObjectives)}
                placeholder="Например: 5.1.2.4 выполнять умножение обыкновенных дробей"
                onChange={(event) => set('learningObjectives', event.target.value)} />
            </Field>
          )}
        </Block>

        <Block title="Посещаемость">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Присутствуют" error={shown.presentCount}>
              <TextInput inputMode="numeric" placeholder="—" value={form.presentCount} error={Boolean(shown.presentCount)}
                onChange={(event) => set('presentCount', event.target.value)} />
            </Field>
            <Field label="Отсутствуют" error={shown.absentCount}>
              <TextInput inputMode="numeric" placeholder="—" value={form.absentCount} error={Boolean(shown.absentCount)}
                onChange={(event) => set('absentCount', event.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-planning-muted">
            {context.presentCount == null && context.absentCount == null
              ? 'Урок ещё не проведён, посещаемость не отмечена. Укажите вручную или оставьте пустым: в документе поле останется незаполненным.'
              : 'Из опубликованной посещаемости урока. Числа здесь меняют только КСП, журнал посещаемости остаётся прежним.'}
          </p>
        </Block>

        <Block title="Пожелания к КСП">
          {(context.hints ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(context.hints ?? []).map((hint) => hint.id && (
                <FilterChip key={hint.id} appearance="check" label={hint.label ?? hint.id}
                  selected={form.hintIds.includes(hint.id)}
                  onClick={() => set('hintIds', form.hintIds.includes(hint.id as string)
                    ? form.hintIds.filter((id) => id !== hint.id)
                    : [...form.hintIds, hint.id as string])} />
              ))}
            </div>
          )}
          <Field label="Свои пожелания" hint="Необязательно. Пожелания не меняют обязательную структуру формы и цели обучения.">
            <TextArea value={form.wishes} maxLength={2000}
              placeholder="Например: больше задач из жизни, в конце урока — короткая самостоятельная работа"
              onChange={(event) => set('wishes', event.target.value)} />
          </Field>
        </Block>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-4">
        {(blockedReason || submitError) && (
          <p role="alert" className={cx('text-13', blockedReason ? 'text-planning-muted' : 'text-red-600')}>
            {blockedReason ?? submitError}
          </p>
        )}
        <Button loading={submitting} disabled={blockedReason != null} onClick={onSubmit}
          icon={<Sparkles className="size-4" aria-hidden="true" />}>
          Сгенерировать КСП
        </Button>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-bold uppercase text-planning-subtle">{title}</h3>
      {children}
    </section>
  );
}

export function SourceBadge({ tone = 'navy', children }: { tone?: 'navy' | 'gray' | 'amber'; children: ReactNode }) {
  return <Badge appearance="label" size="xs" tone={tone}>{children}</Badge>;
}

/** Две темы при расхождении (П4): учитель выбирает, по какой составить КСП. */
function TopicChoiceGroup({ context, value, invalid, onChange }: {
  context: KspContext;
  value: TopicChoice | null;
  invalid: boolean;
  onChange: (choice: TopicChoice) => void;
}) {
  const options: { choice: TopicChoice; prefix: string; topic: string | undefined }[] = [
    { choice: 'KTP', prefix: 'По КТП', topic: context.ktp?.topic },
    { choice: 'LESSON', prefix: 'Фактически', topic: context.lesson?.topic },
  ];
  return (
    <fieldset className="flex flex-col gap-1.5" aria-invalid={invalid || undefined}>
      <legend className="sr-only">Тема для КСП</legend>
      {options.map((option) => (
        <label key={option.choice} className="flex cursor-pointer items-start gap-2 font-normal">
          <input type="radio" name="ksp-topic" className="mt-1 accent-navy-700" checked={value === option.choice}
            onChange={() => onChange(option.choice)} />
          <span><span className="text-planning-muted">{option.prefix}:</span> <span className="font-medium">{option.topic}</span></span>
        </label>
      ))}
    </fieldset>
  );
}
