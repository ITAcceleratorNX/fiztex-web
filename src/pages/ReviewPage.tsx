import { Navigate } from 'react-router-dom';

/** Legacy route kept for old links — canonical review lives in the Results section. */
export function ReviewPage() {
  return <Navigate to="/results" replace />;
}
