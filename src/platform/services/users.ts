import { pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import type {
  AccountRole,
  AccountStats,
  AccountStatus,
  CreateUserInput,
  ListUsersParams,
  PlatformUser,
  UpdateUserInput,
} from '../types';

interface AccountDto {
  id: number;
  role: AccountRole;
  status: AccountStatus;
  fullName: string;
  phone: string | null;
  email: string | null;
  /** Class name for a student, children names for a parent, assignments for a teacher; null for admin. */
  relation: string | null;
  createdAt: string;
}

interface AccountStatsDto {
  total: number;
  active: number;
  notActivated: number;
  blocked: number;
  archived: number;
}

interface CreateAccountResponseDto {
  id: number;
  role: AccountRole;
  status: AccountStatus;
  issuedCode: string | null;
  /** Present for TEACHER / PARENT / STUDENT; null for ADMIN. */
  schoolProfileId: number | null;
}

function mapUser(dto: AccountDto): PlatformUser {
  return {
    id: String(dto.id),
    fullName: dto.fullName,
    role: dto.role,
    email: dto.email,
    phone: dto.phone,
    status: dto.status,
    relationLabel: dto.relation,
    createdAt: dto.createdAt,
  };
}

export async function listUsers(params: ListUsersParams = {}): Promise<PlatformUser[]> {
  const role = params.role && params.role !== 'ALL' ? params.role : undefined;
  const status = params.status && params.status !== 'ALL' ? params.status : undefined;

  const page = await request<Page<AccountDto>>(
    `/admin/accounts${pageQuery({
      role,
      status,
      query: params.query?.trim() || undefined,
      page: 0,
      size: 200,
    })}`,
  );

  return page.content.map(mapUser);
}

export interface UsersPageResult {
  users: PlatformUser[];
  totalElements: number;
  totalPages: number;
}

/** Server-side paginated + searched account list, for the unified "Пользователи" table. */
export async function listUsersPage(
  params: ListUsersParams & { page?: number; size?: number } = {},
): Promise<UsersPageResult> {
  const role = params.role && params.role !== 'ALL' ? params.role : undefined;
  const status = params.status && params.status !== 'ALL' ? params.status : undefined;

  const page = await request<Page<AccountDto>>(
    `/admin/accounts${pageQuery({
      role,
      status,
      query: params.query?.trim() || undefined,
      page: params.page ?? 0,
      size: params.size ?? 20,
    })}`,
  );

  return {
    users: page.content.map(mapUser),
    totalElements: page.totalElements,
    totalPages: page.totalPages,
  };
}

export async function getUserStats(signal?: AbortSignal): Promise<AccountStats> {
  return request<AccountStatsDto>('/admin/accounts/stats', { signal });
}

export async function getUser(id: string): Promise<PlatformUser | null> {
  const users = await listUsers();
  return users.find((u) => u.id === id) ?? null;
}

export async function createUser(
  input: CreateUserInput,
): Promise<PlatformUser & { issuedCode?: string | null; schoolProfileId?: number | null }> {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error('Укажите ФИО');
  if (!input.role) throw new Error('Укажите роль');

  const created = await request<CreateAccountResponseDto>('/admin/accounts', {
    method: 'POST',
    body: {
      role: input.role,
      fullName,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    },
  });

  return {
    id: String(created.id),
    fullName,
    role: created.role,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    status: created.status,
    relationLabel: null,
    createdAt: new Date().toISOString(),
    issuedCode: created.issuedCode,
    schoolProfileId: created.schoolProfileId ?? null,
  };
}

export async function updateUser(_id: string, _input: UpdateUserInput): Promise<PlatformUser> {
  throw new Error(
    'Редактирование аккаунта через API пока не доступно. Используйте блок/разблок или создайте нового пользователя.',
  );
}

export async function blockUser(id: string): Promise<PlatformUser> {
  await request<void>(`/admin/accounts/${id}/block`, { method: 'POST' });
  const user = await getUser(id);
  if (!user) {
    return {
      id,
      fullName: '',
      role: 'STUDENT',
      email: null,
      phone: null,
      status: 'BLOCKED',
      relationLabel: null,
      createdAt: new Date().toISOString(),
    };
  }
  return { ...user, status: 'BLOCKED' };
}

export async function unblockUser(id: string): Promise<PlatformUser> {
  await request<void>(`/admin/accounts/${id}/unblock`, { method: 'POST' });
  const user = await getUser(id);
  if (!user) throw new Error('Пользователь не найден');
  return user;
}

export async function archiveUser(id: string): Promise<void> {
  await request<void>(`/admin/accounts/${id}/archive`, { method: 'POST' });
}
