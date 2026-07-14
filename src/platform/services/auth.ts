import type { Admin } from '@/lib/types';
import { mockDelay } from './delay';

const MOCK_ACCOUNTS: Array<{ login: string; password: string; profile: Omit<Admin, 'token'> }> = [
  {
    login: 'admin@fiztex.local',
    password: 'admin123',
    profile: { email: 'admin@fiztex.local', fullName: 'Иванова Анна Сергеевна' },
  },
  {
    login: '+77001112233',
    password: 'admin123',
    profile: { email: 'admin@fiztex.local', fullName: 'Иванова Анна Сергеевна' },
  },
  {
    login: 'super@fiztex.local',
    password: 'super123',
    profile: { email: 'super@fiztex.local', fullName: 'Super Admin' },
  },
];

function normalizeLogin(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Offline / backend-down login for Platform Core shell (PHYCORE-003).
 * Returns null if credentials do not match mock accounts.
 */
export async function mockLogin(login: string, password: string): Promise<Admin | null> {
  await mockDelay(200);
  const key = normalizeLogin(login);
  const found = MOCK_ACCOUNTS.find(
    (account) => normalizeLogin(account.login) === key && account.password === password,
  );
  if (!found) return null;
  return {
    token: `mock-platform.${btoa(found.profile.email)}`,
    email: found.profile.email,
    fullName: found.profile.fullName,
  };
}
