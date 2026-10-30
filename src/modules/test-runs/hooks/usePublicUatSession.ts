import { Http } from '../../../config/http';
import { useWorkspaceAccess } from '../../workspace/hooks/useWorkspaceAccess';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activatePublicUatSession,
  reopenPublicUatSession,
  changePublicUatSessionExpiration,
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

export function usePublicUatManagementAccess(projectId?: string) {
  const { data: workspace } = useWorkspaceAccess();
  const context = useQuery({
    queryKey: ['public-uat-session', 'management-context', projectId],
    queryFn: async () => {
      const response = await Http.get<{ projects: Array<{ documentId: string; key: string; organization?: { documentId: string } }> }>('/api/me/project-contexts');
      return response.data.projects.find(project => project.key === projectId || project.documentId === projectId) || null;
    },
    enabled: Boolean(projectId),
    retry: false,
  });
  return Boolean(context.data?.organization?.documentId && workspace?.memberships.some(membership =>
    membership.organization?.documentId === context.data?.organization?.documentId &&
    ['owner', 'qa-lead'].includes(membership.role?.code || '')));
}

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

  const reopenMutation = useMutation({
    mutationFn: ({ testRunDocumentId, expiresAt }: { testRunDocumentId: string; expiresAt?: string }) =>
      reopenPublicUatSession(testRunDocumentId, expiresAt ? { expiresAt } : {}),
    onSettled: async (_, __, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['test-runs', 'summary', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['public-uat-session', 'status', variables.testRunDocumentId] }),
      ]);
    },
  });

  const expirationMutation = useMutation({
    mutationFn: ({ testRunDocumentId, expiresAt }: { testRunDocumentId: string; expiresAt: string }) =>
      changePublicUatSessionExpiration(testRunDocumentId, expiresAt),
    onSettled: async (_, __, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['test-runs', 'summary', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['public-uat-session', 'status', variables.testRunDocumentId] }),
      ]);
    },
  });

  return {
    changeExpiration: expirationMutation.mutateAsync,
    isChangingExpiration: expirationMutation.isPending,
    reopen: reopenMutation.mutateAsync,
    isReopening: reopenMutation.isPending,
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
