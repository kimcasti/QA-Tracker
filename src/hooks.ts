import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storageService } from './services/storageService';
import { Functionality, TestExecution, RegressionCycle } from './types';

export function useFunctionalities() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['functionalities'],
    queryFn: storageService.getFunctionalities,
  });

  const saveMutation = useMutation({
    mutationFn: (func: Functionality) => Promise.resolve(storageService.saveFunctionality(func)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['functionalities'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(storageService.deleteFunctionality(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['functionalities'] }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, updates }: { ids: string[], updates: Partial<Functionality> }) => 
      Promise.resolve(storageService.bulkUpdateFunctionalities(ids, updates)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['functionalities'] }),
  });

  const bulkAddMutation = useMutation({
    mutationFn: (newFuncs: Functionality[]) => 
      Promise.resolve(storageService.bulkAddFunctionalities(newFuncs)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['functionalities'] }),
  });

  return { 
    ...query, 
    save: saveMutation.mutate, 
    delete: deleteMutation.mutate,
    bulkUpdate: bulkUpdateMutation.mutateAsync,
    bulkAdd: bulkAddMutation.mutateAsync
  };
}

export function useExecutions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['executions'],
    queryFn: storageService.getExecutions,
  });

  const saveMutation = useMutation({
    mutationFn: (exec: TestExecution) => Promise.resolve(storageService.saveExecution(exec)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['executions'] }),
  });

  return { ...query, save: saveMutation.mutate };
}

export function useRegressionCycles() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['regression_cycles'],
    queryFn: storageService.getRegressionCycles,
  });

  const saveMutation = useMutation({
    mutationFn: (cycle: RegressionCycle) => Promise.resolve(storageService.saveRegressionCycle(cycle)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['regression_cycles'] }),
  });

  return { ...query, save: saveMutation.mutate };
}
