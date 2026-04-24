import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TestCaseTemplate } from '../../../types';
import {
  getTestCaseTemplates,
  removeTestCaseTemplate,
  saveTestCaseTemplate,
} from '../services/testCaseTemplatesService';

export function useTestCaseTemplates(projectId?: string, moduleName?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['test-case-templates', projectId, moduleName || 'none'],
    queryFn: () => getTestCaseTemplates(projectId, moduleName),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (template: TestCaseTemplate) => saveTestCaseTemplate(template),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['test-case-templates', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeTestCaseTemplate(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['test-case-templates', projectId] }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
  };
}
