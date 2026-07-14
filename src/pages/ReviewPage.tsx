import { Navigate } from 'react-router-dom';

/** Legacy route — review now lives inside the «Попытки» tab of «Вступительные тесты». */
export function ReviewPage() {
  return <Navigate to="/admissions?tab=attempts" replace />;
}
