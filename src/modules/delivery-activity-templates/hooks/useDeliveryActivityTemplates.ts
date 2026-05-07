import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeliveryActivityTemplate } from '../../../types';
import {
  getDeliveryActivityTemplates,
  removeDeliveryActivityTemplate,
  saveDeliveryActivityTemplate,
} from '../services/deliveryActivityTemplatesService';

export function useDeliveryActivityTemplates(projectId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['delivery-activity-templates', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => getDeliveryActivityTemplates(projectId),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (template: DeliveryActivityTemplate) =>
      saveDeliveryActivityTemplate(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['delivery-units', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => removeDeliveryActivityTemplate(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['delivery-units', projectId] });
    },
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
