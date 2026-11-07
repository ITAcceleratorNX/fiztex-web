import type { Schema } from '@/lib/apiSchemas';
import type { AccessRequestStage } from '@/lib/accessRequestsApi';

type Row = Schema<'AccessRequestRowView'>;
type Detail = Schema<'AccessRequestDetailView'>;
type Candidate = Schema<'ProfileCandidateView'>;
type ChildCandidate = Schema<'ChildCandidateView'>;
type MatchReason = NonNullable<Candidate['matchReasons']>[number];
type ApproveBody = Schema<'ApproveAccessRequestRequest'>;

export const REQUEST_ROLE_LABELS: Record<'STUDENT' | 'PARENT', string> = {
  STUDENT: 'Ученик',
  PARENT: 'Родитель',
};

/**
 * Полосы реестра. В макете их три — «Новые», «Одобрены», «Отклонены», — а здесь четыре:
 * у бэкенда «одобрена» распадается на два этапа, `APPROVED_PENDING_ACTIVATION` (решение
 * принято, человек ещё не вошёл) и `ACTIVE` (вошёл), и фильтр принимает ровно один.
 * Склеить их в одну полосу нечем, а выбрать только первый — значит потерять из реестра
 * всех, кто уже подключился. Четвёртая полоса заодно отвечает на вопрос, ради которого
 * в «Одобрены» и заходят: кто ещё не подключился.
 */
export const REQUEST_TABS: ReadonlyArray<{ stage: AccessRequestStage; label: string }> = [
  { stage: 'PENDING', label: 'Новые' },
  { stage: 'APPROVED_PENDING_ACTIVATION', label: 'Одобрены' },
  { stage: 'ACTIVE', label: 'Подключились' },
  { stage: 'REJECTED', label: 'Отклонены' },
];

export function isRequestStage(value: string | null): value is AccessRequestStage {
  return REQUEST_TABS.some((tab) => tab.stage === value);
}

export function roleLabel(role: Row['role']): string {
  return role ? REQUEST_ROLE_LABELS[role] : '—';
}

/** Класс в строке реестра: у родителя заявлен класс ребёнка, а не свой. */
export function rowClassLabel(row: Row): string {
  if (row.role === 'PARENT') {
    return row.childClassName ? `ребёнок в ${row.childClassName}` : 'ребёнок не указан';
  }
  return row.className ?? '—';
}

export function phoneLabel(phone: string | undefined | null): string {
  return phone?.trim() ? phone : 'Не указан';
}

/** Имя класса заявки: действующее, а если класс уже переименовали — то, что было при подаче. */
export function requestClassName(view: Schema<'RequestClassView'> | undefined): string | null {
  if (!view) return null;
  return view.currentName ?? view.snapshotName ?? null;
}

/**
 * Чем человек войдёт после одобрения. Это не выбор администратора, а следствие заявки:
 * пароль принимается только вместе с телефоном (§4), без них остаётся код и PIN.
 */
export function loginMethodLabel(detail: Detail): string {
  return detail.passwordProvided && detail.phone ? 'Телефон и пароль' : 'Персональный код и PIN';
}

export type MatchTone = 'match' | 'partial' | 'miss';
export type MatchBadge = { key: string; label: string; tone: MatchTone };

function nameTone(reasons: readonly MatchReason[]): MatchTone {
  if (reasons.includes('EXACT_NAME') || reasons.includes('CLASS_AND_NAME')) return 'match';
  if (reasons.includes('NAME_WITHOUT_MIDDLE') || reasons.includes('SAME_LAST_NAME_IN_CLASS')) {
    return 'partial';
  }
  return 'miss';
}

/** Класс считается совпавшим, если бэкенд нашёл человека в заявленном классе. */
function classTone(reasons: readonly MatchReason[], candidateClass: string | null, requestClass: string | null): MatchTone {
  if (reasons.includes('CLASS_AND_NAME') || reasons.includes('SAME_LAST_NAME_IN_CLASS')) return 'match';
  if (!candidateClass || !requestClass) return 'miss';
  return candidateClass.trim() === requestClass.trim() ? 'match' : 'miss';
}

