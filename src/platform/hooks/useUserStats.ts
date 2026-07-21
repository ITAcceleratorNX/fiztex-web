import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserStats } from '../services';

export const userStatsKeys = {
  all: ['admin', 'accounts', 'stats'] as const,
};

/** Shared account stats for the users table — survives route remounts between role tabs. */
export function useUserStats() {
  return useQuery({
    queryKey: userStatsKeys.all,
    queryFn: ({ signal }) => getUserStats(signal),
    staleTime: 60_000,
  });
}

export function useInvalidateUserStats() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: userStatsKeys.all });
}
