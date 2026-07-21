import type { ComponentProps, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Minus, Plus } from 'lucide-react';
import { TextInput, TextArea, Select } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/format';
import type { TestStatus } from '@/lib/types';
import { useTestForm } from './modals/useTestForm';
import { VersionDecisionModal } from './modals/VersionDecisionModal';

function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function SuffixInput({ suffix, ...props }: { suffix: string } & ComponentProps<typeof TextInput>) {
  return (
    <div className="relative">
      <TextInput className="pr-14" {...props} />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        {suffix}
      </span>
    </div>
  );
}

function StatusToggle({ value, onChange }: { value: TestStatus; onChange: (v: TestStatus) => void }) {
  const options: { value: TestStatus; label: string }[] = [
    { value: 'DRAFT', label: 'Черновик' },
    { value: 'ACTIVE', label: 'Активен' },
  ];
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cx(
            'flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition',
            value === opt.value
              ? 'bg-white font-semibold text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-600',
          )}
        >
          {value === opt.value && <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function AttemptsStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-4 text-center text-sm font-semibold text-slate-800">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function RuleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

export function TestCreatePage() {
  const navigate = useNavigate();
  const f = useTestForm({
    active: true,
    test: null,
    aiTest: false,
    onSaved: (saved) => navigate(`/admissions/tests/${saved.id}`, { replace: true }),
  });

  function cancel() {
    navigate('/admissions?tab=tests');
  }

  return (
    <div>
      <Link
        to="/admissions?tab=tests"
        className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        К вступительным тестам
      </Link>

      <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
        Создать тест
      </h1>

      <form id="test-create-form" onSubmit={f.onSubmit} className="mt-6">
        {f.error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
            {f.error}
          </div>
        )}

        {f.activationViolations.length > 0 && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
            <p className="mb-2 font-medium">Тест нельзя активировать:</p>
            <ul className="list-inside list-disc space-y-1">
              {f.activationViolations.map((v, i) => (
                <li key={`${v.code}-${v.questionOrderIndex ?? 'g'}-${i}`}>{v.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card space-y-5 px-6 py-6 lg:col-span-2">
            <FormField label="Название теста">
              <TextInput
                autoFocus
                value={f.form.title}
                onChange={(e) => f.set('title', e.target.value)}
                placeholder="Например: Математика · 5 класс"
              />
            </FormField>

            <FormField label="Предмет" hint="Только активные предметы">
              <Select value={f.form.subjectId} onChange={(e) => f.set('subjectId', e.target.value)}>
                <option value="">Выберите предмет…</option>
                {f.subjectOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.status === 'HIDDEN' ? ' (скрыт)' : ''}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Класс поступления">
              <TextInput
                value={f.form.grade}
                onChange={(e) => f.set('grade', e.target.value)}
                placeholder="Например: 5 класс"
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Длительность">
                <SuffixInput
                  type="number"
                  min={1}
                  suffix="минут"
                  value={f.form.durationMinutes}
                  onChange={(e) => f.set('durationMinutes', e.target.value)}
                />
              </FormField>
              <FormField label="Минимальный балл">
                <TextInput
                  type="number"
                  min={0}
                  value={f.form.minScore}
                  onChange={(e) => f.set('minScore', e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Проходной процент" hint="Появится после того, как в тест добавят вопросы">
              <TextInput value="—" disabled className="bg-slate-50 text-slate-400" />
            </FormField>

            <FormField label="Инструкция">
              <TextArea
                value={f.form.rules}
                onChange={(e) => f.set('rules', e.target.value)}
                placeholder="Введите текст инструкции для поступающего…"
              />
            </FormField>

            <FormField label="Статус">
              <StatusToggle value={f.form.status} onChange={(v) => f.set('status', v)} />
            </FormField>
          </div>

          <div className="space-y-4">
            <div className="card px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Правила прохождения</p>
              <div className="mt-1 divide-y divide-slate-100">
                <RuleRow
                  label="Можно возвращаться к предыдущим вопросам"
                  checked={f.form.allowBackNavigation}
                  onChange={(v) => f.set('allowBackNavigation', v)}
                />
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm font-medium text-slate-700">Количество попыток</span>
                  <AttemptsStepper
                    value={Number(f.form.maxAttempts) || 1}
                    onChange={(v) => f.set('maxAttempts', String(v))}
                  />
                </div>
                <RuleRow
                  label="Перемешивать варианты ответов"
                  checked={f.form.shuffleOptions}
                  onChange={(v) => f.set('shuffleOptions', v)}
                />
                <RuleRow
                  label="Перемешивать вопросы"
                  checked={f.form.shuffleQuestions}
                  onChange={(v) => f.set('shuffleQuestions', v)}
                />
              </div>
            </div>

            <div className="flex gap-3 rounded-2xl bg-amber-50 px-4 py-4 ring-1 ring-amber-100">
              <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Подсказка</p>
                <p className="mt-1 text-sm text-amber-700">
                  Сначала создайте карточку теста и настройте правила прохождения. Вопросы будут
                  добавляться на следующем этапе.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card mt-6 flex items-center justify-end gap-3 px-6 py-4">
          <Button type="button" variant="secondary" onClick={cancel} disabled={f.pending}>
            Отмена
          </Button>
          <Button type="submit" loading={f.pending}>
            Сохранить тест
          </Button>
        </div>
      </form>

      <VersionDecisionModal
        open={f.decisionOpen}
        onClose={() => f.setDecisionOpen(false)}
        loading={f.pending}
        onChoose={(strategy) => void f.submit(strategy)}
      />
    </div>
  );
}
