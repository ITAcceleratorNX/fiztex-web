// Russian date / label helpers.

const MONTHS_SHORT = [
  'янв.', 'фев.', 'мар.', 'апр.', 'мая', 'июн.',
  'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.',
];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate().toString().padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  return `${formatDate(iso)}, ${time}`;
}

/** "Версия 1 · 12 авг. 2026, 10:30" */
export function versionLabel(versionNumber: number | null | undefined, iso: string | null | undefined): string {
  if (!versionNumber) return 'Без версии';
  return `Версия ${versionNumber} · ${formatDateTime(iso)}`;
}

// Deterministic pastel avatar color from a name/initial, matching the reference palette.
const AVATAR_COLORS = [
  { bg: '#16244a', fg: '#ffffff' }, // navy
  { bg: '#14b8a6', fg: '#ffffff' }, // teal
  { bg: '#7c6cf0', fg: '#ffffff' }, // purple
  { bg: '#f59e0b', fg: '#ffffff' }, // amber
  { bg: '#22c55e', fg: '#ffffff' }, // green
  { bg: '#ef4466', fg: '#ffffff' }, // red/pink
  { bg: '#3b82f6', fg: '#ffffff' }, // blue
  { bg: '#ec4899', fg: '#ffffff' }, // pink
];

export function avatarColor(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[1][0]!).toUpperCase();
}

export function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
