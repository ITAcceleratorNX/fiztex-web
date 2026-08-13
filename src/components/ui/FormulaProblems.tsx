import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { checkFormulas } from '@/lib/formulaChecks';
import { isChoiceType, type QuestionDraft } from '@/lib/testQuestions';

/**
 * Плашка «что проверить в формулах этого вопроса» (ТЗ §6: сомнительный фрагмент обязан быть
 * заметен учителю до публикации).
 *
 * <p>Считается по текущему содержимому полей, а не по `formulaIssues` из ответа сервера:
 * серверный список верен на момент чтения вопроса и устаревает после первой же правки, а
 * учителю нужно видеть, что его исправление подействовало. Блокирующее правило при этом
 * остаётся ровно одно и на сервере — активация теста проверяет текст заново.
 */
export function FormulaProblems({ question }: { question: QuestionDraft }) {
  const problems = useMemo(
    () =>
      checkFormulas([
        { where: 'Текст вопроса', text: question.text },
        ...(isChoiceType(question.type)
          ? question.options.map((option, index) => ({
              where: `Вариант ${index + 1}`,
              text: option.text,
            }))
          : []),
        { where: 'Эталонный ответ', text: question.referenceAnswer },
        { where: 'Критерии оценки', text: question.gradingCriteria },
      ]),
    [question],
  );

  if (problems.length === 0) return null;

  const blocking = problems.some((problem) => problem.severity === 'error');

  return (
    <div
      className={
        blocking
          ? 'mt-4 rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-100'
          : 'mt-4 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100'
      }
    >
      <p
        className={
          blocking
            ? 'flex items-center gap-1.5 text-13 font-semibold text-red-700'
            : 'flex items-center gap-1.5 text-13 font-semibold text-amber-800'
        }
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {blocking ? 'Формулы: исправьте до публикации' : 'Формулы: проверьте'}
      </p>
      <ul className={blocking ? 'mt-1.5 space-y-1 text-xs text-red-600' : 'mt-1.5 space-y-1 text-xs text-amber-800'}>
        {problems.map((problem, index) => (
          <li key={`${problem.where}-${index}`}>
            <span className="font-medium">{problem.where}:</span> {problem.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
