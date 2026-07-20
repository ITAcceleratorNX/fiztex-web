export type SubjectField = 'name' | 'description';

type ApiErrorLike = {
  message: string;
  details?: unknown;
};

function isApiError(err: unknown): err is ApiErrorLike {
  return err instanceof Error && err.name === 'ApiError';
}

export function charCounterText(currentLength: number, maxLength: number): string {
  return `${currentLength}/${maxLength}`;
}

export function parseSubjectValidationDetails(
  details: unknown,
): Partial<Record<SubjectField, string>> {
  if (!Array.isArray(details)) return {};

  const fields: Partial<Record<SubjectField, string>> = {};
  for (const item of details) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const field = row.field;
    const message = row.message;
    if (field === 'name' && typeof message === 'string') {
      fields.name = message;
    } else if (field === 'description' && typeof message === 'string') {
      fields.description = message;
    }
  }
  return fields;
}

/** Map API validation payload onto form fields; fall back to top-level message. */
export function mapSubjectApiError(err: unknown): {
  fields: Partial<Record<SubjectField, string>>;
  form?: string;
} {
  if (!isApiError(err)) {
    return { fields: {}, form: 'Не удалось сохранить' };
  }

  const fields = parseSubjectValidationDetails(err.details);
  if (Object.keys(fields).length > 0) {
    return { fields };
  }

  const bean = err.message.match(/^([a-zA-Z]+)\s*:\s*(.+)$/);
  if (bean) {
    const field = bean[1] as SubjectField;
    const text = bean[2]!;
    if (field === 'name' || field === 'description') {
      return { fields: { [field]: text } };
    }
  }

  return { fields: {}, form: err.message };
}
