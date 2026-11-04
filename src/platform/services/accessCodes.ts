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

// Выданное значение не кладётся в `message`: сообщение уходит в тост, а тост исчезает, и
// повторно код не показать — в базе хэш. Показывает его `IssuedSecretModal`, из `issuedCode`.
export async function reissueCode(accountId: string): Promise<AccessCredentialActionResult> {
  const res = await request<{ issuedCode: string }>(
    `/admin/students/${accountId}/reissue-code`,
    { method: 'POST' },
  );
  return { issuedCode: res.issuedCode, message: 'Персональный код перевыпущен' };
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
  return { issuedCode: res.issuedCode, message: 'Доступ сброшен, выдан код восстановления' };
}

/** Временный пароль сотруднику или родителю; ученику бэкенд отвечает 409 — у него код и PIN. */
export async function issueTemporaryPassword(accountId: string): Promise<string | null> {
  const res = await request<{ temporaryPassword?: string }>(
    `/admin/accounts/${accountId}/temporary-password`,
    { method: 'POST' },
  );
  return res.temporaryPassword ?? null;
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
