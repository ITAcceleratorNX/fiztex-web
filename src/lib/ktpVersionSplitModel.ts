/** UI quantities use 1/10000 units, matching the API's four decimal places. */
export type KtpSplitPart = { topicId: string; share: string };

export function ktpShareUnits(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const units = Number(whole) * 10000 + Number(fraction.padEnd(4, '0'));
  return Number.isSafeInteger(units) && units > 0 && units <= 10000 ? units : null;
}

export function ktpSplitValidation(parts: KtpSplitPart[], targetIds: number[]) {
  const ids = parts.map(part => Number(part.topicId));
  const shares = parts.map(part => ktpShareUnits(part.share));
  const sum = shares.reduce<number>((total, value) => total + (value ?? 0), 0);
  const error = parts.length === 0 ? 'Добавьте хотя бы одну тему для переноса.'
    : parts.some(part => !part.topicId) || ids.some(id => !targetIds.includes(id)) ? 'Выберите новую тему в каждой строке.'
    : new Set(ids).size !== ids.length ? 'Одна новая тема не должна повторяться в распределении этой старой темы.'
    : shares.some(share => share == null) ? 'Доля должна быть больше 0 и не больше 1, до четырёх знаков после запятой.'
    : sum !== 10000 ? 'Распределите весь прогресс: сумма долей должна быть равна 1 (100%).'
    : null;
  return { valid: error == null, sum, error };
}
