import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storageService } from './services/storageService';
import { Functionality, TestExecution, RegressionCycle, TestPlan, Project } from './types';

export function useProjects() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['projects'],
    queryFn: storageService.getProjects,
  });

  const saveMutation = useMutation({
    mutationFn: (project: Project) => Promise.resolve(storageService.saveProject(project)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(storageService.deleteProject(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  return { ...query, save: saveMutation.mutate, delete: deleteMutation.mutate };
}

export function useFunctionalities(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['functionalities', projectId],
    queryFn: () => storageService.getFunctionalities(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (func: Functionality) => Promise.resolve(storageService.saveFunctionality(func)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['functionalities', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(storageService.deleteFunctionality(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['functionalities', projectId] }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, updates }: { ids: string[], updates: Partial<Functionality> }) => 
      Promise.resolve(storageService.bulkUpdateFunctionalities(ids, updates)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['functionalities', projectId] }),
  });

  const bulkAddMutation = useMutation({
    mutationFn: (newFuncs: Functionality[]) => 
      Promise.resolve(storageService.bulkAddFunctionalities(newFuncs)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['functionalities', projectId] }),
  });

  return { 
    ...query, 
    save: saveMutation.mutate, 
    delete: deleteMutation.mutate,
    bulkUpdate: bulkUpdateMutation.mutateAsync,
    bulkAdd: bulkAddMutation.mutateAsync
  };
}

export function useExecutions(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['executions', projectId],
    queryFn: () => storageService.getExecutions(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (exec: TestExecution) => Promise.resolve(storageService.saveExecution(exec)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['executions', projectId] }),
  });

  return { ...query, save: saveMutation.mutate };
}

export function useRegressionCycles(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['regression_cycles', projectId],
    queryFn: () => storageService.getRegressionCycles(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (cycle: RegressionCycle) => Promise.resolve(storageService.saveRegressionCycle(cycle)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['regression_cycles', projectId] }),
  });

  return { ...query, save: saveMutation.mutate };
}

export function useSmokeCycles(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['smoke_cycles', projectId],
    queryFn: () => storageService.getSmokeCycles(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (cycle: RegressionCycle) => Promise.resolve(storageService.saveSmokeCycle(cycle)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['smoke_cycles', projectId] }),
  });

  return { ...query, save: saveMutation.mutate };
}

export function useTestPlans(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['test_plans', projectId],
    queryFn: () => storageService.getTestPlans(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (plan: TestPlan) => Promise.resolve(storageService.saveTestPlan(plan)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['test_plans', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(storageService.deleteTestPlan(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['test_plans', projectId] }),
  });

  return { ...query, save: saveMutation.mutate, delete: deleteMutation.mutate };
}
