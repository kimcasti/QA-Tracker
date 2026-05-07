import { type DeliveryActivityTemplate } from '../../../types';
import {
  deleteDocument,
  listDocuments,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { DeliveryActivityTemplateDto } from '../types/api';

function mapDeliveryActivityTemplate(
  document: DeliveryActivityTemplateDto,
): DeliveryActivityTemplate {
  return {
    documentId: document.documentId,
    id: document.documentId,
    projectId: document.project?.key || '',
    name: document.name,
    description: document.description || '',
    isActive: document.isActive !== false,
  };
}

export async function getDeliveryActivityTemplates(projectId?: string) {
  if (!projectId) return [];

  const context = await findProjectContext(projectId);
  const documents = await listDocuments<DeliveryActivityTemplateDto>(
    '/api/delivery-activity-templates',
    {
      'populate[project][fields][0]': 'key',
      ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
      sort: 'name:asc',
    },
  );

  return documents.map(mapDeliveryActivityTemplate);
}

export async function saveDeliveryActivityTemplate(
  template: DeliveryActivityTemplate,
) {
  const context = await findProjectContext(template.projectId);
  if (!context) {
    throw new Error(`Project ${template.projectId} is not available in the workspace.`);
  }

  const saved = await upsertDocument<DeliveryActivityTemplateDto>(
    '/api/delivery-activity-templates',
    template.documentId || null,
    {
      name: template.name,
      description: template.description || null,
      isActive: template.isActive,
      organization: relation(context.organizationDocumentId),
      project: relation(context.documentId),
    },
  );

  return mapDeliveryActivityTemplate(saved);
}

export async function removeDeliveryActivityTemplate(documentId: string) {
  await deleteDocument('/api/delivery-activity-templates', documentId);
}
