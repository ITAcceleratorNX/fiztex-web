import type { SurveyStatus } from './surveyApi';
import type { SurveyVariant } from './surveyModel';

const STATUS_VALUES: SurveyStatus[] = ['DRAFT', 'ACTIVE', 'COMPLETED'];

function listPath(variant: SurveyVariant): string {
  return variant === 'psychology' ? '/psychologist/tests' : '/surveys';
}

export function surveyListReturnTo(search: string, variant: SurveyVariant): string {
  const fallback = listPath(variant);
  const target = new URLSearchParams(search).get('returnTo');
  if (!target || !(target === fallback || target.startsWith(`${fallback}?`))) return fallback;
  const params = new URLSearchParams(target.split('?')[1]);
  const safe = new URLSearchParams();
  const status = params.get('status') as SurveyStatus | null;
  if (status && STATUS_VALUES.includes(status)) safe.set('status', status);
  const rawPage = params.get('page');
  if (rawPage && /^[1-9]\d*$/.test(rawPage)) {
    const page = Number(rawPage);
    if (Number.isSafeInteger(page) && page > 1 && page <= 2_147_483_647) safe.set('page', String(page));
  }
  return `${fallback}${safe.size ? `?${safe}` : ''}`;
}

export function surveyCardPath(listUrl: string, cardPath: string): string {
  return `${cardPath}?${new URLSearchParams({ returnTo: listUrl })}`;
}
