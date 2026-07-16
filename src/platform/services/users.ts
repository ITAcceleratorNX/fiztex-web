import { pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import type {
  AccountRole,
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
  createdAt: string;
}

interface CreateAccountResponseDto {
  id: number;
  role: AccountRole;
  status: AccountStatus;
  issuedCode: string | null;
}

function mapUser(dto: AccountDto): PlatformUser {
  return {
    id: String(dto.id),
    fullName: dto.fullName,
    role: dto.role,
    email: dto.email,
    phone: dto.phone,
    status: dto.status,
    relationLabel: null,
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
      page: 0,
      size: 200,
    })}`,
  );

  let users = page.content.map(mapUser);
  const query = params.query?.trim().toLowerCase() ?? '';
  if (query) {
    users = users.filter((user) =>
      [user.fullName, user.email, user.phone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }
  return users;
}

export async function getUser(id: string): Promise<PlatformUser | null> {
  const users = await listUsers();
  return users.find((u) => u.id === id) ?? null;
}

export async function createUser(input: CreateUserInput): Promise<PlatformUser & { issuedCode?: string | null }> {
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
