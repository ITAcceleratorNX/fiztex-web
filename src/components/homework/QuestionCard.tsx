import { ArrowDown, ArrowUp, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import type { FormulaProfile } from '@/lib/formulaProfiles';
import { FormulaField } from '@/components/ui/FormulaField';
import { AiGeneratedBadge } from '@/components/ui/AiGeneratedBadge';
import { QuestionImagePicker, type QuestionImage } from '@/components/ui/QuestionImagePicker';
import { QuestionFigure } from '@/components/ui/QuestionFigure';
import { AiJobProgress } from '@/components/ui/AiJobProgress';
import { checkFormulas } from '@/lib/formulaChecks';
import {
  QUESTION_TYPES, QUESTION_TYPE_LABELS, isChoiceType, newLocalId, withCorrect, withType,
  type HomeworkQuestionType, type QuestionDraft,
} from '@/pages/homework/homeworkQuestionsModel';

export function QuestionCard({
  question,
  profile = 'GENERAL',
  index,
  total,
  readOnly,
  messages,
  regenerating,
  onChange,
  onRemove,
  onMove,
  onRegenerate,
  onUploadImage,
  onImageBusyChange,
}: {
  question: QuestionDraft;
  profile?: FormulaProfile;
  index: number;
  total: number;
  readOnly: boolean;
  messages: string[];
  regenerating?: Parameters<typeof AiJobProgress>[0]['job'];
  onChange: (next: QuestionDraft) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  onRegenerate?: () => void;
  onUploadImage?: (file: File) => Promise<QuestionImage>;
  onImageBusyChange?: (busy: boolean) => void;
}) {
  const invalid = messages.length > 0;
  const formulaProblems = checkFormulas([
    { where: 'Текст вопроса', text: question.text },
    ...(isChoiceType(question.type)
      ? question.options.map((option, i) => ({ where: `Вариант ${i + 1}`, text: option.text }))
      : []),
    { where: 'Эталонный ответ', text: question.referenceAnswer },
    { where: 'Критерии оценки', text: question.gradingCriteria },
  ]);

  return (
    <div
      className={
        invalid
          ? 'min-w-0 rounded-2xl border border-red-300 bg-red-50/40 p-4 sm:p-6'
          : 'min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6'
      }
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">Вопрос {index + 1}</span>
          {question.aiGenerated && <AiGeneratedBadge />}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              aria-label="Выше"
              className="rounded-lg p-2.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              aria-label="Ниже"
              className="rounded-lg p-2.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30"
            >
              <ArrowDown className="size-4" />
            </button>
            {onRegenerate && <>{/* Кнопка не про происхождение вопроса, а про «этот мне не нравится», —
                поэтому есть и у написанного руками. */}
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating != null}
              aria-label="Заменить вопрос"
              title="Заменить вопрос другим"
              className="rounded-lg p-2.5 text-slate-500 transition hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30"
            >
              <RefreshCw className="size-4" />
            </button></>}
            <button
              type="button"
              onClick={onRemove}
              aria-label="Удалить вопрос"
              className="rounded-lg p-2.5 text-slate-500 transition hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>

      {regenerating && <AiJobProgress job={regenerating} className="mb-4" />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Тип вопроса" className="sm:col-span-2">
          <Select
            value={question.type}
            disabled={readOnly}
            onChange={(event) => onChange(withType(question, event.target.value as HomeworkQuestionType))}
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Балл за вопрос">
          <TextInput
            type="number"
            min={0.5}
            step={0.5}
            disabled={readOnly}
            value={question.maxScore}
            onChange={(event) => onChange({ ...question, maxScore: Number(event.target.value) })}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Текст вопроса" required>
          <FormulaField
            profile={profile}
            disabled={readOnly}
            value={question.text}
            onChange={(text) => onChange({ ...question, text })}
            placeholder="Сформулируйте вопрос"
            ariaLabel={`Текст вопроса ${index + 1}`}
          />
        </Field>
      </div>

      {onUploadImage ? <QuestionImagePicker imageUrl={question.imageUrl} disabled={readOnly}
        onUpload={onUploadImage} onBusyChange={onImageBusyChange}
        onChange={image => onChange({ ...question, imageId: image.imageId, imageUrl: image.imageUrl })} />
        : <QuestionFigure imageUrl={question.imageUrl} />}

      {isChoiceType(question.type) && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700">Варианты ответа</p>
            {!readOnly && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus className="size-4" />}
                disabled={question.options.length >= 10}
                onClick={() =>
                  onChange({
                    ...question,
                    options: [
                      ...question.options,
                      { localId: newLocalId(), text: '', correct: false },
                    ],
                  })
                }
              >
                Добавить вариант
              </Button>
            )}
          </div>
          <p className="text-13 text-muted">{question.type === 'SINGLE_CHOICE' ? 'Отметьте один правильный ответ.' : 'Отметьте все правильные ответы.'}</p>
          {question.options.map((option, optionIndex) => (
            <div key={option.localId} className="flex items-start gap-2">
              <input
                type={question.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                checked={option.correct}
                disabled={readOnly}
                onChange={() => onChange(withCorrect(question, optionIndex))}
                className="mt-3 size-5 shrink-0 accent-brand-500"
                aria-label={`Вариант ${optionIndex + 1} правильный`}
              />
              <div className="min-w-0 flex-1">
                <FormulaField
            profile={profile}
                  disabled={readOnly}
                  multiline={false}
                  value={option.text}
                  onChange={(text) =>
                    onChange({
                      ...question,
                      options: question.options.map((o, i) =>
                        i === optionIndex ? { ...o, text } : o,
                      ),
                    })
                  }
                  placeholder={`Вариант ${optionIndex + 1}`}
                  ariaLabel={`Вариант ${optionIndex + 1}`}
                />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...question,
                      options: question.options.filter((_, i) => i !== optionIndex),
                    })
                  }
                  disabled={question.options.length <= 2}
                  aria-label={`Удалить вариант ${optionIndex + 1}`}
                  className="mt-1 rounded-lg p-2.5 text-slate-500 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {question.type === 'OPEN_TEXT' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Эталонный ответ" hint="Ученику не показывается" className="min-w-0">
            <FormulaField
            profile={profile}
              disabled={readOnly}
              value={question.referenceAnswer}
              onChange={(referenceAnswer) => onChange({ ...question, referenceAnswer })}
              placeholder="По нему вы будете проверять работу"
              ariaLabel="Эталонный ответ"
            />
          </Field>
          <Field label="Критерии оценки" hint="Их использует подсказка ИИ" className="min-w-0">
            <FormulaField
            profile={profile}
              disabled={readOnly}
              value={question.gradingCriteria}
              onChange={(gradingCriteria) => onChange({ ...question, gradingCriteria })}
              placeholder="За что снижать балл"
              ariaLabel="Критерии оценки"
            />
          </Field>

          {/*
            Решение задачи по физике — это выкладки и чертёж, а не абзац текста: набирать
            такое на телефоне ученик не станет. Галочка на вопросе, а не на задании,
            потому что в одном тесте бывает и «дайте определение», и «решите задачу».
          */}
          <div className="sm:col-span-2 flex flex-wrap items-center gap-4 rounded-xl bg-neutral-bg px-3 py-3">
            <label className="flex items-center gap-2 text-13 text-ink">
              <input
                type="checkbox"
                checked={question.allowPhoto}
                disabled={readOnly}
                onChange={(event) =>
                  onChange({ ...question, allowPhoto: event.target.checked })
                }
                className="size-4 shrink-0 accent-brand-500"
              />
              Разрешить фото решения
            </label>
            {question.allowPhoto && (
              <label className="flex items-center gap-2 text-13 text-muted">
                Не больше
                <TextInput
                  type="number"
                  min={1}
                  max={5}
                  value={String(question.maxPhotos)}
                  disabled={readOnly}
                  onChange={(event) =>
                    onChange({ ...question, maxPhotos: Number(event.target.value) })
                  }
                  className="w-16"
                  aria-label="Сколько фотографий можно приложить"
                />
                шт.
              </label>
            )}
          </div>
        </div>
      )}

      {formulaProblems.length > 0 && (
        <ul className="mt-4 list-inside list-disc space-y-1 text-xs text-amber-700">
          {formulaProblems.map((problem) => (
            <li key={`${problem.where}-${problem.message}`}>
              {problem.where}: {problem.message}
            </li>
          ))}
        </ul>
      )}

      {invalid && (
        <ul className="mt-4 list-inside list-disc space-y-1 text-xs text-red-600">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
