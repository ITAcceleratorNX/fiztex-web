import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FileTypeBadge } from '@/components/ui/FileTypeBadge';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useTeacherTextbookCard } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { openTextbookFile, textbookFileName } from '@/lib/textbookFile';
import { teacherTextbooksApi } from '@/lib/textbooksApi';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

export function TextbookDetailModal({ item, onClose }: { item: WorkspaceSearchItem; onClose: () => void }) {
  const sourceId = Number(item.sourceId);
  const id = Number.isSafeInteger(sourceId) && sourceId > 0 ? sourceId : null;
  const card = useTeacherTextbookCard(id);
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const textbook = card.data?.textbook;

  async function openFile() {
    if (id == null || !textbook || opening) return;
    setOpening(true);
    try {
      await openTextbookFile({
        load: () => teacherTextbooksApi.content(id),
        format: textbook.format,
        fileName: textbookFileName(textbook.title, textbook.format),
      });
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Не удалось открыть учебник');
    } finally {
      setOpening(false);
    }
  }

  return <Modal open onClose={onClose} title={textbook?.title ?? item.title ?? 'Учебник'} size="md" footer={<>
    <Button variant="secondary" onClick={onClose}>Закрыть</Button>
    <Button onClick={() => void openFile()} loading={opening}
      disabled={!textbook || textbook.status === 'BLOCKED' || card.isPending || card.isError}>
      {textbook?.format === 'DOCX' ? 'Скачать учебник' : 'Открыть учебник'}
    </Button>
  </>}>
    {id == null ? <ErrorBlock message="Не удалось загрузить данные" />
      : card.isPending ? <LoadingBlock />
        : card.isError ? <ErrorBlock message="Не удалось загрузить данные" onRetry={() => card.refetch()} />
          : textbook ? <div className="space-y-4 text-sm text-slate-700">
            <div className="flex items-center gap-3"><FileTypeBadge format={textbook.format} />
              <span>{textbook.subjectName || 'Предмет не указан'}</span></div>
            {textbook.pageCount != null && <p>Страниц: {textbook.pageCount}</p>}
            {textbook.status === 'ARCHIVED' && <p className="text-slate-500">Учебник находится в архиве</p>}
            {textbook.status === 'BLOCKED' && <p className="text-red-600">Учебник недоступен для просмотра</p>}
          </div> : <ErrorBlock message="Не удалось загрузить данные" />}
  </Modal>;
}
