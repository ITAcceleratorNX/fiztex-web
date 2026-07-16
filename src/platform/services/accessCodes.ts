import { request } from '@/lib/api';
import type { AccountRole, PlatformUser } from '../types';
import { listUsers } from './users';

export interface AccessCredentialActionResult {
  issuedCode?: string | null;
  message: string;
}

/** List accounts that can have credential actions (not SUPER_ADMIN). */
export async function listAccessCodes(params: {
  query?: string;
  role?: AccountRole | 'ALL';
} = {}): Promise<PlatformUser[]> {
  const role = params.role && params.role !== 'ALL' ? params.role : undefined;
  const users = await listUsers({ query: params.query, role });
  return users.filter((u) => u.role !== 'SUPER_ADMIN');
}

/** Account id — backend AccountAdminController. */
export async function resetPin(accountId: string): Promise<AccessCredentialActionResult> {
  await request<void>(`/admin/students/${accountId}/reset-pin`, { method: 'POST' });
  return { message: 'PIN сброшен. Ученику нужна повторная активация.' };
}

export async function reissueCode(accountId: string): Promise<AccessCredentialActionResult> {
  const res = await request<{ issuedCode: string }>(
    `/admin/students/${accountId}/reissue-code`,
    { method: 'POST' },
  );
  return { issuedCode: res.issuedCode, message: `Новый код: ${res.issuedCode}` };
}

export async function resetAccess(
  accountId: string,
  role: 'PARENT' | 'TEACHER',
): Promise<AccessCredentialActionResult> {
  const path =
    role === 'PARENT'
      ? `/admin/parents/${accountId}/reset-access`
      : `/admin/teachers/${accountId}/reset-access`;
  const res = await request<{ issuedCode: string }>(path, { method: 'POST' });
  return { issuedCode: res.issuedCode, message: `Новый код активации: ${res.issuedCode}` };
}

export async function exportAccessCodesCsv(): Promise<{ fileName: string; content: string }> {
  const users = await listAccessCodes();
  const header = 'id,fullName,role,status,phone,email\n';
  const rows = users
    .map((u) =>
      [u.id, csv(u.fullName), u.role, u.status, csv(u.phone ?? ''), csv(u.email ?? '')].join(','),
    )
    .join('\n');
  return {
    fileName: `accounts-${new Date().toISOString().slice(0, 10)}.csv`,
    content: header + rows,
  };
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
