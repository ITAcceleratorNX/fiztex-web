import { describe, expect, it } from 'vitest';
import {
  charCounterText,
  mapSubjectApiError,
  parseSubjectValidationDetails,
  SUBJECT_NAME_TAKEN,
  SUBJECT_NAME_TAKEN_HIDDEN,
} from './subjectFormHelpers';
import { SUBJECT_MAX_DESCRIPTION_LENGTH, SUBJECT_MAX_NAME_LENGTH } from './subjectConstraints';

describe('charCounterText', () => {
  it('shows current/max at limit boundary', () => {
    expect(charCounterText(SUBJECT_MAX_NAME_LENGTH, SUBJECT_MAX_NAME_LENGTH)).toBe('120/120');
    expect(charCounterText(0, SUBJECT_MAX_NAME_LENGTH)).toBe('0/120');
  });

  it('counts surrogate-pair unicode like backend @Size (UTF-16 code units)', () => {
    const emoji = '😀'.repeat(60);
    expect(charCounterText(emoji.length, SUBJECT_MAX_NAME_LENGTH)).toBe('120/120');
  });
});

describe('parseSubjectValidationDetails', () => {
  it('maps details[] field/message pairs', () => {
    expect(
      parseSubjectValidationDetails([
        { field: 'name', message: 'Название предмета не должно превышать 120 символов' },
      ]),
    ).toEqual({
      name: 'Название предмета не должно превышать 120 символов',
    });
  });

  it('maps description errors', () => {
    expect(
      parseSubjectValidationDetails([
        { field: 'description', message: 'Описание не должно превышать 2000 символов' },
      ]),
    ).toEqual({
      description: 'Описание не должно превышать 2000 символов',
    });
  });

  it('ignores malformed payload', () => {
    expect(parseSubjectValidationDetails(null)).toEqual({});
    expect(parseSubjectValidationDetails('bad')).toEqual({});
  });
});

describe('mapSubjectApiError', () => {
  function apiError(status: number, message: string, details?: unknown) {
    const err = new Error(message) as Error & { status: number; details?: unknown; code?: string; name: string };
    err.name = 'ApiError';
    err.status = status;
    err.details = details;
    return err;
  }

  it('prefers structured details over message', () => {
    const err = apiError(400, 'name: fallback', [
      { field: 'name', message: 'Название предмета не должно превышать 120 символов' },
    ]);
    expect(mapSubjectApiError(err)).toEqual({
      fields: { name: 'Название предмета не должно превышать 120 символов' },
    });
  });

  it('parses legacy bean-validation message', () => {
    const err = apiError(400, 'name: Укажите название предмета');
    expect(mapSubjectApiError(err)).toEqual({
      fields: { name: 'Укажите название предмета' },
    });
  });

  it('returns form error when no field mapping', () => {
    const err = apiError(500, 'Internal error');
    expect(mapSubjectApiError(err)).toEqual({ fields: {}, form: 'Internal error' });
  });

  it('maps duplicate name conflict to name field', () => {
    const err = apiError(409, 'Предмет с таким названием уже существует', undefined);
    err.code = SUBJECT_NAME_TAKEN;
    expect(mapSubjectApiError(err)).toEqual({
      fields: { name: 'Предмет с таким названием уже существует' },
      showHiddenCta: false,
    });
  });

  it('maps hidden duplicate conflict with CTA flag', () => {
    const err = apiError(409, 'Предмет скрыт — активируйте его', undefined);
    err.code = SUBJECT_NAME_TAKEN_HIDDEN;
    expect(mapSubjectApiError(err)).toEqual({
      fields: { name: 'Предмет скрыт — активируйте его' },
      showHiddenCta: true,
    });
  });
});

describe('subjectConstraints', () => {
  it('matches backend product limits', () => {
    expect(SUBJECT_MAX_NAME_LENGTH).toBe(120);
    expect(SUBJECT_MAX_DESCRIPTION_LENGTH).toBe(2000);
  });
});
