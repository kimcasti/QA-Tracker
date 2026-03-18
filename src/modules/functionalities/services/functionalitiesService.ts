import { TestType, type Functionality } from '../../../types';
import {
  priorityFromApi,
  priorityToApi,
  riskFromApi,
  riskToApi,
  testStatusFromApi,
  testStatusToApi,
  testTypeFromApi,
  testTypeToApi,
} from '../../shared/services/enumMappers';
import {
  deleteDocument,
  listDocuments,
  populateParams,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { getModules, getRoles, getSprints } from '../../settings/services/settingsService';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { FunctionalityDto } from '../types/api';

export function buildNextFunctionalityCode(
  moduleName: string,
  functionalities: Array<Pick<Functionality, 'id' | 'module'>>,
) {
  if (!moduleName) return '';

  const prefix = moduleName.trim().substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');

  const nextSequence =
    functionalities
      .filter(item => item.id.startsWith(`${prefix}-`))
      .map(item => {
        const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`));
        return match ? Number.parseInt(match[1], 10) : 0;
      })
      .reduce((max, current) => Math.max(max, current), 0) + 1;

  return `${prefix}-${nextSequence.toString().padStart(2, '0')}`;
}

function mapFunctionality(document: FunctionalityDto): Functionality {
  return {
    documentId: document.documentId,
    id: document.code,
    projectId: document.project?.key || '',
    module: document.module?.name || '',
    name: document.name,
    roles: (document.personaRoles || []).map(role => role.name),
    testTypes: (document.testTypes || []).map(type => testTypeFromApi(type)),
    isCore: Boolean(document.isCore),
    isRegression: Boolean(document.isRegression),
    isSmoke: Boolean(document.isSmoke),
    lastFunctionalChangeAt: document.lastFunctionalChangeAt,
    deliveryDate: document.deliveryDate || '',
    status: testStatusFromApi(document.status),
    priority: priorityFromApi(document.priority),
    riskLevel: riskFromApi(document.riskLevel),
    sprint: document.sprint?.name,
    storyId: document.storyLegacyId,
  };
}

export async function getFunctionalities(projectId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<FunctionalityDto>('/api/functionalities', {
    ...populateParams(['project', 'module', 'personaRoles', 'sprint']),
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  return documents.map(mapFunctionality);
}

export async function getNextFunctionalityCode(projectId: string, moduleName: string) {
  const functionalities = await getFunctionalities(projectId);
  return buildNextFunctionalityCode(moduleName, functionalities);
}

export async function saveFunctionality(functionality: Functionality) {
  const context = await findProjectContext(functionality.projectId);
  if (!context) {
    throw new Error(`Project ${functionality.projectId} is not available in the workspace.`);
  }

  const [documents, modules, roles, sprints] = await Promise.all([
    functionality.documentId
      ? Promise.resolve([])
      : listDocuments<FunctionalityDto>('/api/functionalities', {
          'filters[project][documentId][$eq]': context.documentId,
          'filters[code][$eq]': functionality.id,
        }),
    getModules(functionality.projectId),
    getRoles(functionality.projectId),
    getSprints(functionality.projectId),
  ]);

  const module = modules.find(item => item.name === functionality.module);
  const sprint = sprints.find(item => item.name === functionality.sprint);
  const personaRoles = roles
    .filter(item => functionality.roles.includes(item.name))
    .map(item => ({ documentId: item.id }));

  if (!functionality.documentId && documents[0]?.documentId) {
    throw new Error(`Functionality code ${functionality.id} already exists in this project.`);
  }

  const saved = await upsertDocument<FunctionalityDto>(
    '/api/functionalities',
    functionality.documentId || documents[0]?.documentId || null,
    {
      code: functionality.id,
      name: functionality.name,
      testTypes: (functionality.testTypes?.length
        ? functionality.testTypes
        : [TestType.FUNCTIONAL]
      ).map(testTypeToApi),
      isCore: Boolean(functionality.isCore),
      isRegression: functionality.isRegression,
      isSmoke: functionality.isSmoke,
      lastFunctionalChangeAt: functionality.lastFunctionalChangeAt || null,
      deliveryDate: functionality.deliveryDate || null,
      status: testStatusToApi(functionality.status),
      priority: priorityToApi(functionality.priority),
      riskLevel: riskToApi(functionality.riskLevel),
      storyLegacyId: functionality.storyId || null,
      organization: relation(context.organizationDocumentId),
      project: relation(context.documentId),
      module: relation(module?.id),
      sprint: relation(sprint?.id),
      personaRoles: personaRoles.length ? { connect: personaRoles } : { disconnect: [] },
    },
  );

  return mapFunctionality(saved);
}

export async function removeFunctionality(projectId: string, functionalityId: string) {
  const context = await findProjectContext(projectId);
  if (!context) return;

  const documents = await listDocuments<FunctionalityDto>('/api/functionalities', {
    'filters[project][documentId][$eq]': context.documentId,
    'filters[code][$eq]': functionalityId,
  });

  const documentId = documents[0]?.documentId;
  if (!documentId) return;

  await deleteDocument('/api/functionalities', documentId);
}

export async function bulkUpdateFunctionalities(
  projectId: string,
  ids: string[],
  updates: Partial<Functionality>,
) {
  const functionalities = await getFunctionalities(projectId);
  const targets = functionalities.filter(item => ids.includes(item.id));
  await Promise.all(targets.map(target => saveFunctionality({ ...target, ...updates })));
}

export async function bulkAddFunctionalities(functionalities: Functionality[]) {
  if (functionalities.length === 0) return 0;

  const existing = await getFunctionalities(functionalities[0].projectId);
  const existingIds = new Set(existing.map(item => item.id));
  const uniqueItems = functionalities.filter(item => !existingIds.has(item.id));

  await Promise.all(uniqueItems.map(item => saveFunctionality(item)));
  return uniqueItems.length;
}
