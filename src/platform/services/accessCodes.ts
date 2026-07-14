import { nextId, store } from '../mock/store';
import { buildExportCsv } from '../mock/importResults';
import type { AccessCodeRow } from '../types';
import { mockDelay } from './delay';

export async function listAccessCodes(): Promise<AccessCodeRow[]> {
  await mockDelay();
  return store.accessCodes.map((item) => ({ ...item }));
}

export async function resetPin(id: string): Promise<AccessCodeRow> {
  await mockDelay(200);
  return { ...requireCode(id) };
}

export async function reissueCode(id: string): Promise<AccessCodeRow> {
  await mockDelay(200);
  const index = store.accessCodes.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Код не найден');
  const current = store.accessCodes[index]!;
  const replaced: AccessCodeRow = {
    ...current,
    status: 'REPLACED',
  };
  store.accessCodes[index] = replaced;

  const fresh: AccessCodeRow = {
    id: nextId('code'),
    userId: current.userId,
    userFullName: current.userFullName,
    role: current.role,
    codeHint: current.codeHint.replace(/\*{2,}.*/, '****NW'),
    status: 'ACTIVE',
    issuedAt: new Date().toISOString(),
    usedAt: null,
  };
  store.accessCodes.unshift(fresh);
  return { ...fresh };
}

export async function resetAccess(id: string): Promise<AccessCodeRow> {
  await mockDelay(200);
  const index = store.accessCodes.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Код не найден');
  const updated: AccessCodeRow = {
    ...store.accessCodes[index]!,
    status: 'BLOCKED',
  };
  store.accessCodes[index] = updated;
  return { ...updated };
}

export async function exportAccessCodesCsv(): Promise<{ fileName: string; content: string }> {
  await mockDelay(150);
  return {
    fileName: `access-codes-${new Date().toISOString().slice(0, 10)}.csv`,
    content: buildExportCsv(store.accessCodes),
  };
}

function requireCode(id: string): AccessCodeRow {
  const item = store.accessCodes.find((row) => row.id === id);
  if (!item) throw new Error('Код не найден');
  return item;
}
