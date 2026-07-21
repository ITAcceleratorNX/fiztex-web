import { UsersPage } from './UsersPage';

/** The account and the school profile are the same person — this is the unified list, filtered to students. */
export function StudentsPage() {
  return <UsersPage forcedRole="STUDENT" />;
}
