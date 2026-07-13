import type { AssignmentStatus } from './types';

const FINAL_ATTEMPT_STATUSES: AssignmentStatus[] = [
  'AWAITING_REVIEW',
  'REVIEWED',
  'COMPLETED',
  'OPEN_FOR_VIEWING',
];

export function isFinalAttemptStatus(status: AssignmentStatus | 'NOT_STARTED'): boolean {
  return (FINAL_ATTEMPT_STATUSES as string[]).includes(status);
}
