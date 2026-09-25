import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { runnerService } from '../services/runnerService';

export function useAutomationRunner(runId: string, open: boolean) {
  const client = useQueryClient();
  const queryKey = ['automation-runner', runId];
  const inspection = useQuery({
    queryKey, queryFn: () => runnerService.inspect(runId), enabled: Boolean(runId),
    refetchInterval: open ? 3000 : false,
  });
  const enqueue = useMutation({
    mutationFn: (data: Parameters<typeof runnerService.enqueue>[1]) => runnerService.enqueue(runId, data),
    retry: false,
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
  return { inspection, enqueue };
}
