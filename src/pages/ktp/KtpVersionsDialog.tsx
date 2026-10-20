import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable, TableCell, TableHead } from '@/components/ui/DataTable';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useKtpHistory } from '@/hooks/queries';
import { formatDateTime } from '@/lib/format';
import type { KtpRemovalTarget } from '@/lib/ktpApi';
import { ktpError } from './KtpShared';
import { KtpRemovalDialog } from './KtpRemovalDialog';

export function KtpVersionsDialog({ bindingId, currentVersionId, classLabel, onClose, onView, onRemoved }: {
  bindingId: number; currentVersionId: number; classLabel?: string; onClose: () => void; onView: (id: number) => void; onRemoved: (id: number) => void;
}) {
  const history = useKtpHistory(bindingId);
  const [removing, setRemoving] = useState<KtpRemovalTarget | null>(null);
  const versions = history.data?.pages.flatMap(page => page.items ?? []) ?? [];
  return <><Modal open onClose={onClose} title="Версии КТП" subtitle={classLabel ? `${classLabel} класс` : undefined} appearance="planning" size="planning-topic" scrollable footer={<Button variant="secondary" onClick={onClose}>Закрыть</Button>}>
    {history.isPending ? <LoadingBlock /> : history.isError ? <ErrorBlock message={ktpError(history.error)} onRetry={() => void history.refetch()} /> : <div className="space-y-4">
      <p className="text-13 text-planning-muted">Текущую версию можно заменить новой. Ненужную предыдущую версию можно удалить из списка; история уроков сохранится.</p>
      <DataTable label="Версии КТП"><thead><tr><TableHead>Версия</TableHead><TableHead>Подтверждена</TableHead><TableHead>Статус</TableHead><TableHead><span className="sr-only">Действия</span></TableHead></tr></thead><tbody>
        {versions.map(version => <tr key={version.id}><TableCell><button type="button" className="font-semibold text-navy-700 hover:underline" onClick={() => onView(version.versionId!)}>Версия {version.versionNumber ?? version.bindingRevision}</button></TableCell><TableCell>{formatDateTime(version.createdAt)}</TableCell><TableCell><Badge appearance="label" tone={version.versionId === currentVersionId ? 'green' : 'gray'}>{version.versionId === currentVersionId ? 'Текущая' : 'Предыдущая'}</Badge></TableCell><TableCell><Button variant="danger-ghost" size="icon-sm" title={version.versionId === currentVersionId ? 'Текущая версия используется в КТП' : 'Удалить версию из списка'} aria-label={`Удалить версию ${version.versionNumber ?? version.bindingRevision}`} disabled={version.versionId === currentVersionId} onClick={() => setRemoving({ kind: 'version', bindingId, versionId: version.versionId!, label: `Версия ${version.versionNumber ?? version.bindingRevision}${classLabel ? ` · ${classLabel} класс` : ''}` })} icon={<Trash2 className="size-4" />} /></TableCell></tr>)}
      </tbody></DataTable>
      {history.hasNextPage && <Button variant="secondary" loading={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>Показать ранние версии</Button>}
    </div>}
  </Modal>{removing && <KtpRemovalDialog target={removing} onClose={() => setRemoving(null)} onRemoved={() => { if (removing.kind === 'version') onRemoved(removing.versionId); }} />}</>;
}
