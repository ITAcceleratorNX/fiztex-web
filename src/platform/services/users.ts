import { nextId, store } from '../mock/store';
import type { CreateUserInput, ListUsersParams, PlatformUser, UpdateUserInput } from '../types';
import { mockDelay } from './delay';

function matchesQuery(user: PlatformUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [user.fullName, user.email, user.phone]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(q));
}

export async function listUsers(params: ListUsersParams = {}): Promise<PlatformUser[]> {
  await mockDelay();
  const role = params.role ?? 'ALL';
  const status = params.status ?? 'ALL';
  const query = params.query ?? '';

  return store.users
    .filter((user) => {
      if (role !== 'ALL' && user.role !== role) return false;
      if (status !== 'ALL' && user.status !== status) return false;
      return matchesQuery(user, query);
    })
    .map((user) => ({ ...user }));
}

export async function getUser(id: string): Promise<PlatformUser | null> {
  await mockDelay();
  const user = store.users.find((item) => item.id === id);
  return user ? { ...user } : null;
}

export async function createUser(input: CreateUserInput): Promise<PlatformUser> {
  await mockDelay();
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error('Укажите ФИО');
  if (!input.role) throw new Error('Укажите роль');

  const created: PlatformUser = {
    id: nextId('u'),
    fullName,
    role: input.role,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    status: input.status ?? 'NOT_ACTIVATED',
    relationLabel: input.relationLabel?.trim() || null,
    createdAt: new Date().toISOString(),
  };
  store.users.unshift(created);
  return { ...created };
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<PlatformUser> {
  await mockDelay();
  const index = store.users.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Пользователь не найден');
  const current = store.users[index]!;
  const updated: PlatformUser = {
    ...current,
    fullName: input.fullName?.trim() ?? current.fullName,
    email: input.email !== undefined ? input.email?.trim() || null : current.email,
    phone: input.phone !== undefined ? input.phone?.trim() || null : current.phone,
    status: input.status ?? current.status,
    relationLabel:
      input.relationLabel !== undefined
        ? input.relationLabel?.trim() || null
        : current.relationLabel,
  };
  store.users[index] = updated;
  return { ...updated };
}

export async function blockUser(id: string): Promise<PlatformUser> {
  return updateUser(id, { status: 'BLOCKED' });
}
