import { useQuery } from '@tanstack/react-query';
import { getTestCycleSummaries } from '../services/testCyclesService';

export function useSmokeCycleSummaries(projectId?: string) {
  return useQuery({
    queryKey: ['test-cycles', 'smoke', 'summary', projectId],
    queryFn: () => getTestCycleSummaries(projectId, 'SMOKE'),
    enabled: Boolean(projectId),
  });
}
