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

/**
 * Аккаунт, школьный профиль и — для ученика с `classId` — членство в классе создаются
 * одним запросом в одной транзакции. `force` подтверждает зачисление в класс, где уже
 * есть ученик с похожим ФИО (409 `STUDENT_DUPLICATE_SUSPECTED`).
 */
export async function createUser(
  input: CreateUserInput,
  opts: { force?: boolean } = {},
): Promise<PlatformUser & { issuedCode?: string | null; schoolProfileId?: number | null }> {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error('Укажите ФИО');
  if (!input.role) throw new Error('Укажите роль');

  const created = await request<CreateAccountResponseDto>(
    `/admin/accounts${opts.force ? '?force=true' : ''}`,
    {
      method: 'POST',
      body: {
        role: input.role,
        fullName,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        classId: input.classId ?? null,
      },
    },
  );

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

// ─── Внутренние сотрудники (ТЗ SERVICE-FE-004 §3, §4) ─────────────────────────

/**
 * Аккаунты нескольких ролей одним списком.
 *
 * `/admin/accounts` принимает одну роль за раз, поэтому набор ролей разворачивается в
 * параллельные запросы. Для служебных ролей это дёшево — их в школе десятки, а не
 * тысячи, — и честнее, чем выбрать всех подряд и отсеять лишних на клиенте: во втором
 * случае страница из двадцати строк могла бы целиком состоять из учеников.
 *
 * Отсюда и `size` по умолчанию: раздел сотрудников не листается, он ищется и
 * фильтруется, а склеенную из нескольких выдач страницу пришлось бы резать заново.
 */
export async function listAccountsByRoles(
  roles: readonly AccountRole[],
  params: { query?: string; status?: AccountStatus; size?: number } = {},
): Promise<PlatformUser[]> {
  const size = params.size ?? 200;
  const pages = await Promise.all(
    roles.map((role) =>
      request<Page<AccountDto>>(
        `/admin/accounts${pageQuery({
          role,
          status: params.status,
          query: params.query?.trim() || undefined,
          page: 0,
          size,
        })}`,
      ),
    ),
  );
  return pages.flatMap((page) => page.content.map(mapUser));
}

/**
 * Аккаунт с этим телефоном, если он есть (§4).
 *
 * Нужен до создания, а не после отказа: бэкенд отвечает на занятый телефон голым 409
 * без кода (`FiztexConflictException("Phone is already in use")`), и разбирать текст
 * сообщения значило бы привязать сценарий возврата к формулировке. Поиск же отвечает
 * тем, что нужно на самом деле, — самим аккаунтом: его ролью и статусом.
 *
 * Поиск по `query` — это `LIKE '%…%'` по ФИО, телефону и почте, поэтому совпадение
 * проверяется ещё раз точным сравнением: подстрока телефона может принадлежать другому
 * номеру.
 */
export async function findAccountByPhone(normalizedPhone: string): Promise<PlatformUser | null> {
  if (!normalizedPhone) return null;
  const page = await request<Page<AccountDto>>(
    `/admin/accounts${pageQuery({ query: normalizedPhone, page: 0, size: 20 })}`,
  );
  return page.content.map(mapUser).find((user) => user.phone === normalizedPhone) ?? null;
}

/**
 * Блокировка и разблокировка сотрудника (§3).
 *
 * Те же `block` и `unblock`, что у общей таблицы аккаунтов, — и называются они в панели
 * тем же словом: в `block` живёт возврат заявок в очередь (SERVICE-BE-007 §9). Тонкая
 * обёртка вместо `blockUser` — потому что та ради возврата обновлённой строки
 * перечитывает двести аккаунтов, а раздел сотрудников и так перезапрашивает свой список
 * после действия.
 */
export async function setAccountActive(accountId: string, active: boolean): Promise<void> {
  await request<void>(`/admin/accounts/${accountId}/${active ? 'unblock' : 'block'}`, {
    method: 'POST',
  });
}

/**
 * Смена роли сотрудника (SERVICE-BE-008 §1).
 *
 * Возвращает карточку аккаунта из ответа, а не собирает её из того, что послали:
 * SERVICE-FE-004 §4 требует показывать новое состояние по ответу бэкенда — он же решает,
 * что стало с заявками сотрудника.
 */
export async function changeEmployeeRole(
  accountId: string,
  role: AccountRole,
): Promise<PlatformUser> {
  const updated = await request<AccountDto>(`/admin/accounts/${accountId}/role`, {
    method: 'PATCH',
    body: { role },
  });
  return mapUser(updated);
}

/**
 * Новый код доступа сотрудника (SERVICE-BE-008 §2).
 *
 * Код показывается один раз и нигде не хранится: бэкенд отдаёт открытым текстом только
 * здесь, дальше в базе лежит его хеш.
 */
export async function resetEmployeeAccess(accountId: string): Promise<string> {
  const issued = await request<{ issuedCode: string }>(
    `/admin/accounts/${accountId}/reset-access`,
    { method: 'POST' },
  );
  return issued.issuedCode;
}
