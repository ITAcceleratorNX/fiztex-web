import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMyAccountId, useServiceRequests } from '@/hooks/queries';
import { ROUTES } from '@/lib/routes';
import { SERVICE_TABS, serviceSectionFrom } from '@/lib/serviceSections';
import type { ServiceSection } from '@/lib/serviceRequestsApi';
import { actionErrorText } from '@/lib/serviceRequestsModel';
import { AllServiceRequestsTab } from './AllServiceRequestsTab';
import { CreateServiceRequestModal } from './CreateServiceRequestModal';
import { ServiceAuditTab } from './ServiceAuditTab';
import { ServiceRequestsTable, ServiceRequestsTableSkeleton } from './ServiceRequestsTable';

/**
 * Сервисные заявки (ТЗ SERVICE-FE-001 §1–§3, SERVICE-FE-004 §2, §5, §9).
 *
 * Один экран на две роли. Admin и Teacher видят свои заявки и историю; Super Admin —
 * их же плюс «Все заявки» и «Журнал»: §2 прямо требует, чтобы его собственный сценарий
 * автора остался обычным, а не превратился во второй интерфейс.
 *
 * Общей очереди среди вкладок нет по-прежнему: это исполнительский раздел, и §2 задачи
 * FE-001 запрещает показывать его автору. Пустая вкладка была бы честнее только на вид —
 * очередь чужой службы отвечает 403, а не пустым списком.
 *
 * Вкладка живёт в адресе: карточка заявки возвращает на `/service`, и без этого Super
 * Admin, зашедший из «Всех заявок», оказывался бы в «Моих».
 */
export function ServiceRequestsPage() {
  useDocumentTitle('Сервисные заявки');

  const navigate = useNavigate();
  const toast = useToast();
  const { admin } = useAuth();
  const accountId = useMyAccountId();
  const [params, setParams] = useSearchParams();

  const tabs = SERVICE_TABS.filter((tab) => !tab.superAdminOnly || admin?.role === 'SUPER_ADMIN');
  // Чужая вкладка в адресе не должна открывать чужой раздел: разрешённый набор считается
  // по роли, а `?tab=all` под обычным админом читается как «Мои заявки».
  const section = serviceSectionFrom(params.get('tab'), tabs);

  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-28 font-bold text-ink">Сервисные заявки</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 size-4" aria-hidden />
          Создать заявку
        </Button>
      </header>

      <Tabs
        value={section}
        onValueChange={(next) => {
          const updated = new URLSearchParams(params);
          if (next === 'ACTIVE') updated.delete('tab');
          else updated.set('tab', next.toLowerCase());
          setParams(updated, { replace: true });
        }}
      >
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {section === 'ALL' ? (
        <AllServiceRequestsTab />
      ) : section === 'AUDIT' ? (
        <ServiceAuditTab />
      ) : (
        <MySection section={section} onCreate={() => setCreateOpen(true)} accountId={accountId} />
      )}

      <CreateServiceRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          setCreateOpen(false);
          toast.success(`Заявка ${created.requestNumber ?? ''} создана`.trim());
          // Сразу в карточку: человеку нужен номер, который он теперь будет называть.
          if (created.id != null) navigate(ROUTES.serviceRequest(created.id));
        }}
      />
    </div>
  );
}

/**
 * «Мои заявки» и «История» — сценарий автора (FE-001 §3).
 *
 * Вкладка — это набор статусов на сервере, а не разбиение пришедшей страницы: выполненная
 * заявка уходит в «Историю» сама, потому что у неё сменился статус.
 */
function MySection({
  section,
  accountId,
  onCreate,
}: {
  section: ServiceSection;
  accountId: number | undefined;
  onCreate: () => void;
}) {
  const listQuery = useServiceRequests(section);
  const rows = listQuery.data ?? [];

  if (listQuery.isPending) return <ServiceRequestsTableSkeleton />;
  if (listQuery.isError) {
    return (
      <ErrorBlock
        message={actionErrorText(listQuery.error)}
        onRetry={() => void listQuery.refetch()}
      />
    );
  }
  if (rows.length === 0) return <SectionEmpty section={section} onCreate={onCreate} />;

  return <ServiceRequestsTable rows={rows} accountId={accountId} />;
}

/**
 * Пустой раздел. У «Моих заявок» и «Истории» тексты разные, и это не придирка: первый
 * наполняет сам человек, второй наполняется, только когда заявку закроют. Обещать в них
 * одно и то же значило бы соврать в одном из двух случаев.
 */
function SectionEmpty({ section, onCreate }: { section: ServiceSection; onCreate: () => void }) {
  if (section === 'HISTORY') {
    return (
      <EmptyBlock
        title="История пуста"
        description="Здесь появятся выполненные и отменённые заявки."
      />
    );
  }
  return (
    <EmptyBlock
      title="Активных заявок нет"
      description="Создайте заявку — она останется здесь, пока её не выполнят."
      action={<Button onClick={onCreate}>Создать заявку</Button>}
    />
  );
}
