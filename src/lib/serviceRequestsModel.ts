import { ApiError } from '@/lib/api';
import { pluralRu } from '@/lib/format';
import {
  RETURN_WINDOW_MS,
  SERVICE_REQUEST_ERRORS,
  type ServiceRequest,
  type ServiceRequestAction,
  type ServiceRequestHistoryEntry,
  type ServiceRequestStatus,
  type ServiceType,
} from '@/lib/serviceRequestsApi';

/**
 * Подписи и правила показа сервисной заявки (ТЗ SERVICE-FE-001 §3, §5, §7–§9).
 *
 * Вынесено из экранов: одну и ту же заявку рисуют список, история и детальная страница,
 * и разъехаться подписям нельзя — «Выполнена» обязана читаться одинаково везде.
 *
 * Здесь нет ни одного правила, которого нет на бэкенде: раздел определяется статусом,
 * окно возврата — теми же 48 часами от `completedAt`, а что человеку позволено, решает
 * сервер и отвечает отказом. Экран считает это лишь затем, чтобы не показывать кнопку,
 * которая всё равно не сработает.
 */

export type StatusTone = 'new' | 'progress' | 'done' | 'cancelled';

const STATUS_CHIPS: Record<ServiceRequestStatus, { label: string; tone: StatusTone }> = {
  NEW: { label: 'Новая', tone: 'new' },
  IN_PROGRESS: { label: 'В работе', tone: 'progress' },
  COMPLETED: { label: 'Выполнена', tone: 'done' },
  CANCELLED: { label: 'Отменена', tone: 'cancelled' },
};

export function statusChip(status: ServiceRequestStatus | undefined) {
  return status ? STATUS_CHIPS[status] : null;
}

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  CLEANING: 'Клининг',
  TECHNICIAN: 'Техническая',
};

export function serviceTypeLabel(serviceType: ServiceType | undefined): string {
  return serviceType ? SERVICE_TYPE_LABELS[serviceType] : '—';
}

/**
 * «3 этаж» из того, что человек ввёл в поле «Этаж».
 *
 * Поле свободное, и в макете оно заполнено то числом («Например: 3» в форме), то фразой
 * («3 этаж» в строке списка) — это одно и то же значение на двух экранах. Слово
 * добавляется только к голому числу: набранное «цоколь» или «3 этаж» остаётся как есть,
 * и «3 этаж этаж» не получается.
 *
 * Это оформление подписи, а не правило заявки: на сервер уходит ровно то, что ввели.
 */
export function floorLabel(floorText: string | undefined): string {
  const value = (floorText ?? '').trim();
  return /^\d+$/.test(value) ? `${value} этаж` : value;
}

