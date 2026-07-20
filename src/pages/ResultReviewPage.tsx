import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErrorBlock } from '@/components/ui/StateBlock';
import { ReviewModal } from '@/pages/modals/ReviewModal';

export function ResultReviewPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const parsedAttemptId = Number(attemptId);

  if (!Number.isFinite(parsedAttemptId) || parsedAttemptId <= 0) {
    return <ErrorBlock message="Некорректный идентификатор попытки." />;
  }

  function handleClose() {
    navigate(`/results${location.search}`, { replace: true });
  }

  return (
    <ReviewModal
      open
      attemptId={parsedAttemptId}
      onClose={handleClose}
      variant="page"
    />
  );
}

