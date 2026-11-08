import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTestCases,
  markManualCasesAsCandidates,
  removeTestCase,
  reorderTestCases,
  saveTestCase,
} from '../services/testCasesService';
import type { TestCase } from '../../../types';
import { invalidateWorkspaceCache } from '../../workspace/services/workspaceService';
import { saveBatch } from '../utils/saveBatch';

export function useTestCases(projectId?: string, functionalityId?: string, functionalityDocumentId?: string, assertWriteActive?: () => void) {
  const queryClient = useQueryClient();
  const queryKey = functionalityDocumentId
    ? ['test-cases', projectId, functionalityId || 'all', functionalityDocumentId] as const
    : ['test-cases', projectId, functionalityId || 'all'] as const;
  const scope = JSON.stringify([projectId, functionalityId, functionalityDocumentId]);
  const gate = useRef({ pending: false, blocked: false, active: true, scope });
  if (gate.current.scope !== scope) {
    gate.current.active = false;
    gate.current = { pending: false, blocked: false, active: true, scope };
  }
  const localGate = gate.current;
  useEffect(() => {
    localGate.active = true;
    return () => { localGate.active = false; };
  }, [localGate]);
  const assertScopedActive = () => {
    if (!localGate.active) throw new Error('El editor está cerrado o ya no está activo.');
    assertWriteActive?.();
  };
  const [writePending, setWritePending] = useState(false);
  const [writeBlocked, setWriteBlocked] = useState(false);
  const runScoped = async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (!functionalityDocumentId) return operation();
    if (localGate.pending) throw new Error('Hay una escritura pendiente.');
    if (localGate.blocked) throw new Error('Recarga para reconciliar el resultado antes de guardar.');
    assertScopedActive();
    localGate.pending = true;
    setWritePending(true);
    try {
      return await operation();
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (!status || status === 409 || status === 408 || status >= 500) {
        localGate.blocked = true;
        setWriteBlocked(true);
      }
      throw error;
    } finally {
      localGate.pending = false;
      setWritePending(false);
    }
  };
  const saveScoped = (testCase: TestCase) => saveTestCase(testCase, functionalityDocumentId, functionalityDocumentId ? assertScopedActive : assertWriteActive);

  const query = useQuery({
    queryKey,
    queryFn: () => getTestCases(projectId, functionalityId, functionalityDocumentId),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (testCase: TestCase) => runScoped(() => saveScoped(testCase)),
    onSuccess: async () => {
      invalidateWorkspaceCache();
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['plan-usage', 'test-cases'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (functionalityDocumentId) return Promise.reject(new Error('Elimina casos desde la vista de casos, fuera de Canvas.'));
      return removeTestCase(id);
    },
    onSuccess: async () => {
      invalidateWorkspaceCache();
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['plan-usage', 'test-cases'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: Array<{ documentId: string; sortOrder: number }>) =>
      functionalityDocumentId ? Promise.reject(new Error('Ordena casos desde la vista de casos, fuera de Canvas.')) : reorderTestCases(items),
    onSuccess: async reorderedTestCases => {
      invalidateWorkspaceCache();
      queryClient.setQueryData<TestCase[] | undefined>(queryKey, previous => {
        if (!previous?.length) return previous;

        const reorderedByDocumentId = new Map(
          reorderedTestCases.map(item => [item.documentId, item] as const),
        );

        return previous.map(item => reorderedByDocumentId.get(item.documentId || '') ?? item);
      });
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['plan-usage', 'test-cases'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] });
    },
  });

  return {
    ...query,
    data: query.data,
    writePending,
    writeBlocked,
    reconcileWrites: async () => {
      if (!functionalityDocumentId) return query.refetch();
      if (localGate.pending) throw new Error('Hay una escritura pendiente.');
      localGate.pending = true;
      setWritePending(true);
      try {
        assertScopedActive();
        const cases = await getTestCases(projectId, functionalityId, functionalityDocumentId);
        assertScopedActive();
        queryClient.setQueryData(queryKey, cases);
        localGate.blocked = false;
        setWriteBlocked(false);
        return cases;
      } finally {
        localGate.pending = false;
        setWritePending(false);
      }
    },
    save: saveMutation.mutate,
    saveAsync: saveMutation.mutateAsync,
    markManualCandidates: async (functionalityIds: string[], caseIds: string[]) => runScoped(async () => {
      if (!projectId) throw new Error('Selecciona un proyecto.');
      try {
        const result = await markManualCasesAsCandidates(projectId, functionalityIds, caseIds, functionalityDocumentId, functionalityDocumentId ? assertScopedActive : assertWriteActive);
        if (functionalityDocumentId && result.failed?.ambiguous) {
          localGate.blocked = true;
          setWriteBlocked(true);
        }
        return result;
      } finally {
        invalidateWorkspaceCache();
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['workspace'] }),
        ]);
      }
    }),
    savePastedCases: async (cases: TestCase[], onProgress?: (count: number) => void) => runScoped(async () => {
      const result = await saveBatch(cases, saveScoped, onProgress);
      if (functionalityDocumentId && result.failed?.ambiguous) {
        localGate.blocked = true;
        setWriteBlocked(true);
      }
      invalidateWorkspaceCache();
      // Refresh errors must not hide confirmed writes from the caller.
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['workspace'] }),
        queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['plan-usage', 'test-cases'] }),
      ]);
      return result;
    }),
    reorder: reorderMutation.mutateAsync,
    delete: deleteMutation.mutate,
    invalidate: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      await queryClient.invalidateQueries({ queryKey });
    },
    saveManyWithSingleRefresh: async (testCases: TestCase[]) => runScoped(async () => {
      for (const testCase of testCases) {
        await saveScoped(testCase);
      }

      invalidateWorkspaceCache();
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['plan-usage', 'test-cases'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] });
    }),
  };
}