/** «Корпус А · 3 этаж · Каб. 204» — местонахождение одной строкой. */
export function locationLine(request: ServiceRequest | undefined): string {
  return [request?.buildingText, floorLabel(request?.floorText), request?.locationText]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * Дата, которой заявка датируется в списке: у активной — когда её завели, у закрытой —
 * когда она закрылась. В «Истории» иначе нельзя: заявка, созданная в понедельник и
 * выполненная в пятницу, встала бы среди понедельничных, и порядок раздела перестал бы
 * отвечать на вопрос «что произошло недавно».
 */
export function eventAt(request: ServiceRequest): string | undefined {
  return request.completedAt ?? request.cancelledAt ?? request.createdAt;
}

/** Свежие сверху. Порядок раздела задаётся здесь, потому что он склеен из двух выдач. */
export function byRecency(a: ServiceRequest, b: ServiceRequest): number {
  return time(eventAt(b)) - time(eventAt(a));
}

/**
 * §7, §8: можно ли вернуть выполненную заявку в работу.
 *
 * Три условия бэкенда целиком: своя заявка, статус `COMPLETED`, с момента выполнения
 * прошло не больше 48 часов. Автор проверяется по идентификатору аккаунта, а не по тому,
 * что заявка пришла из «Моих»: та же карточка открывается и по прямой ссылке.
 *
 * @param accountId кто смотрит; `undefined` — ещё неизвестно, и тогда действия нет:
 *   показать кнопку и получить 403 хуже, чем показать её на секунду позже
 */
export function canReturnCompleted(
  request: ServiceRequest | undefined,
  accountId: number | undefined,
  now = Date.now(),
): boolean {
  if (!request || request.status !== 'COMPLETED') return false;
  if (accountId == null || request.authorId !== accountId) return false;
  const completedAt = time(request.completedAt);
  return completedAt > 0 && now - completedAt < RETURN_WINDOW_MS;
}

/** §7: удалить можно только свою и только новую заявку. */
export function canCancel(
  request: ServiceRequest | undefined,
  accountId: number | undefined,
): boolean {
  return Boolean(
    request && request.status === 'NEW' && accountId != null && request.authorId === accountId,
  );
}

/**
 * Сколько осталось на возврат — подпись рядом с кнопкой. После истечения окна не
 * «0 часов», а `null`: кнопки в этот момент уже нет, и подписывать нечего.
 */
export function returnWindowLeft(request: ServiceRequest, now = Date.now()): string | null {
  const completedAt = time(request.completedAt);
  if (!completedAt) return null;
  const left = completedAt + RETURN_WINDOW_MS - now;
  if (left <= 0) return null;
  const hours = Math.floor(left / (60 * 60 * 1000));
  if (hours >= 1) return `Осталось ${hours} ${pluralRu(hours, ['час', 'часа', 'часов'])}`;
  const minutes = Math.max(1, Math.round(left / (60 * 1000)));
  return `Осталось ${minutes} ${pluralRu(minutes, ['минута', 'минуты', 'минут'])}`;
}

/**
 * Событие ленты (§9). Лента — хронология, а не переписка: у события есть название и,
 * если бэкенд их вернул, причина и фотографии результата. Поля ввода у неё нет (§10).
 */
const ACTION_LABELS: Record<ServiceRequestAction, string> = {
  CREATED: 'Заявка создана',
  CLAIMED: 'Заявка взята в работу',
  RETURNED_TO_QUEUE: 'Заявка возвращена в очередь',
  TRANSFERRED: 'Заявка передана другой службе',
  COMPLETED: 'Заявка выполнена',
  RETURNED_BY_AUTHOR: 'Заявка возвращена автором в работу',
  CANCELLED: 'Заявка отменена',
  ASSIGNEE_RELEASED: 'Исполнитель снят с заявки',
};

export function historyEventLabel(action: ServiceRequestAction | undefined): string {
  return action ? ACTION_LABELS[action] : 'Событие по заявке';
}

/**
 * Все действия ленты — для фильтра глобального журнала (SERVICE-FE-004 §9).
 *
 * Порядок берётся из `ACTION_LABELS`, а не задаётся вторым списком: иначе новое действие
 * бэкенда попадало бы в подписи и не попадало в фильтр.
 */
export const HISTORY_ACTIONS = Object.keys(ACTION_LABELS) as ServiceRequestAction[];

/**
 * «Что именно поменялось» одной строкой на изменение (SERVICE-FE-004 §9).
 *
 * Показываем только пары, у которых «до» и «после» действительно разошлись: у создания
 * предыдущего состояния не было вовсе, и «— → Новая» сообщало бы о переходе, которого не
 * происходило. Служба меняется только передачей, исполнитель — взятием, возвратом и
 * снятием; печатать все три пары у каждого события значило бы утопить журнал в прочерках.
 */
export function stateChanges(
  event: ServiceRequestHistoryEntry,
): Array<{ label: string; from: string; to: string }> {
  const changes: Array<{ label: string; from: string; to: string }> = [];

  if (event.statusBefore && event.statusAfter && event.statusBefore !== event.statusAfter) {
    changes.push({
      label: 'Статус',
      from: statusChip(event.statusBefore)?.label ?? '—',
      to: statusChip(event.statusAfter)?.label ?? '—',
    });
  }
  if (
    event.serviceTypeBefore &&
    event.serviceTypeAfter &&
    event.serviceTypeBefore !== event.serviceTypeAfter
  ) {
    changes.push({
      label: 'Служба',
      from: serviceTypeLabel(event.serviceTypeBefore),
      to: serviceTypeLabel(event.serviceTypeAfter),
    });
  }
  if (event.assigneeBeforeId !== event.assigneeAfterId) {
    changes.push({
      label: 'Исполнитель',
      // Свободная заявка — это отсутствие исполнителя, а не безымянный исполнитель:
      // «Не назначен» честнее прочерка, потому что так оно и есть в очереди.
      from: event.assigneeBeforeName ?? 'Не назначен',
      to: event.assigneeAfterName ?? 'Не назначен',
    });
  }

  return changes;
}

/**
 * Чужая ли это заявка для смотрящего (§8).
 *
 * Super Admin открывает любую заявку, но распоряжаться может только своей — и признак
 * считается по данным заявки, а не по роли: у собственной заявки Super Admin права
 * обычного автора (§2), и «чужой» она от его роли не становится.
 */
export function isForeignRequest(
  request: ServiceRequest | undefined,
  accountId: number | undefined,
): boolean {
  if (!request || accountId == null) return false;
  return request.authorId !== accountId && request.assignedToId !== accountId;
}

/**
 * Кем приходится смотрящий этой заявке (SERVICE-DESIGN-001 §3: контекст пользователя).
 *
 * Считается по данным, а не по роли: у автора Desktop-flow исполнителем не станет —
 * назначение требует роли службы, — но признак остаётся верным сам по себе и не потребует
 * правки, когда исполнительские экраны появятся в SERVICE-FE-003.
 */
export function viewerContext(
  request: ServiceRequest,
  accountId: number | undefined,
): string | null {
  if (accountId == null) return null;
  const author = request.authorId === accountId;
  const assignee = request.assignedToId === accountId;
  if (author && assignee) return 'Вы автор и исполнитель';
  if (assignee) return 'Вы исполнитель';
  if (author) return 'Вы автор';
  return null;
}

/**
 * Отказ бэкенда человеческим текстом.
 *
 * Разбор по коду, а не по тексту сообщения: у одного действия поводов отказать несколько,
 * и ведут они к разному — «окно закрылось» просит завести новую заявку, а «уже не новая»
 * просит обновить страницу.
 */
export function actionErrorText(error: unknown): string {
  const code = error instanceof ApiError ? error.code : undefined;
  switch (code) {
    // 422 приходит и на возврат без причины. Общее сообщение бэкенда одно на все проверки
    // полей — «Заявку нельзя создать: исправьте указанные поля», — и под окном возврата
    // оно говорит не о том. Берём объяснение самого поля.
    case SERVICE_REQUEST_ERRORS.validation: {
      const first = fieldViolations(error).find((violation) => violation.message);
      return first?.message ?? 'Проверьте заполненные поля и попробуйте ещё раз.';
    }
    case SERVICE_REQUEST_ERRORS.returnWindowExpired:
      return 'Прошло больше 48 часов с момента выполнения — создайте новую заявку.';
    case SERVICE_REQUEST_ERRORS.statusConflict:
      return 'Статус заявки изменился. Обновите страницу и попробуйте ещё раз.';
    case SERVICE_REQUEST_ERRORS.forbidden:
      return 'Это действие доступно только автору заявки.';
    case SERVICE_REQUEST_ERRORS.notFound:
      return 'Заявка не найдена — возможно, она была удалена.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Не удалось выполнить действие. Попробуйте ещё раз.';
  }
}

/**
 * Отказ валидации по полям (422). Бэкенд возвращает `details` списком `{field, message}` —
 * форма подсвечивает по нему конкретные поля, а не всю себя.
 */
export function fieldErrors(error: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (!(error instanceof ApiError) || error.code !== SERVICE_REQUEST_ERRORS.validation) return map;
  for (const violation of fieldViolations(error)) {
    if (violation.field && !map[violation.field]) map[violation.field] = violation.message ?? '';
  }
  return map;
}

function fieldViolations(error: unknown): Array<{ field?: string; message?: string }> {
  if (!(error instanceof ApiError)) return [];
  const details = (error as { details?: unknown }).details;
  return Array.isArray(details) ? (details as Array<{ field?: string; message?: string }>) : [];
}

function time(iso: string | undefined): number {
  if (!iso) return 0;
  const parsed = new Date(iso).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
