import { describe, expect, it } from 'vitest';
import {
  emptyQuestion,
  move,
  toRequest,
  validateQuestions,
  withCorrect,
  withType,
  type QuestionDraft,
} from './homeworkQuestionsModel';

function draft(overrides: Partial<QuestionDraft> = {}): QuestionDraft {
  return { ...emptyQuestion(), text: 'Вопрос', ...overrides };
}

function options(...marks: boolean[]) {
  return marks.map((correct, index) => ({
    localId: `o-${index}`,
    text: `Вариант ${index + 1}`,
    correct,
  }));
}

/**
 * Правила повторяют `HomeworkQuestionService.validate` на бэкенде — не ради дублирования,
 * а ради момента: кнопка «Сохранить» обязана объяснить, чего не хватает, до нажатия.
 * Если правила разъедутся, экран начнёт обещать успех там, где сервер откажет.
 */
describe('validateQuestions', () => {
  it('пустой текст не пропускает', () => {
    const problems = validateQuestions([draft({ text: '   ', options: options(true, false) })]);
    expect(problems.get(0)).toContain('Текст вопроса пустой');
  });

  it('у вопроса с одним ответом требует ровно один правильный вариант', () => {
    expect(
      validateQuestions([draft({ type: 'SINGLE_CHOICE', options: options(true, true) })]).get(0),
    ).toContain('Отметьте ровно один правильный вариант');

    expect(
      validateQuestions([draft({ type: 'SINGLE_CHOICE', options: options(false, false) })]).get(0),
    ).toContain('Отметьте ровно один правильный вариант');
  });

  it('у вопроса с несколькими ответами хватает одного правильного', () => {
    const problems = validateQuestions([
      draft({ type: 'MULTIPLE_CHOICE', options: options(true, true, false) }),
    ]);
    expect(problems.size).toBe(0);
  });

  it('меньше двух заполненных вариантов не пропускает', () => {
    const problems = validateQuestions([
      draft({
        type: 'SINGLE_CHOICE',
        options: [
          { localId: 'a', text: 'Единственный', correct: true },
          { localId: 'b', text: '   ', correct: false },
        ],
      }),
    ]);
    expect(problems.get(0)).toContain('Нужно минимум два варианта ответа');
  });

  /** У открытого вопроса вариантов нет — и правила о них к нему не применяются. */
  it('открытый вопрос без вариантов валиден', () => {
    const problems = validateQuestions([draft({ type: 'OPEN_TEXT', options: [] })]);
    expect(problems.size).toBe(0);
  });

  it('нулевой балл не пропускает', () => {
    const problems = validateQuestions([
      draft({ maxScore: 0, options: options(true, false) }),
    ]);
    expect(problems.get(0)).toContain('Балл за вопрос должен быть больше нуля');
  });
});

describe('withType', () => {
  it('переключение на открытый убирает варианты', () => {
    const next = withType(draft({ options: options(true, false) }), 'OPEN_TEXT');
    expect(next.options).toEqual([]);
  });

  /** Вопрос с единственным вариантом бессмыслен и всё равно не пройдёт проверку. */
  it('переключение на закрытый заводит два пустых варианта', () => {
    const next = withType(draft({ type: 'OPEN_TEXT', options: [] }), 'SINGLE_CHOICE');
    expect(next.options).toHaveLength(2);
    expect(next.options[0].correct).toBe(true);
  });

  it('уже имеющиеся варианты при смене закрытого типа сохраняются', () => {
    const existing = options(true, false, false);
    const next = withType(draft({ type: 'SINGLE_CHOICE', options: existing }), 'MULTIPLE_CHOICE');
    expect(next.options).toEqual(existing);
  });
});

describe('withCorrect', () => {
  it('у «одного ответа» отметка переезжает, а не добавляется', () => {
    const next = withCorrect(draft({ type: 'SINGLE_CHOICE', options: options(true, false) }), 1);
    expect(next.options.map((o) => o.correct)).toEqual([false, true]);
  });

  it('у «нескольких ответов» отметка переключается', () => {
    const next = withCorrect(draft({ type: 'MULTIPLE_CHOICE', options: options(true, false) }), 1);
    expect(next.options.map((o) => o.correct)).toEqual([true, true]);
  });
});

describe('move', () => {
  it('меняет соседей местами', () => {
    const list = [draft({ text: 'A' }), draft({ text: 'B' })];
    expect(move(list, 0, 1).map((q) => q.text)).toEqual(['B', 'A']);
  });

  it('за границами списка ничего не делает', () => {
    const list = [draft({ text: 'A' }), draft({ text: 'B' })];
    expect(move(list, 0, -1)).toBe(list);
    expect(move(list, 1, 1)).toBe(list);
  });
});

describe('toRequest', () => {
  it('обрезает пробелы и не шлёт пустые эталон и критерии', () => {
    const body = toRequest([
      draft({ text: '  Вопрос  ', referenceAnswer: '  ', gradingCriteria: '', options: options(true, false) }),
    ]);
    expect(body.questions?.[0].text).toBe('Вопрос');
    expect(body.questions?.[0].referenceAnswer).toBeUndefined();
    expect(body.questions?.[0].gradingCriteria).toBeUndefined();
  });

  /** У открытого вопроса вариантов не бывает — бэкенд на них ответит отказом. */
  it('у открытого вопроса вариантов не отправляет', () => {
    const body = toRequest([draft({ type: 'OPEN_TEXT', options: options(true, false) })]);
    expect(body.questions?.[0].options).toEqual([]);
  });
});
