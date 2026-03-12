import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storageService } from './services/storageService';
import { Functionality, TestExecution, RegressionCycle, TestPlan, Project, TestCase, Sprint, Role, Module, TestRun, MeetingNote } from './types';

export function useProjects() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['projects'],
    queryFn: storageService.getProjects,
  });

  const saveMutation = useMutation({
    mutationFn: async (project: Project) => {
      storageService.saveProject(project);
      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      storageService.deleteProject(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return { 
    ...query, 
    save: saveMutation.mutateAsync, 
    delete: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
}

export function useMeetingNotes(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['meeting_notes', projectId],
    queryFn: () => storageService.getMeetingNotes(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (note: MeetingNote) => Promise.resolve(storageService.saveMeetingNote(note)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meeting_notes', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(storageService.deleteMeetingNote(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meeting_notes', projectId] }),
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

export function useTestCases(projectId?: string, functionalityId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['test_cases', projectId, functionalityId],
    queryFn: () => storageService.getTestCases(projectId, functionalityId),
  });

  const saveMutation = useMutation({
    mutationFn: (testCase: TestCase) => Promise.resolve(storageService.saveTestCase(testCase)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['test_cases', projectId, functionalityId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(storageService.deleteTestCase(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['test_cases', projectId, functionalityId] }),
  });

  return { ...query, save: saveMutation.mutate, delete: deleteMutation.mutate };
}

export function useSprints(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => storageService.getSprints(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (sprint: Sprint) => Promise.resolve(storageService.saveSprint(sprint)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sprints', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(storageService.deleteSprint(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sprints', projectId] }),
  });

  return { ...query, save: saveMutation.mutate, delete: deleteMutation.mutate };
}

export function useRoles(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['roles', projectId],
    queryFn: () => storageService.getRoles(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (role: Role) => Promise.resolve(storageService.saveRole(role)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(storageService.deleteRole(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles', projectId] }),
  });

  return { ...query, save: saveMutation.mutate, delete: deleteMutation.mutate };
}

export function useModules(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['modules', projectId],
    queryFn: () => storageService.getModules(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (module: Module) => Promise.resolve(storageService.saveModule(module)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modules', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(storageService.deleteModule(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modules', projectId] }),
  });

  return { ...query, save: saveMutation.mutate, delete: deleteMutation.mutate };
}

export function useTestRuns(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['test_runs', projectId],
    queryFn: () => storageService.getTestRuns(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (run: TestRun) => Promise.resolve(storageService.saveTestRun(run)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['test_runs', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(storageService.deleteTestRun(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['test_runs', projectId] }),
  });

  return { ...query, save: saveMutation.mutate, delete: deleteMutation.mutate };
}
