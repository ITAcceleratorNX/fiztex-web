import type { ReactNode } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextArea, TextInput } from '@/components/ui/Field';
import { SortableList } from '@/components/ui/SortableList';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { Tooltip } from '@/components/ui/Tooltip';
import type { KspTopicSource } from '@/lib/kspApi';
import {
  durationSummary,
  moveStage,
  newStage,
  stageErrors,
  type EditorDocument,
  type EditorErrors,
  type EditorStage,
} from '@/lib/kspModel';
import { cx } from '@/lib/format';
import { StagesHead } from './KspDocumentView';

/** Больше этапов сервер не примет (контракт §6). */
const MAX_STAGES = 20;

/**
 * Редактор КСП (Figma Р1–Р4, С3, Н3; компонент `КСП / Этап — редактор` 2212:8042): все поля
 * шапки приложения №4 и таблица «Ход урока». Этапы добавляют, удаляют и переставляют, меняют
 * текст и время; колонки удалить нельзя, последний этап — тоже.
 *
 * Состояние — у страницы: редактор только рисует и сообщает правки. Сумма времени считается
 * по живому вводу, а время само не перераспределяется (ТЗ).
 */
export function KspEditor({
  value,
  onChange,
  errors,
  lessonMinutes,
  ktp,
}: {
  value: EditorDocument;
  onChange: (next: EditorDocument) => void;
  errors: EditorErrors;
  lessonMinutes: number;
  /** Плановые значения КТП: у совпавших полей шапки — плашка «из КТП». */
  ktp?: KspTopicSource;
}) {
  const set = <K extends keyof EditorDocument>(field: K, next: EditorDocument[K]) => onChange({ ...value, [field]: next });
  const setStage = (index: number, patch: Partial<EditorStage>) =>
    set('stages', value.stages.map((stage, i) => (i === index ? { ...stage, ...patch } : stage)));
  const duration = durationSummary(value.stages, lessonMinutes);
  const fromKtp = (field: keyof KspTopicSource) =>
    Boolean(ktp?.[field]) && value[field].trim() === (ktp?.[field] ?? '').trim();

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-8">
      <header className="flex flex-col items-center gap-3">
        <TextInput aria-label="Наименование организации образования" placeholder="Наименование организации образования"
          value={value.organizationName} maxLength={300} className="max-w-xl text-center"
          onChange={(event) => set('organizationName', event.target.value)} />
        <h2 className="text-base font-bold text-ink">Краткосрочный (поурочный) план</h2>
      </header>

      <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
        <HeaderRow label="Раздел" badge={fromKtp('section')}>
          <TextInput aria-label="Раздел" value={value.section} maxLength={500}
            onChange={(event) => set('section', event.target.value)} />
        </HeaderRow>
        <HeaderRow label="ФИО педагога">
          <TextInput aria-label="ФИО педагога" value={value.teacherName} maxLength={200}
            onChange={(event) => set('teacherName', event.target.value)} />
        </HeaderRow>
        <HeaderRow label="Дата">
          <TextInput aria-label="Дата" type="date" value={value.lessonDate} className="max-w-xs"
            onChange={(event) => set('lessonDate', event.target.value)} />
        </HeaderRow>
        <HeaderRow label="Класс">
          <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
            <TextInput aria-label="Класс" value={value.className} maxLength={50} className="w-28"
              onChange={(event) => set('className', event.target.value)} />
            <CountInput label="Присутствующих" value={value.presentCount} error={errors['document.presentCount']}
              onChange={(next) => set('presentCount', next)} />
            <CountInput label="Отсутствующих" value={value.absentCount} error={errors['document.absentCount']}
              onChange={(next) => set('absentCount', next)} />
          </div>
        </HeaderRow>
        <HeaderRow label="Тема урока" error={errors['document.topic']}>
          <TextInput aria-label="Тема урока" value={value.topic} maxLength={1000} error={Boolean(errors['document.topic'])}
            onChange={(event) => set('topic', event.target.value)} />
        </HeaderRow>
        <HeaderRow label="Цели обучения в соответствии с учебной программой" badge={fromKtp('learningObjectives')}
          error={errors['document.learningObjectives']}>
          <TextArea aria-label="Цели обучения в соответствии с учебной программой" value={value.learningObjectives}
            maxLength={8000} error={Boolean(errors['document.learningObjectives'])}
            onChange={(event) => set('learningObjectives', event.target.value)} />
        </HeaderRow>
        <HeaderRow label="Цели урока" error={errors['document.lessonObjectives']}>
          <TextArea aria-label="Цели урока" value={value.lessonObjectives} maxLength={4000}
            error={Boolean(errors['document.lessonObjectives'])}
            onChange={(event) => set('lessonObjectives', event.target.value)} />
        </HeaderRow>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-base font-bold text-ink">Ход урока</h3>
          <p className={cx('text-13', duration.mismatch ? 'font-semibold text-attention-fg' : 'text-planning-muted')}>
            Время этапов: {duration.sum} мин из {duration.expected}
            {duration.incomplete && value.stages.length > 0 && ' · указано не у всех этапов'}
          </p>
        </div>
        {duration.mismatch && (
          <StatusNotice tone="attention">
            Сумма времени этапов — {duration.sum} мин, а урок длится {duration.expected} мин. Измените время этапов: сами мы его не меняем.
          </StatusNotice>
        )}
        {errors['document.stages'] && <p className="text-13 text-red-600">{errors['document.stages']}</p>}

        <div className="rounded-xl border border-slate-200">
          <div>
            <StagesHead grid="grid-cols-ksp-stages-edit" editable className="rounded-t-xl" />
            <SortableList
              items={value.stages}
              getKey={(stage) => stage.key}
              itemLabel={(index) => `этап ${index + 1}`}
              onMove={(from, to) => set('stages', moveStage(value.stages, from, to))}
              renderItem={({ item: stage, index, handle }) => {
                const stageError = stageErrors(errors, index);
                const label = (column: string) => `${column}, этап ${index + 1}`;
                return (
                  <div className="group grid grid-cols-ksp-stages-edit gap-3 border-t border-slate-200 bg-white px-2 py-3 transition hover:bg-slate-50">
                    <div className="pt-0.5">{handle}</div>
                    <div className="flex flex-col gap-2">
                      <TextArea density="compact" aria-label={label('Этап урока')} rows={3} value={stage.stage} maxLength={200}
                        error={Boolean(stageError.stage)} onChange={(event) => setStage(index, { stage: event.target.value })} />
                      <span className="flex items-center gap-2">
                        <TextInput density="compact" aria-label={label('Минут')} inputMode="numeric" value={stage.minutes}
                          className="w-20" error={Boolean(stageError.minutes)}
                          onChange={(event) => setStage(index, { minutes: event.target.value })} />
                        <span className="text-13 text-planning-muted">мин</span>
                      </span>
                      {(stageError.stage || stageError.minutes) && (
                        <p className="text-xs text-red-600">{stageError.stage ?? stageError.minutes}</p>
                      )}
                    </div>
                    <StageText label={label('Действия педагога')} value={stage.teacherActions}
                      onChange={(next) => setStage(index, { teacherActions: next })} />
                    <StageText label={label('Действия ученика')} value={stage.studentActions}
                      onChange={(next) => setStage(index, { studentActions: next })} />
                    <StageText label={label('Оценивание')} value={stage.assessment}
                      onChange={(next) => setStage(index, { assessment: next })} />
                    <StageText label={label('Ресурсы')} value={stage.resources}
                      onChange={(next) => setStage(index, { resources: next })} />
                    <div className="pt-0.5">
                      {value.stages.length > 1 && (
                        <Tooltip label="Удалить этап">
                          <button type="button" aria-label={`Удалить этап ${index + 1}`}
                            onClick={() => set('stages', value.stages.filter((_, i) => i !== index))}
                            className="flex size-7 items-center justify-center rounded-lg text-red-500 opacity-0 transition hover:bg-red-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 group-hover:opacity-100">
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                );
              }}
            />
          </div>
        </div>

        <Button variant="secondary" className="self-start" disabled={value.stages.length >= MAX_STAGES}
          onClick={() => set('stages', [...value.stages, newStage()])} icon={<Plus className="size-4" aria-hidden="true" />}>
          Добавить этап
        </Button>
      </section>
    </div>
  );
}

function HeaderRow({ label, badge, error, children }: { label: string; badge?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-ksp-header">
      <div className="flex flex-col items-start gap-1.5 bg-slate-50 px-4 py-3.5">
        <span className="text-13 font-semibold text-slate-600">{label}</span>
        {badge && <Badge appearance="label" size="xs" tone="navy">из КТП</Badge>}
      </div>
      <div className="flex min-w-0 flex-col gap-1 px-4 py-2">
        {children}
        {error && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="size-3.5" aria-hidden="true" />{error}
          </p>
        )}
      </div>
    </div>
  );
}

function CountInput({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (next: string) => void }) {
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <span className="text-13 text-planning-muted">{label}</span>
        <TextInput aria-label={label} inputMode="numeric" placeholder="—" value={value} className="w-24"
          error={Boolean(error)} onChange={(event) => onChange(event.target.value)} />
      </span>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

function StageText({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  return (
    <TextArea density="compact" aria-label={label} rows={6} value={value} maxLength={4000}
      onChange={(event) => onChange(event.target.value)} />
  );
}
