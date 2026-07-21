import { UsersPage } from './UsersPage';

/** The account and the school profile are the same person — this is the unified list, filtered to teachers. */
export function TeachersPage() {
  return <UsersPage forcedRole="TEACHER" />;
}
