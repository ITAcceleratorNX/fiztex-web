import { useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useMyClassYearDecisions } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { StudentYearDecisionHistory } from '@/platform/components/StudentYearDecisionHistory';

export function MyClassYearDecisionsModal({ classId, onClose, onForbidden }: {
  classId: number; onClose: () => void; onForbidden?: () => void;
}) {
  const history = useMyClassYearDecisions(classId);
  const forbidden = history.error instanceof ApiError && history.error.status === 403;
  useEffect(() => { if (forbidden) onForbidden?.(); }, [forbidden, onForbidden]);

  return <Modal open onClose={onClose} title="История перевода и выпуска" size="lg" scrollable
    footer={<Button variant="secondary" onClick={onClose}>Закрыть</Button>}>
    <p className="mb-4 text-13 text-muted">Решения учеников этого класса, в том числе отменённые. Оформление и отмену приказов выполняет администрация школы.</p>
    {history.isPending ? <LoadingBlock label="Загрузка истории…" /> : history.isError
      ? <ErrorBlock message={forbidden ? 'Доступ к классу изменился. Обновите список классов.' : 'Не удалось загрузить историю решений'}
        onRetry={() => void history.refetch()} />
      : history.data?.length ? <StudentYearDecisionHistory decisions={history.data} showStudent />
        : <EmptyBlock title="Решения ещё не оформлены" description="Когда администрация оформит перевод или выпуск, здесь появятся приказы и история их отмены." />}
  </Modal>;
}
