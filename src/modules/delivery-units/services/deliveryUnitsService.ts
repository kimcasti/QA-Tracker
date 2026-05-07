import {
  DeliveryUnitStatus,
  DeliveryUnitType,
  type DeliveryUnit,
  type DeliveryActivityTemplate,
} from '../../../types';
import {
  deleteDocument,
  listDocuments,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { DeliveryUnitDto } from '../types/api';

function mapDeliveryUnit(document: DeliveryUnitDto): DeliveryUnit {
  const amountValue =
    typeof document.amount === 'number'
      ? document.amount
      : typeof document.amount === 'string' && document.amount.trim()
        ? Number(document.amount)
        : undefined;

  const activities: DeliveryActivityTemplate[] = Array.isArray(document.activities)
    ? document.activities.map(activity => ({
        documentId: activity.documentId,
        id: activity.documentId,
        projectId: document.project?.key || '',
        name: activity.name,
        description: activity.description || '',
        isActive: activity.isActive !== false,
      }))
    : [];

  return {
    documentId: document.documentId,
    id: document.documentId,
    projectId: document.project?.key || '',
    name: document.name,
    proposalDocumentId: document.proposal?.documentId || undefined,
    proposalName: document.proposal?.name || '',
    proposalOwner: document.proposal?.proposalOwner || '',
    type: Object.values(DeliveryUnitType).includes(document.type as DeliveryUnitType)
      ? (document.type as DeliveryUnitType)
      : DeliveryUnitType.PHASE,
    baseDescription: document.baseDescription || '',
    startDate: document.startDate || '',
    estimatedEndDate: document.estimatedEndDate || '',
    periodLabel: document.periodLabel || '',
    amount: Number.isFinite(amountValue as number) ? amountValue : undefined,
    status: Object.values(DeliveryUnitStatus).includes(document.status as DeliveryUnitStatus)
      ? (document.status as DeliveryUnitStatus)
      : DeliveryUnitStatus.PLANNED,
    sortOrder: typeof document.sortOrder === 'number' ? document.sortOrder : 0,
    activities,
    activityIds: activities.map(activity => activity.documentId || activity.id).filter(Boolean),
  };
}

export async function getDeliveryUnits(projectId?: string) {
  if (!projectId) return [];

  const context = await findProjectContext(projectId);
  const documents = await listDocuments<DeliveryUnitDto>('/api/delivery-units', {
    'populate[project][fields][0]': 'key',
    'populate[activities][fields][0]': 'name',
    'populate[activities][fields][1]': 'description',
    'populate[activities][fields][2]': 'isActive',
    'populate[proposal][fields][0]': 'name',
    'populate[proposal][fields][1]': 'proposalOwner',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
    sort: 'sortOrder:asc',
  });

  return documents
    .map(mapDeliveryUnit)
    .sort((left, right) => {
      const sortDiff = (left.sortOrder || 0) - (right.sortOrder || 0);
      if (sortDiff !== 0) return sortDiff;
      const leftDate = left.startDate || left.estimatedEndDate || '';
      const rightDate = right.startDate || right.estimatedEndDate || '';
      const dateDiff = leftDate.localeCompare(rightDate);
      if (dateDiff !== 0) return dateDiff;
      return left.name.localeCompare(right.name);
    });
}

export async function saveDeliveryUnit(deliveryUnit: DeliveryUnit) {
  const context = await findProjectContext(deliveryUnit.projectId);
  if (!context) {
    throw new Error(`Project ${deliveryUnit.projectId} is not available in the workspace.`);
  }

  const saved = await upsertDocument<DeliveryUnitDto>(
    '/api/delivery-units',
    deliveryUnit.documentId || null,
    {
      name: deliveryUnit.name,
      type: deliveryUnit.type,
      baseDescription: deliveryUnit.baseDescription || null,
      startDate: deliveryUnit.startDate || null,
      estimatedEndDate: deliveryUnit.estimatedEndDate || null,
      periodLabel: deliveryUnit.periodLabel || null,
      amount:
        typeof deliveryUnit.amount === 'number' && Number.isFinite(deliveryUnit.amount)
          ? deliveryUnit.amount
          : null,
      status: deliveryUnit.status,
      sortOrder:
        typeof deliveryUnit.sortOrder === 'number' && Number.isFinite(deliveryUnit.sortOrder)
          ? deliveryUnit.sortOrder
          : 0,
      proposal: deliveryUnit.proposalDocumentId ? relation(deliveryUnit.proposalDocumentId) : null,
      activities: {
        set: Array.isArray(deliveryUnit.activityIds)
          ? deliveryUnit.activityIds.map(documentId => ({ documentId }))
          : [],
      },
      organization: relation(context.organizationDocumentId),
      project: relation(context.documentId),
    },
  );

  return mapDeliveryUnit(saved);
}

export async function removeDeliveryUnit(documentId: string) {
  await deleteDocument('/api/delivery-units', documentId);
}
