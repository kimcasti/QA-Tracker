import { useQuery } from '@tanstack/react-query';
import { getTestRunSummaries } from '../services/testRunsService';

export function useTestRunSummaries(projectId?: string) {
  return useQuery({
    queryKey: ['test-runs', 'summary', projectId],
    queryFn: () => getTestRunSummaries(projectId),
    enabled: Boolean(projectId),
  });
}
