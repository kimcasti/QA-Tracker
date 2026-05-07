import { useMemo } from 'react';
import { useWorkspace } from './useWorkspace';

export function useWorkspaceAccess() {
  const workspaceQuery = useWorkspace();

  return useMemo(() => {
    const activeMembership = workspaceQuery.data?.memberships?.[0];
    const projectQuota = workspaceQuery.data?.projectQuota;
    const isSuperAdmin = Boolean(workspaceQuery.data?.user?.isSuperAdmin);
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
    const isManager = activeRoleCode === 'manager';
    const isViewer = activeRoleCode === 'viewer';
    const canManageOrganization = isOwner;
    const canManageCycleConfig = isOwner || isQaLead;
    const canAccessSettings = canManageCycleConfig;
    const canMutateWorkspace = Boolean(activeRoleCode) && !isViewer;
    const canCreateProjectsByRole = projectQuota?.allowedByRole ?? canManageCycleConfig;
    const hasReachedProjectLimit = projectQuota?.limitReached ?? false;
    const canCreateProjects = projectQuota?.canCreate ?? canCreateProjectsByRole;
    const canUseAi = projectQuota?.aiUsage?.canUse ?? Boolean(projectQuota?.features?.ai);
    const canUseExports = projectQuota?.exportUsage?.canUse ?? Boolean(projectQuota?.features?.exports);
    const canUseAdvancedReports =
      Boolean(projectQuota?.reports?.qaProgress) || Boolean(projectQuota?.reports?.executiveProjectStatus);

    return {
      ...workspaceQuery,
      activeMembership,
      projectQuota,
      isSuperAdmin,
      activeRoleCode,
      activeRoleName,
      isOwner,
      isQaLead,
      isManager,
      isViewer,
      canManageOrganization,
      canManageCycleConfig,
      canAccessSettings,
      canMutateWorkspace,
      canAccessSuperAdmin: isSuperAdmin,
      canCreateProjectsByRole,
      hasReachedProjectLimit,
      canCreateProjects,
      canUseAi,
      canUseExports,
      canUseAdvancedReports,
    };
  }, [workspaceQuery]);
}
