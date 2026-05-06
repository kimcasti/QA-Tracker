import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSuperadminOrganization } from '../services/superadminService';

export function useSuperadminOrganizationActions(organizationDocumentId?: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'organizations'] }),
      queryClient.invalidateQueries({
        queryKey: ['superadmin', 'organizations', organizationDocumentId, 'audit-logs'],
      }),
    ]);
  };

  return {
    updateOrganization: useMutation({
      mutationFn: ({
        plan,
        status,
        planStatus,
        planExpiresAt,
        gracePeriodEndsAt,
        aiLimit,
        exportLimitMonthly,
        contactNumber,
        billingNotes,
        paymentMethod,
        externalReference,
      }: {
        plan: 'starter' | 'growth' | 'enterprise';
        status: 'active' | 'inactive';
        planStatus: 'active' | 'past_due' | 'canceled';
        planExpiresAt?: string | null;
        gracePeriodEndsAt?: string | null;
        aiLimit?: number | null;
        exportLimitMonthly?: number | null;
        contactNumber?: string | null;
        billingNotes?: string | null;
        paymentMethod?: 'manual_transfer' | 'nequi' | 'whatsapp' | 'wompi' | 'mercadopago' | 'other' | null;
        externalReference?: string | null;
      }) =>
        updateSuperadminOrganization({
          organizationDocumentId: String(organizationDocumentId),
          plan,
          status,
          planStatus,
          planExpiresAt,
          gracePeriodEndsAt,
          aiLimit,
          exportLimitMonthly,
          contactNumber,
          billingNotes,
          paymentMethod,
          externalReference,
        }),
      onSuccess: invalidate,
    }),
  };
}
