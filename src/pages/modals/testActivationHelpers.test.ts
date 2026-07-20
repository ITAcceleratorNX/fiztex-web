import { describe, expect, it } from 'vitest';
import {
  mapTestActivationError,
  parseTestActivationDetails,
  violationsByQuestionIndex,
} from './testActivationHelpers';

describe('testActivationHelpers', () => {
  it('parseTestActivationDetails maps server payload', () => {
    const details = [
      { questionOrderIndex: 0, code: 'SINGLE_CHOICE_CORRECT_COUNT', message: 'Вопрос 1: fix' },
      { questionOrderIndex: null, code: 'NO_PUBLISHED_QUESTIONS', message: 'Add question' },
    ];

    expect(parseTestActivationDetails(details)).toEqual([
      { questionOrderIndex: 0, code: 'SINGLE_CHOICE_CORRECT_COUNT', message: 'Вопрос 1: fix' },
      { questionOrderIndex: null, code: 'NO_PUBLISHED_QUESTIONS', message: 'Add question' },
    ]);
  });

  it('mapTestActivationError extracts violations from ApiError', () => {
    const err = Object.assign(new Error('fail'), {
      name: 'ApiError',
      status: 422,
      code: 'TEST_ACTIVATION_INVALID',
      details: [{ questionOrderIndex: 1, code: 'QUESTION_TEXT_EMPTY', message: 'Вопрос 2: укажите текст' }],
    });

    const mapped = mapTestActivationError(err);
    expect(mapped.violations).toHaveLength(1);
    expect(mapped.form).toBeUndefined();
  });

  it('violationsByQuestionIndex groups by order index', () => {
    const map = violationsByQuestionIndex([
      { questionOrderIndex: 0, code: 'A', message: 'one' },
      { questionOrderIndex: 0, code: 'B', message: 'two' },
      { questionOrderIndex: null, code: 'C', message: 'global' },
    ]);

    expect(map.get(0)).toHaveLength(2);
    expect(map.has(1)).toBe(false);
  });
});
