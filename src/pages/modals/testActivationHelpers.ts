export const TEST_ACTIVATION_INVALID = 'TEST_ACTIVATION_INVALID';

export interface TestActivationViolation {
  questionOrderIndex: number | null;
  code: string;
  message: string;
}

type ApiErrorLike = {
  message: string;
  code?: string;
  details?: unknown;
};

function isApiError(err: unknown): err is ApiErrorLike {
  return err instanceof Error && err.name === 'ApiError';
}

export function parseTestActivationDetails(details: unknown): TestActivationViolation[] {
  if (!Array.isArray(details)) return [];
  return details
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      questionOrderIndex:
        typeof item.questionOrderIndex === 'number' ? item.questionOrderIndex : null,
      code: String(item.code ?? ''),
      message: String(item.message ?? ''),
    }))
    .filter((v) => v.message.length > 0);
}

export function mapTestActivationError(err: unknown): {
  violations: TestActivationViolation[];
  form?: string;
} {
  if (!isApiError(err) || err.code !== TEST_ACTIVATION_INVALID) {
    return { violations: [], form: isApiError(err) ? err.message : 'Не удалось сохранить' };
  }

  const violations = parseTestActivationDetails(err.details);
  return {
    violations,
    form: violations.length === 0 ? err.message : undefined,
  };
}

export function violationsByQuestionIndex(
  violations: TestActivationViolation[],
): Map<number, TestActivationViolation[]> {
  const map = new Map<number, TestActivationViolation[]>();
  for (const v of violations) {
    if (v.questionOrderIndex == null) continue;
    const list = map.get(v.questionOrderIndex) ?? [];
    list.push(v);
    map.set(v.questionOrderIndex, list);
  }
  return map;
}

export function hasNoQuestionsViolation(violations: TestActivationViolation[]): boolean {
  return violations.some((v) => v.code === 'NO_PUBLISHED_QUESTIONS');
}
