import type { Module, Role, Sprint } from '../../../types';
import { sprintStatusFromApi, sprintStatusToApi } from '../../shared/services/enumMappers';
import {
  deleteDocument,
  listDocuments,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { ProjectModuleDto, ProjectRoleDto, SprintDto } from '../types/api';

function requireProjectId(projectId?: string) {
  if (!projectId) {
    throw new Error('A projectId is required for project settings.');
  }

  return projectId;
}

function mapModule(document: ProjectModuleDto): Module {
  return {
    id: document.documentId,
    projectId: document.project?.key || '',
    name: document.name,
    description: document.description || '',
  };
}

function mapRole(document: ProjectRoleDto): Role {
  return {
    id: document.documentId,
    projectId: document.project?.key || '',
    name: document.name,
    description: document.description || '',
  };
}

function mapSprint(document: SprintDto): Sprint {
  return {
    id: document.documentId,
    projectId: document.project?.key || '',
    name: document.name,
    startDate: document.startDate,
    endDate: document.endDate,
    status: sprintStatusFromApi(document.status),
    objective: document.objective || '',
  };
}

export async function getModules(projectId?: string) {
  const resolvedProjectId = projectId ? requireProjectId(projectId) : null;
  const context = resolvedProjectId ? await findProjectContext(resolvedProjectId) : null;
  const documents = await listDocuments<ProjectModuleDto>('/api/project-modules', {
    'populate[project][fields][0]': 'key',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  return documents.map(mapModule);
}

export async function saveModule(module: Module) {
  const context = await findProjectContext(requireProjectId(module.projectId));
  if (!context) {
    throw new Error(`Project ${module.projectId} is not available in the workspace.`);
  }

  const existingDocuments = await listDocuments<ProjectModuleDto>('/api/project-modules', {
    'filters[project][documentId][$eq]': context.documentId,
  });
  const documentId = existingDocuments.some(item => item.documentId === module.id) ? module.id : null;

  const saved = await upsertDocument<ProjectModuleDto>('/api/project-modules', documentId, {
    name: module.name,
    description: module.description,
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
  });

  return mapModule(saved);
}

export async function removeModule(id: string) {
  await deleteDocument('/api/project-modules', id);
}

export async function getRoles(projectId?: string) {
  const resolvedProjectId = projectId ? requireProjectId(projectId) : null;
  const context = resolvedProjectId ? await findProjectContext(resolvedProjectId) : null;
  const documents = await listDocuments<ProjectRoleDto>('/api/project-persona-roles', {
    'populate[project][fields][0]': 'key',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  return documents.map(mapRole);
}

export async function saveRole(role: Role) {
  const context = await findProjectContext(requireProjectId(role.projectId));
  if (!context) {
    throw new Error(`Project ${role.projectId} is not available in the workspace.`);
  }

  const existingDocuments = await listDocuments<ProjectRoleDto>('/api/project-persona-roles', {
    'filters[project][documentId][$eq]': context.documentId,
  });
  const documentId = existingDocuments.some(item => item.documentId === role.id) ? role.id : null;

  const saved = await upsertDocument<ProjectRoleDto>(
    '/api/project-persona-roles',
    documentId,
    {
      name: role.name,
      description: role.description,
      organization: relation(context.organizationDocumentId),
      project: relation(context.documentId),
    },
  );

  return mapRole(saved);
}

export async function removeRole(id: string) {
  await deleteDocument('/api/project-persona-roles', id);
}

export async function getSprints(projectId?: string) {
  const resolvedProjectId = projectId ? requireProjectId(projectId) : null;
  const context = resolvedProjectId ? await findProjectContext(resolvedProjectId) : null;
  const documents = await listDocuments<SprintDto>('/api/sprints', {
    'populate[project][fields][0]': 'key',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  return documents.map(mapSprint);
}

export async function saveSprint(sprint: Sprint) {
  const context = await findProjectContext(requireProjectId(sprint.projectId));
  if (!context) {
    throw new Error(`Project ${sprint.projectId} is not available in the workspace.`);
  }

  const existingDocuments = await listDocuments<SprintDto>('/api/sprints', {
    'filters[project][documentId][$eq]': context.documentId,
  });
  const documentId = existingDocuments.some(item => item.documentId === sprint.id) ? sprint.id : null;

  const saved = await upsertDocument<SprintDto>('/api/sprints', documentId, {
    name: sprint.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    status: sprintStatusToApi(sprint.status),
    objective: sprint.objective,
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
  });

  return mapSprint(saved);
}

export async function removeSprint(id: string) {
  await deleteDocument('/api/sprints', id);
}
