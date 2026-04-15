import { useMemo } from 'react';
import { useWorkspace } from './useWorkspace';

export function useWorkspaceAccess() {
  const workspaceQuery = useWorkspace();

  return useMemo(() => {
    const activeMembership = workspaceQuery.data?.memberships?.[0];
    const projectQuota = workspaceQuery.data?.projectQuota;
    const activeRoleCode = activeMembership?.role?.code || '';
    const activeRoleName =
      activeMembership?.role?.name ||
      ({
        owner: 'Owner',
        'qa-lead': 'QA Lead',
        'qa-engineer': 'QA Engineer',
        viewer: 'Viewer',
        manager: 'Manager',
      }[activeRoleCode] ?? '');
    const isOwner = activeRoleCode === 'owner';
    const isQaLead = activeRoleCode === 'qa-lead';
    const isViewer = activeRoleCode === 'viewer';
    const canManageOrganization = isOwner;
    const canManageCycleConfig = isOwner || isQaLead;
    const canMutateWorkspace = Boolean(activeRoleCode) && !isViewer;
    const canCreateProjectsByRole = projectQuota?.allowedByRole ?? canManageCycleConfig;
    const hasReachedProjectLimit = projectQuota?.limitReached ?? false;
    const canCreateProjects = projectQuota?.canCreate ?? canCreateProjectsByRole;

    return {
      ...workspaceQuery,
      activeMembership,
      projectQuota,
      activeRoleCode,
      activeRoleName,
      isOwner,
      isQaLead,
      isViewer,
      canManageOrganization,
      canManageCycleConfig,
      canMutateWorkspace,
      canCreateProjectsByRole,
      hasReachedProjectLimit,
      canCreateProjects,
    };
  }, [workspaceQuery]);
}
