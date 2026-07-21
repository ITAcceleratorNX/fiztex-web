import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import type { Test, TestStatus } from '@/lib/types';
import { VersionDecisionModal } from './VersionDecisionModal';
import { useTestForm } from './useTestForm';

export function TestFormModal({
  open,
  onClose,
  test,
  aiTest = false,
}: {
  open: boolean;
  onClose: () => void;
  test: Test | null;
  /** When true, creates/updates an AI test (useAiGeneration=true). */
  aiTest?: boolean;
}) {
  const f = useTestForm({ active: open, test, aiTest, onSaved: onClose });

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={f.isEdit ? 'Редактировать тест' : aiTest ? 'Новый AI-тест' : 'Новый вступительный тест'}
        subtitle={
          aiTest
            ? 'Тест по учебным материалам с генерацией вопросов через AI.'
            : 'Создайте карточку теста и добавьте вопросы вручную. Для тестов по материалам с AI используйте раздел «AI-тесты».'
        }
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={f.pending}>
              Отмена
            </Button>
            <Button form="test-form" type="submit" loading={f.pending}>
              {f.isEdit ? 'Сохранить' : 'Создать тест'}
            </Button>
          </>
        }
      >
        <form id="test-form" onSubmit={f.onSubmit} className="space-y-5">
          {f.error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              {f.error}
            </div>
          )}

          {f.activationViolations.length > 0 && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              <p className="mb-2 font-medium">Тест нельзя активировать:</p>
              <ul className="list-inside list-disc space-y-1">
                {f.activationViolations.map((v, i) => (
                  <li key={`${v.code}-${v.questionOrderIndex ?? 'g'}-${i}`}>{v.message}</li>
                ))}
              </ul>
            </div>
          )}

          {f.form.status === 'ACTIVE' && (test?.questionCount ?? 0) === 0 && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">
              Добавьте хотя бы один вопрос, чтобы активировать тест.
            </div>
          )}

          <Field label="Название теста" required>
            <TextInput
              autoFocus
              value={f.form.title}
              onChange={(e) => f.set('title', e.target.value)}
              placeholder="Например: Математика · 5 класс"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Предмет" required hint="Только активные предметы">
              <Select value={f.form.subjectId} onChange={(e) => f.set('subjectId', e.target.value)}>
                <option value="">Выберите предмет…</option>
                {f.subjectOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.status === 'HIDDEN' ? ' (скрыт)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Класс" required hint={aiTest ? 'Для кого предназначен тест' : 'Произвольное значение'}>
              <TextInput
                value={f.form.grade}
                onChange={(e) => f.set('grade', e.target.value)}
                placeholder={aiTest ? 'Например: 8 класс' : 'Например: 5 класс'}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Длительность (мин)" required>
              <TextInput
                type="number"
                min={1}
                value={f.form.durationMinutes}
                onChange={(e) => f.set('durationMinutes', e.target.value)}
              />
            </Field>
            <Field label="Минимальный балл" required>
              <TextInput
                type="number"
                min={0}
                value={f.form.minScore}
                onChange={(e) => f.set('minScore', e.target.value)}
              />
            </Field>
            <Field label="Статус" required>
              <Select value={f.form.status} onChange={(e) => f.set('status', e.target.value as TestStatus)}>
                <option value="DRAFT">Черновик</option>
                <option value="ACTIVE">Активен</option>
              </Select>
            </Field>
          </div>

          <Field
            label="Инструкция"
            hint="Показывается перед началом теста (в будущих scope). Необязательно."
          >
            <TextArea
              value={f.form.rules}
              onChange={(e) => f.set('rules', e.target.value)}
              placeholder="Инструкция для поступающего"
            />
          </Field>

          <div>
            <p className="label-base">Базовые правила прохождения</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Toggle
                checked={f.form.allowBackNavigation}
                onChange={(v) => f.set('allowBackNavigation', v)}
                label="Можно возвращаться назад"
              />
              <Field label="Количество попыток">
                <TextInput
                  type="number"
                  min={1}
                  value={f.form.maxAttempts}
                  onChange={(e) => f.set('maxAttempts', e.target.value)}
                />
              </Field>
              <Toggle
                checked={f.form.shuffleQuestions}
                onChange={(v) => f.set('shuffleQuestions', v)}
                label="Перемешивать вопросы"
              />
              <Toggle
                checked={f.form.shuffleOptions}
                onChange={(v) => f.set('shuffleOptions', v)}
                label="Перемешивать варианты ответов"
              />
            </div>
          </div>
        </form>
      </Modal>

      <VersionDecisionModal
        open={f.decisionOpen}
        onClose={() => f.setDecisionOpen(false)}
        loading={f.pending}
        onChoose={(strategy) => void f.submit(strategy)}
      />
    </>
  );
}
