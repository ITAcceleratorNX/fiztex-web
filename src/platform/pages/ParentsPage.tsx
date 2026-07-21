import { UsersPage } from './UsersPage';

/** The account and the school profile are the same person — this is the unified list, filtered to parents. */
export function ParentsPage() {
  return <UsersPage forcedRole="PARENT" />;
}
