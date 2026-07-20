import { describe, expect, it } from 'vitest';
import {
  APPLICANT_INVALID_PHONE_MESSAGE,
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
