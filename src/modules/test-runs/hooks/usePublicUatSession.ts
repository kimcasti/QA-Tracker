import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activatePublicUatSession,
  completePublicUatSession,
  getPublicUatSession,
  getPublicUatSessionStatus,
  revokePublicUatSession,
  savePublicUatResult,
} from '../services/publicUatSessionsService';
import type {
  ActivatePublicUatSessionInput,
  PublicUatResultUpdateInput,
} from '../types/model';

export function usePublicUatSessionStatus(testRunDocumentId?: string | null) {
  return useQuery({
    queryKey: ['public-uat-session', 'status', testRunDocumentId],
    queryFn: () => getPublicUatSessionStatus(String(testRunDocumentId)),
    enabled: Boolean(testRunDocumentId),
  });
}

export function usePublicUatSessionActions(projectId?: string) {
  const queryClient = useQueryClient();

  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: ['test-runs', 'summary', projectId] });
    queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] });
  };

  const activateMutation = useMutation({
    mutationFn: ({
      testRunDocumentId,
      input,
    }: {
      testRunDocumentId: string;
      input: ActivatePublicUatSessionInput;
    }) => activatePublicUatSession(testRunDocumentId, input),
    onSuccess: (_, variables) => {
      invalidateRelated();
      queryClient.invalidateQueries({
        queryKey: ['public-uat-session', 'status', variables.testRunDocumentId],
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (testRunDocumentId: string) => revokePublicUatSession(testRunDocumentId),
    onSuccess: (_, testRunDocumentId) => {
      invalidateRelated();
      queryClient.invalidateQueries({
        queryKey: ['public-uat-session', 'status', testRunDocumentId],
      });
    },
  });

  return {
    activate: activateMutation.mutateAsync,
    revoke: revokeMutation.mutateAsync,
    isActivating: activateMutation.isPending,
    isRevoking: revokeMutation.isPending,
  };
}

export function usePublicUatSession(token?: string | null) {
  return useQuery({
    queryKey: ['public-uat-session', token],
    queryFn: () => getPublicUatSession(String(token)),
    enabled: Boolean(token),
    retry: false,
  });
}

export function usePublicUatResultActions(token?: string | null) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: ({
      resultDocumentId,
      input,
    }: {
      resultDocumentId: string;
      input: PublicUatResultUpdateInput;
    }) => savePublicUatResult(String(token), resultDocumentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-uat-session', token] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completePublicUatSession(String(token)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-uat-session', token] });
    },
  });

  return {
    saveResult: saveMutation.mutateAsync,
    completeSession: completeMutation.mutateAsync,
    isSavingResult: saveMutation.isPending,
    isCompletingSession: completeMutation.isPending,
  };
}
