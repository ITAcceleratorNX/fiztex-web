export const APPLICANT_INVALID_PHONE_MESSAGE =
  'Укажите телефон в формате +7 XXX XXX XX XX';

const ALLOWED_CHARS = /^[+0-9\s()-]+$/;
const E164_KZ = /^\+7\d{10}$/;

export function normalizeParentPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!ALLOWED_CHARS.test(trimmed)) return null;

  let stripped = trimmed.replace(/[\s()-]/g, '');
  if (stripped.startsWith('00')) {
    stripped = `+${stripped.slice(2)}`;
  }

  let digits: string;
  if (stripped.startsWith('+')) {
    const afterPlus = stripped.slice(1);
    if (!/^[0-9]+$/.test(afterPlus)) return null;
    digits = afterPlus;
  } else {
    if (!/^[0-9]+$/.test(stripped)) return null;
    digits = stripped;
  }

  if (!digits) return null;

  let normalized: string | null = null;
  if (digits.startsWith('8') && digits.length === 11) {
    normalized = `+7${digits.slice(1)}`;
  } else if (digits.startsWith('7') && digits.length === 11) {
    normalized = `+${digits}`;
  } else if (digits.length === 10) {
    normalized = `+7${digits}`;
  }

  if (!normalized || !E164_KZ.test(normalized)) return null;
  return normalized;
}

export function validateParentPhone(raw: string): string | null {
  if (!raw.trim()) return null;
  return normalizeParentPhone(raw) ? null : APPLICANT_INVALID_PHONE_MESSAGE;
}

export type ApplicantField = 'parentPhone' | 'parentFullName' | 'comment';

type ApiErrorLike = {
  message: string;
  details?: unknown;
};

function isApiError(err: unknown): err is ApiErrorLike {
  return err instanceof Error && err.name === 'ApiError';
}

export function parseApplicantValidationDetails(
  details: unknown,
): Partial<Record<ApplicantField, string>> {
  if (!Array.isArray(details)) return {};

  const fields: Partial<Record<ApplicantField, string>> = {};
  for (const item of details) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const field = row.field;
    const message = row.message;
    if (field === 'parentPhone' && typeof message === 'string') {
      fields.parentPhone = message;
    } else if (field === 'parentFullName' && typeof message === 'string') {
      fields.parentFullName = message;
    } else if (field === 'comment' && typeof message === 'string') {
      fields.comment = message;
    }
  }
  return fields;
}

export function mapApplicantApiError(err: unknown): {
  fields: Partial<Record<ApplicantField, string>>;
  form?: string;
} {
  if (!isApiError(err)) {
    return { fields: {}, form: 'Не удалось сохранить' };
  }

  const fields = parseApplicantValidationDetails(err.details);
  if (Object.keys(fields).length > 0) {
    return { fields };
  }

  const bean = err.message.match(/^([a-zA-Z]+)\s*:\s*(.+)$/);
  if (bean) {
    const field = bean[1] as ApplicantField;
    const text = bean[2]!;
    if (field === 'parentPhone' || field === 'parentFullName' || field === 'comment') {
      return { fields: { [field]: text } };
    }
  }

  return { fields: {}, form: err.message };
}
