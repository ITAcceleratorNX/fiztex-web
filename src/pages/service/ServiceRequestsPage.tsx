import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMyAccountId, useServiceRequests } from '@/hooks/queries';
import type { ServiceSection } from '@/lib/serviceRequestsApi';
import { actionErrorText } from '@/lib/serviceRequestsModel';
import { CreateServiceRequestModal } from './CreateServiceRequestModal';
import { ServiceRequestsTable, ServiceRequestsTableSkeleton } from './ServiceRequestsTable';

const TABS = [
  { value: 'ACTIVE', label: 'Мои заявки' },
  { value: 'HISTORY', label: 'История' },
] as const satisfies ReadonlyArray<{ value: ServiceSection; label: string }>;

/**
 * Сервисные заявки автора — Admin и Teacher (ТЗ SERVICE-FE-001, Figma «Заявки — Мои
 * заявки» / «Заявки — История»).
 *
 * Вкладок две, хотя в макете их три: «Общая очередь» — исполнительский раздел, и §2
 * прямо запрещает показывать его автору. Пустая вкладка была бы честнее только на вид:
 * очередь чужой службы отвечает 403, а не пустым списком.
 *
 * Вкладка — это набор статусов на сервере, а не разбиение пришедшей страницы (§3).
 * Выполненная заявка уходит в «Историю» сама, потому что у неё сменился статус.
 */
export function ServiceRequestsPage() {
  useDocumentTitle('Сервисные заявки');

  const navigate = useNavigate();
  const toast = useToast();
  const accountId = useMyAccountId();

  const [section, setSection] = useState<ServiceSection>('ACTIVE');
  const [createOpen, setCreateOpen] = useState(false);

  const listQuery = useServiceRequests(section);
  const rows = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-28 font-bold text-ink">Сервисные заявки</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 size-4" aria-hidden />
          Создать заявку
        </Button>
      </header>

      <Tabs value={section} onValueChange={(next) => setSection(next as ServiceSection)}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {listQuery.isPending ? (
        <ServiceRequestsTableSkeleton />
      ) : listQuery.isError ? (
        <ErrorBlock
          message={actionErrorText(listQuery.error)}
          onRetry={() => void listQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <SectionEmpty section={section} onCreate={() => setCreateOpen(true)} />
      ) : (
        <ServiceRequestsTable rows={rows} accountId={accountId} />
      )}

      <CreateServiceRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          setCreateOpen(false);
          toast.success(`Заявка ${created.requestNumber ?? ''} создана`.trim());
          // Сразу в карточку: человеку нужен номер, который он теперь будет называть.
          if (created.id != null) navigate(`/service/${created.id}`);
        }}
      />
    </div>
  );
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
