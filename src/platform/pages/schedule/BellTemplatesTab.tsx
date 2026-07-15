import { useMemo, useState, type ReactNode } from 'react';
import {
  Bell,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Pencil,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { groupClassesByGrade } from '@/lib/platformCoreApi';
import type { BellTemplate, BellTemplateStatus } from '@/lib/scheduleSettingsTypes';
import {
  useActivateBellTemplate,
  useBellTemplates,
  useCopyBellTemplate,
  useHideBellTemplate,
  useManyBellTemplates,
  useManyTemplateBindings,
  useSchoolClasses,
} from '@/platform/hooks/useScheduleSettings';
import { formatPeriodRange, summarizeBindings } from './bindingSummary';
import { BellTemplateBindingsModal } from './BellTemplateBindingsModal';
import { BellTemplateFormModal } from './BellTemplateFormModal';

type StatusFilter = 'ACTIVE' | 'HIDDEN' | 'ALL';

export function BellTemplatesTab({
  yearId,
  yearName,
}: {
  yearId: number;
  yearName: string;
}) {
  const toast = useToast();
  const templatesQuery = useBellTemplates(yearId);
  const classesQuery = useSchoolClasses(yearId);
  const templates = templatesQuery.data?.content ?? [];
  const templateIds = useMemo(() => templates.map((t) => t.id), [templates]);
  const bindingsQueries = useManyTemplateBindings(templateIds);
  // list returns periods=[] — enrich from get-by-id (also warms form cache)
  const detailQueries = useManyBellTemplates(templateIds);

  const hideMutation = useHideBellTemplate(yearId);
  const activateMutation = useActivateBellTemplate(yearId);
  const copyMutation = useCopyBellTemplate(yearId);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BellTemplate | null>(null);
  const [bindingsTemplate, setBindingsTemplate] = useState<BellTemplate | null>(null);
  const [copySource, setCopySource] = useState<BellTemplate | null>(null);
  const [copyName, setCopyName] = useState('');
  const [statusTarget, setStatusTarget] = useState<BellTemplate | null>(null);

  const gradeGroups = useMemo(
    () => groupClassesByGrade(classesQuery.data?.content ?? []),
    [classesQuery.data],
  );

  const bindingsById = useMemo(() => {
    const map = new Map<number, (typeof bindingsQueries)[number]['data']>();
    templateIds.forEach((id, index) => {
      map.set(id, bindingsQueries[index]?.data);
    });
    return map;
  }, [templateIds, bindingsQueries]);

  const detailsById = useMemo(() => {
    const map = new Map<number, BellTemplate | undefined>();
    templateIds.forEach((id, index) => {
      map.set(id, detailQueries[index]?.data);
    });
    return map;
  }, [templateIds, detailQueries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [templates, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(template: BellTemplate) {
    setEditing(template);
    setFormOpen(true);
  }

  function openCopy(template: BellTemplate) {
    setCopySource(template);
    setCopyName(`${template.name} (копия)`);
  }

  async function submitCopy() {
    if (!copySource) return;
    try {
      const copied = await copyMutation.mutateAsync({
        id: copySource.id,
        body: { name: copyName.trim() || undefined },
      });
      toast.success('Копия создана — открываем редактор');
      setCopySource(null);
      setEditing(copied);
      setFormOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось скопировать');
    }
  }

  async function confirmStatusChange() {
    if (!statusTarget) return;
    try {
      if (statusTarget.status === 'ACTIVE') {
        await hideMutation.mutateAsync(statusTarget.id);
        toast.success('Шаблон скрыт');
      } else {
        await activateMutation.mutateAsync(statusTarget.id);
        toast.success('Шаблон активирован');
      }
      setStatusTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось изменить статус');
    }
  }

  const listEmpty = !templatesQuery.isLoading && !templatesQuery.isError && filtered.length === 0;
  const noTemplatesAtAll = templates.length === 0;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по названию…"
          className="sm:max-w-xs"
        />
        <div className="sm:w-44">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="ACTIVE">Активные</option>
            <option value="HIDDEN">Скрытые</option>
            <option value="ALL">Все</option>
          </Select>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate} className="sm:ml-auto">
          Создать шаблон
        </Button>
      </div>

      {templatesQuery.isLoading && <LoadingBlock label="Загрузка шаблонов…" />}
      {templatesQuery.isError && (
        <ErrorBlock
          message={
            templatesQuery.error instanceof Error
              ? templatesQuery.error.message
              : 'Не удалось загрузить шаблоны'
          }
          onRetry={() => void templatesQuery.refetch()}
        />
      )}

      {listEmpty && noTemplatesAtAll && (
        <div className="card">
          <EmptyBlock
            icon={<Bell className="h-7 w-7" />}
            title="Шаблонов звонков пока нет"
            description="Создайте первый шаблон с сеткой уроков для выбранного учебного года."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Создать шаблон
              </Button>
            }
          />
        </div>
      )}

      {listEmpty && !noTemplatesAtAll && (
        <div className="card">
          <EmptyBlock
            title="Ничего не найдено"
            description="Измените поиск или фильтр статуса."
          />
        </div>
      )}

      {!templatesQuery.isLoading && !templatesQuery.isError && filtered.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Название</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Уроки</th>
                <th className="px-4 py-3 font-semibold">Время</th>
                <th className="px-4 py-3 font-semibold">Классы</th>
                <th className="px-4 py-3 font-semibold text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((template) => {
                const bindings = bindingsById.get(template.id) ?? [];
                const detail = detailsById.get(template.id);
                const periods = detail?.periods;
                return (
                  <tr key={template.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-medium text-slate-900 hover:text-brand-700"
                        onClick={() => openEdit(template)}
                      >
                        {template.name}
                      </button>
                      {template.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                          {template.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={template.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {periods == null ? '…' : periods.length}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {periods == null ? '…' : formatPeriodRange(periods)}
                    </td>
                    <td className="max-w-[14rem] px-4 py-3 text-slate-600">
                      <span className="line-clamp-2">
                        {summarizeBindings(bindings, gradeGroups)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <IconAction label="Редактировать" onClick={() => openEdit(template)}>
                          <Pencil className="h-4 w-4" />
                        </IconAction>
                        <IconAction label="Копировать" onClick={() => openCopy(template)}>
                          <Copy className="h-4 w-4" />
                        </IconAction>
                        <IconAction
                          label="Привязки"
                          onClick={() => setBindingsTemplate(template)}
                          disabled={template.status === 'HIDDEN'}
                          title={
                            template.status === 'HIDDEN'
                              ? 'Активируйте шаблон для привязки классов'
                              : undefined
                          }
                        >
                          <Link2 className="h-4 w-4" />
                        </IconAction>
                        <IconAction
                          label={template.status === 'ACTIVE' ? 'Скрыть' : 'Активировать'}
                          onClick={() => setStatusTarget(template)}
                        >
                          {template.status === 'ACTIVE' ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </IconAction>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BellTemplateFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        yearId={yearId}
        yearName={yearName}
        template={editing}
        onSaved={() => void templatesQuery.refetch()}
        onOpenCopy={(copied) => {
          setEditing(copied);
          setFormOpen(true);
        }}
      />

      <BellTemplateBindingsModal
        open={bindingsTemplate != null}
        onClose={() => setBindingsTemplate(null)}
        yearId={yearId}
        template={bindingsTemplate}
        allTemplates={templates}
      />

      <Modal
        open={copySource != null}
        onClose={() => setCopySource(null)}
        title="Копировать шаблон"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCopySource(null)}>
              Отмена
            </Button>
            <Button loading={copyMutation.isPending} onClick={() => void submitCopy()}>
              Создать копию
            </Button>
          </>
        }
      >
        <Field label="Название копии" required>
          <TextInput
            value={copyName}
            onChange={(e) => setCopyName(e.target.value)}
            autoFocus
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={statusTarget != null}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.status === 'ACTIVE' ? 'Скрыть шаблон?' : 'Активировать шаблон?'}
        message={
          statusTarget?.status === 'ACTIVE'
            ? 'Скрытый шаблон нельзя назначить новым классам. Существующие привязки сохраняются.'
            : 'Шаблон снова станет доступен для привязки классов.'
        }
        confirmLabel={statusTarget?.status === 'ACTIVE' ? 'Скрыть' : 'Активировать'}
        loading={hideMutation.isPending || activateMutation.isPending}
        onConfirm={() => void confirmStatusChange()}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: BellTemplateStatus }) {
  return status === 'ACTIVE' ? (
    <Badge tone="green" dot>
      Активен
    </Badge>
  ) : (
    <Badge tone="gray" dot>
      Скрыт
    </Badge>
  );
}

function IconAction({
  label,
  onClick,
  children,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
