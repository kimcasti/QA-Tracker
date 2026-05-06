import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSuperadminBillingRequest } from '../services/superadminService';

export function useSuperadminBillingRequestActions() {
  const queryClient = useQueryClient();

  return {
    updateBillingRequest: useMutation({
      mutationFn: ({
        billingRequestDocumentId,
        status,
        statusNotes,
        paymentMethod,
        externalReference,
      }: {
        billingRequestDocumentId: string;
        status: 'pending' | 'contacted' | 'approved' | 'rejected' | 'fulfilled';
        statusNotes?: string | null;
        paymentMethod?:
          | 'manual_transfer'
          | 'nequi'
          | 'whatsapp'
          | 'wompi'
          | 'mercadopago'
          | 'other'
          | null;
        externalReference?: string | null;
      }) =>
        updateSuperadminBillingRequest({
          billingRequestDocumentId,
          status,
          statusNotes,
          paymentMethod,
          externalReference,
        }),
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['superadmin', 'billing-requests'] }),
          queryClient.invalidateQueries({ queryKey: ['superadmin', 'organizations'] }),
        ]);
      },
    }),
  };
}
