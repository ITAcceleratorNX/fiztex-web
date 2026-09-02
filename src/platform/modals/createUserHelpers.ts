/** Digits-only phone → display mask `+7 (___) ___-__-__`. */
export function formatPhoneMask(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits && !digits.startsWith('7')) digits = `7${digits}`;
  digits = digits.slice(0, 11);

  const rest = digits.slice(1);
  let out = '+7';
  if (rest.length === 0) return raw.trim() === '' ? '' : '+7';
  out += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) out += ')';
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
  return out;
}

export function phoneDigits(masked: string): string {
  return masked.replace(/\D/g, '');
}

export function isPhoneComplete(masked: string): boolean {
  return phoneDigits(masked).length === 11;
}

/**
 * Телефон в том виде, в каком его хранит бэкенд (`PhoneNormalizer`): «+» и цифры.
 *
 * Нужен не форме, а поиску: аккаунт ищется точным совпадением с сохранённым номером
 * (SERVICE-FE-004 §4), а маска «+7 (701) 987-65-43» в базе не встречается никогда.
 */
export function normalizedPhone(masked: string): string {
  const digits = phoneDigits(masked);
  return digits ? `+${digits}` : '';
}

export function toastCreatedMessage(roleLabel: string, issuedCode?: string | null): string {
  if (issuedCode) {
    return `${roleLabel} создан. Код активации: ${issuedCode}`;
  }
  return `${roleLabel} создан`;
}
