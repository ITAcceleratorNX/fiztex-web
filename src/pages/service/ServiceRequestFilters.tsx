import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { AccountPicker, type PickedAccount } from '@/platform/components/AccountPicker';
import { ASSIGNEE_ROLES } from '@/lib/employeesModel';
import {
  hasActiveFilters,
  type AllRequestsFilter,
} from '@/lib/serviceRequestsAdminApi';
import type { ServiceRequestStatus, ServiceType } from '@/lib/serviceRequestsApi';
import { serviceTypeLabel, statusChip } from '@/lib/serviceRequestsModel';

/**
 * Фильтры и поиск раздела «Все заявки» (ТЗ SERVICE-FE-004 §6, §7).
 *
 * Все семь фильтров уходят на сервер параметрами `/api/admin/service-requests`, и ни
 * один не считается на клиенте: отбирать двадцать пришедших строк значило бы фильтровать
 * внутри чужого среза — остальные страницы остались бы неотфильтрованными.
 *
 * Поиск один на пять полей (§7: номер, ФИО автора и исполнителя, место, описание) —
 * это параметр `q`, а не пять отдельных: разводить их значило бы заставить человека
 * заранее знать, в каком поле встретится то, что он ищет.
 */

const STATUSES: ServiceRequestStatus[] = ['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const SERVICE_TYPES: ServiceType[] = ['CLEANING', 'TECHNICIAN'];

export function ServiceRequestFilters({
  filter,
  search,
  author,
  assignee,
  onSearchChange,
  onChange,
  onAuthorChange,
  onAssigneeChange,
  onReset,
}: {
  filter: AllRequestsFilter;
  /** Строка поиска до дебаунса: поле обязано оставаться отзывчивым. */
  search: string;
  author: PickedAccount | null;
  assignee: PickedAccount | null;
  onSearchChange: (value: string) => void;
  onChange: (patch: Partial<AllRequestsFilter>) => void;
  onAuthorChange: (next: PickedAccount | null) => void;
  onAssigneeChange: (next: PickedAccount | null) => void;
  onReset: () => void;
}) {
  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="input-base flex min-w-[280px] flex-1 items-center gap-2">
          <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Номер, автор, исполнитель, место или описание…"
            aria-label="Поиск по заявкам"
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>

        {hasActiveFilters(filter) && (
          <Button variant="ghost" size="sm" onClick={onReset} icon={<X className="size-4" />}>
            Сбросить
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Статус">
          <Select
            value={filter.status ?? ''}
            onChange={(event) =>
              onChange({ status: (event.target.value || null) as ServiceRequestStatus | null })
            }
          >
            <option value="">Любой</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusChip(status)?.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Служба">
          <Select
            value={filter.serviceType ?? ''}
            onChange={(event) =>
              onChange({ serviceType: (event.target.value || null) as ServiceType | null })
            }
          >
            <option value="">Любая</option>
            {SERVICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {serviceTypeLabel(type)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Срочность">
          {/* Третьего значения у признака нет, поэтому и вариантов ровно три: «любая»
              означает «не фильтровать», а не «обычная». */}
          <Select
            value={filter.emergency === null ? '' : String(filter.emergency)}
            onChange={(event) =>
              onChange({
                emergency: event.target.value === '' ? null : event.target.value === 'true',
              })
            }
          >
            <option value="">Любая</option>
            <option value="true">Экстренные</option>
            <option value="false">Обычные</option>
          </Select>
        </Field>

        <AccountPicker
          label="Автор"
          placeholder="ФИО автора"
          value={author}
          onChange={onAuthorChange}
        />

        {/* Исполнителя ищем только среди клининга и техслужбы: у охраны своей очереди
            нет, и заявка ей не назначается (SERVICE-BE-002). */}
        <AccountPicker
          label="Текущий исполнитель"
          placeholder="ФИО исполнителя"
          roles={ASSIGNEE_ROLES}
          value={assignee}
          onChange={onAssigneeChange}
        />

        {/* Две даты — один фильтр «дата создания» (§6), поэтому они делят одну ячейку
            сетки, а не встают в разные колонки. */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Создана с">
            <TextInput
              type="date"
              value={filter.createdFrom}
              onChange={(event) => onChange({ createdFrom: event.target.value })}
            />
          </Field>
          <Field label="по">
            <TextInput
              type="date"
              value={filter.createdTo}
              min={filter.createdFrom || undefined}
              onChange={(event) => onChange({ createdTo: event.target.value })}
            />
          </Field>
        </div>
      </div>
    </section>
  );
}