/**
 * Плашки совпадений (макет D2-S): название признака и ничего больше.
 *
 * Признак показывается, только когда в заявке есть что сравнивать: у родителя своего
 * класса в заявке нет, телефон необязателен, и плашка «✗ Телефон» на заявке без телефона
 * говорила бы о несовпадении, которого не было.
 */
export function candidateBadges(detail: Detail, candidate: Candidate): MatchBadge[] {
  const reasons = candidate.matchReasons ?? [];
  const badges: MatchBadge[] = [{ key: 'name', label: 'ФИО', tone: nameTone(reasons) }];
  if (detail.role === 'STUDENT') {
    badges.push({
      key: 'class',
      label: 'Класс',
      tone: classTone(reasons, candidate.className ?? null, requestClassName(detail.schoolClass)),
    });
  }
  if (detail.phone?.trim()) {
    badges.push({
      key: 'phone',
      label: 'Телефон',
      tone: reasons.includes('SAME_PHONE') ? 'match' : 'miss',
    });
  }
  return badges;
}

/** У ребёнка сравнивать можно только ФИО и класс: телефон в заявке родительский. */
export function childBadges(detail: Detail, child: ChildCandidate): MatchBadge[] {
  const reasons = child.matchReasons ?? [];
  return [
    { key: 'name', label: 'ФИО', tone: nameTone(reasons) },
    {
      key: 'class',
      label: 'Класс',
      tone: classTone(reasons, child.className ?? null, requestClassName(detail.childClass)),
    },
  ];
}

/** Строка под именем кандидата: класс, год набора, состояние аккаунта. */
export function candidateMeta(candidate: Candidate): string {
  const parts = [candidate.className, candidate.academicYearName].filter(Boolean) as string[];
  if (candidate.status === 'NOT_ACTIVATED') parts.push('не активирован');
  else if (candidate.status === 'BLOCKED') parts.push('заблокирован');
  else if (candidate.status === 'ARCHIVED') parts.push('в архиве');
  else if (candidate.status === 'ACTIVE') parts.push('активен');
  return parts.join(' · ');
}

export function childMeta(child: ChildCandidate): string {
  const parts = [child.className].filter(Boolean) as string[];
  const parents = (child.parentLinks ?? [])
    .map((link) => link.fullName)
    .filter(Boolean) as string[];
  if (parents.length) parts.push(`родители: ${parents.join(', ')}`);
  return parts.join(' · ');
}

/**
 * Что заявитель поправил в повторной заявке. Бэкенд этого не считает — он хранит обе
 * строки целиком (§8), — а администратору на карточке важно ровно одно: что изменилось
 * с прошлого раза. Сравниваются только поля, которые заявитель мог поменять сам.
 */
export function changedSincePrevious(detail: Detail): { className?: string; phone?: string } {
  const previous = detail.previousRequests?.[0];
  if (!previous) return {};
  const changed: { className?: string; phone?: string } = {};
  const currentClass = detail.role === 'PARENT'
    ? requestClassName(detail.childClass)
    : requestClassName(detail.schoolClass);
  const previousClass = detail.role === 'PARENT' ? previous.childClassName : previous.className;
  if (previousClass && currentClass && previousClass !== currentClass) changed.className = previousClass;
  if (previous.phone && detail.phone && previous.phone !== detail.phone) changed.phone = previous.phone;
  return changed;
}

export function isDecided(detail: Detail): boolean {
  return detail.stage === 'APPROVED_PENDING_ACTIVATION'
    || detail.stage === 'ACTIVE'
    || detail.stage === 'REJECTED';
}

export function isApproved(detail: Detail): boolean {
  return detail.stage === 'APPROVED_PENDING_ACTIVATION' || detail.stage === 'ACTIVE';
}

/**
 * Частые причины отказа из макета D3. Нажатие подставляет текст в поле, но не заменяет
 * его: причину видит заявитель, и «Нет ученика в этом классе» без класса ему ничего не
 * объясняет. Класс подставляется из заявки, догадок о «правильном» классе здесь нет —
 * их придумывает администратор.
 */
