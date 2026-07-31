import { describe, expect, it } from 'vitest';
import {
  APPLICANT_GRADES,
  APPLICANT_INVALID_PHONE_MESSAGE,
  applicantGradeOptions,
  normalizeParentPhone,
  validateParentPhone,
} from './applicantFormHelpers';

const VALID_PHONES = [
  '+77051234567',
  '87051234567',
  '8 (705) 123-45-67',
  '+7 705 123 45 67',
  '7051234567',
  '0077051234567',
] as const;

const INVALID_PHONES = [
  'abc',
  '12',
  '870512345678',
  '+12345678901',
  '+7',
  '705123456',
  'letters7051234567',
  '7051234567a',
  '７０５１２３４５６７',
  '++77051234567',
  '+7-abc-123',
  'a'.repeat(50),
] as const;

describe('applicantFormHelpers', () => {
  it.each(VALID_PHONES)('normalizes valid phone %s to E.164', (raw) => {
    expect(normalizeParentPhone(raw)).toBe('+77051234567');
  });

  it.each(INVALID_PHONES)('rejects invalid phone %s', (raw) => {
    expect(normalizeParentPhone(raw)).toBeNull();
    expect(validateParentPhone(raw)).toBe(APPLICANT_INVALID_PHONE_MESSAGE);
  });

  it('allows blank optional phone', () => {
    expect(validateParentPhone('')).toBeNull();
    expect(validateParentPhone('   ')).toBeNull();
    expect(normalizeParentPhone('')).toBeNull();
    expect(normalizeParentPhone('   ')).toBeNull();
  });
});

describe('applicantGradeOptions', () => {
  it('lists parallels 1..11 in the stored «N класс» format', () => {
    expect(APPLICANT_GRADES).toHaveLength(11);
    expect(APPLICANT_GRADES[0]).toBe('1 класс');
    expect(APPLICANT_GRADES[10]).toBe('11 класс');
  });

  it('returns the plain list when the current value is empty or already known', () => {
    expect(applicantGradeOptions(null)).toEqual(APPLICANT_GRADES);
    expect(applicantGradeOptions('')).toEqual(APPLICANT_GRADES);
    expect(applicantGradeOptions('7 класс')).toEqual(APPLICANT_GRADES);
  });

  it('keeps a legacy value so editing cannot silently drop it', () => {
    const options = applicantGradeOptions('7А профильный');
    expect(options).toHaveLength(12);
    expect(options.at(-1)).toBe('7А профильный');
  });
});
