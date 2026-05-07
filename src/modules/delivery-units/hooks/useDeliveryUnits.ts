import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeliveryUnit } from '../../../types';
import {
  getDeliveryUnits,
  removeDeliveryUnit,
  saveDeliveryUnit,
} from '../services/deliveryUnitsService';

export function useDeliveryUnits(projectId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['delivery-units', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => getDeliveryUnits(projectId),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (deliveryUnit: DeliveryUnit) => saveDeliveryUnit(deliveryUnit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => removeDeliveryUnit(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
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