export function rejectionTemplates(detail: Detail): Array<{ label: string; text: string }> {
  const className = detail.role === 'PARENT'
    ? requestClassName(detail.childClass)
    : requestClassName(detail.schoolClass);
  const where = className ? `В ${className}` : 'В указанном классе';
  return [
    { label: 'Нет ученика в этом классе', text: `${where} нет ученика с таким ФИО. Проверьте класс и отправьте заявку заново.` },
    { label: 'ФИО не совпадает', text: 'ФИО из заявки не совпадает с данными школы. Укажите фамилию, имя и отчество полностью.' },
    { label: 'Телефон уже привязан', text: 'Этот номер телефона уже привязан к другому аккаунту. Укажите другой номер или обратитесь в школу.' },
    { label: 'Повторная заявка', text: 'Заявка на этот профиль уже рассмотрена. Войдите в приложение или обратитесь в школу.' },
  ];
}

export const RELATION_LABELS: Record<NonNullable<ApproveBody['relationType']>, string> = {
  MOTHER: 'Мать',
  FATHER: 'Отец',
  GUARDIAN: 'Опекун',
  OTHER: 'Другое',
};

export type ApprovalIntent = {
  /** `true` — «Создать новый профиль», `false` — «Привязать» к найденному. */
  createProfile: boolean;
  /** Имя профиля, к которому привязывают; у создания его нет. */
  profileName?: string | null;
  /** Выбранный ребёнок и степень родства — только у родительской заявки. */
  childName?: string | null;
  relationType?: NonNullable<ApproveBody['relationType']>;
};

/**
 * Текст подтверждения перед одобрением заявки.
 *
 * Спрашивать обязательно: одобрение необратимо — «разодобрить» заявку нечем
 * (`/approve` и `/reject` — единственные решения, и повторная заявка заводится новой
 * строкой). Промах мимо «Привязать» заводит в школе дубль человека, а промах мимо
 * «Создать» отдаёт заявителю чужой профиль; и то и другое чинится вручную.
 *
 * Поэтому у двух кнопок разный текст: они делают разное, и «Вы уверены?» на обе
 * не сказало бы ничего. В каждом — что появится, чем человек войдёт и что решение
 * окончательное.
 */
export function approvalConfirm(
  detail: Detail,
  intent: ApprovalIntent,
): { title: string; message: string; confirmLabel: string } {
  const noun = detail.role === 'PARENT' ? 'родитель' : 'ученик';
  const className = detail.role === 'PARENT'
    ? requestClassName(detail.childClass)
    : requestClassName(detail.schoolClass);
  const applicant = detail.fullName ?? `заявка № ${detail.requestId ?? ''}`.trim();
  const login = detail.passwordProvided && detail.phone
    ? 'Войдёт по телефону и паролю из заявки.'
    : detail.role === 'PARENT'
      ? 'Войдёт по персональному коду — его выдаёт администратор.'
      : 'Войдёт по персональному коду — его выдаёт классный руководитель.';
  const relation = intent.relationType ? RELATION_LABELS[intent.relationType].toLowerCase() : null;
  const child = detail.role === 'PARENT' && intent.childName
    ? ` Связываем с ребёнком ${intent.childName}${relation ? ` (${relation})` : ''}.`
    : '';
  const final = ' Решение окончательное: отменить одобрение нельзя.';

  if (!intent.createProfile) {
    const target = intent.profileName ?? 'выбранному профилю';
    return {
      title: 'Привязать заявку к профилю?',
      message: `${applicant} получит доступ к профилю «${target}» — новый профиль не создаётся.${child} ${login}${final}`,
      confirmLabel: 'Привязать',
    };
  }

  const where = className ? `${applicant}, ${className}` : applicant;
  return {
    title: detail.role === 'PARENT' ? 'Создать нового родителя?' : 'Создать нового ученика?',
    message: `В школе появится новый ${noun}: ${where}.${child} ${login} Если такой ${noun} в школе уже есть, вернитесь и привяжите заявку к его профилю — иначе получится дубль.${final}`,
    confirmLabel: 'Создать профиль',
  };
}
