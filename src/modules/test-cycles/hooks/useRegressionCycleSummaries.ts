import { useQuery } from '@tanstack/react-query';
import { getTestCycleSummaries } from '../services/testCyclesService';

export function useRegressionCycleSummaries(projectId?: string) {
  return useQuery({
    queryKey: ['test-cycles', 'regression', 'summary', projectId],
    queryFn: () => getTestCycleSummaries(projectId, 'REGRESSION'),
    enabled: Boolean(projectId),
  });
}
