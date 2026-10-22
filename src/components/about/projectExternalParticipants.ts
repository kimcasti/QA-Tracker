import type { ExternalParticipantRecord } from '../../modules/participant-directory/types/model';

export type ExternalContact = Omit<ExternalParticipantRecord, 'sourceProject'> & {
  sourceProject?: ExternalParticipantRecord['sourceProject'] | null;
};

/** sourceProject is provenance, not a many-to-many project assignment. */
export function selectProjectExternalContacts(
  contacts: ExternalContact[], organizationDocumentId: string, projectDocumentId: string,
): ExternalContact[] {
  if (!organizationDocumentId || !projectDocumentId) return [];
  return contacts.filter(contact => contact.organization?.documentId === organizationDocumentId &&
    (!contact.sourceProject || contact.sourceProject.documentId === projectDocumentId));
}

export type ExternalContactTransport = {
  getProject: (documentId: string) => Promise<{ organization?: { documentId?: string } }>;
  listContacts: (params: Record<string, string | boolean>) => Promise<ExternalContact[]>;
};

export async function loadProjectExternalContacts(
  organizationDocumentId: string, projectDocumentId: string, transport: ExternalContactTransport,
): Promise<ExternalContactSnapshot> {
  if (!organizationDocumentId || !projectDocumentId) throw new Error('Falta contexto del proyecto.');
  const project = await transport.getProject(projectDocumentId);
  if (project.organization?.documentId !== organizationDocumentId) {
    throw new Error('La organización del proyecto no coincide con el espacio activo.');
  }
  const contacts = await transport.listContacts({
    'filters[organization][documentId][$eq]': organizationDocumentId,
    'filters[$or][0][sourceProject][documentId][$eq]': projectDocumentId,
    'filters[$or][1][sourceProject][documentId][$null]': true,
  });
  return { organizationDocumentId,
    contacts: selectProjectExternalContacts(contacts, organizationDocumentId, projectDocumentId) };
}

export type ExternalContactScope = {
  organizationDocumentId: string;
  projectDocumentId: string;
  roleCode: string;
  membershipStatus: string;
};
export type ExternalContactFields = { name: string; email?: string; role?: string };
export type ExternalContactInput = ExternalContactFields & { documentId?: string };
export type ExternalContactSnapshot = { organizationDocumentId: string; contacts: ExternalContact[] };
export type ExternalContactBoundary = {
  load: () => Promise<ExternalContactSnapshot>;
  create: (input: ExternalContactFields & { organizationDocumentId: string; sourceProjectDocumentId: string }) => Promise<unknown>;
  update: (documentId: string, input: ExternalContactFields) => Promise<unknown>;
};

export function canManageProjectExternalContacts(scope: ExternalContactScope) {
  return Boolean(scope.organizationDocumentId && scope.projectDocumentId &&
    scope.membershipStatus === 'active' &&
    ['owner', 'qa-lead', 'qa-engineer', 'manager'].includes(scope.roleCode));
}

export class ExternalContactDeletionUnverifiedError extends Error {
  constructor() {
    super('No pudimos verificar el resultado de la eliminación. Actualiza la lista antes de reintentar.');
    this.name = 'ExternalContactDeletionUnverifiedError';
  }
}

/** Delete only project-owned contacts; verify absence before reporting success. */
export async function deleteProjectExternalContact(
  scope: ExternalContactScope, documentId: string,
  boundary: { load: () => Promise<ExternalContactSnapshot>; remove: (documentId: string) => Promise<unknown> },
) {
  if (!canManageProjectExternalContacts(scope)) throw new Error('Sin permiso o contexto del proyecto.');
  const snapshot = await boundary.load();
  if (snapshot.organizationDocumentId !== scope.organizationDocumentId) {
    throw new Error('La organización del proyecto no coincide con el espacio activo.');
  }
  if (!snapshot.contacts.some(contact => contact.documentId === documentId &&
    contact.organization?.documentId === scope.organizationDocumentId &&
    contact.sourceProject?.documentId === scope.projectDocumentId)) {
    throw new Error('Solo se pueden eliminar contactos propios de este proyecto.');
  }
  let removalFailed = false;
  let removalError: unknown;
  try {
    await boundary.remove(documentId);
  } catch (error) {
    // A lost response does not prove the server rejected the DELETE.
    removalFailed = true;
    removalError = error;
  }
  let verified: ExternalContactSnapshot;
  try {
    verified = await boundary.load();
    if (verified.organizationDocumentId !== scope.organizationDocumentId) throw new Error('Unverified deletion');
  } catch {
    throw new ExternalContactDeletionUnverifiedError();
  }
  if (verified.contacts.some(contact => contact.documentId === documentId)) {
    if (removalFailed) throw removalError;
    throw new ExternalContactDeletionUnverifiedError();
  }
  return verified;
}

const identity = (value?: string) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** Only contact writes: never users, invitations, membership roles or provenance updates. */
export async function saveProjectExternalContact(
  scope: ExternalContactScope, input: ExternalContactInput, boundary: ExternalContactBoundary,
) {
  if (!canManageProjectExternalContacts(scope)) throw new Error('Sin permiso o contexto del proyecto.');
  const fields = { name: input.name.trim(), email: input.email?.trim() || '', role: input.role?.trim() || '' };
  if (!fields.name) throw new Error('El nombre es obligatorio.');
  // Reread before duplicate checks and edits; never trust stale cached provenance.
  const snapshot = await boundary.load();
  if (snapshot.organizationDocumentId !== scope.organizationDocumentId) {
    throw new Error('La organización del proyecto no coincide con el espacio activo.');
  }
  const contacts = selectProjectExternalContacts(snapshot.contacts, scope.organizationDocumentId, scope.projectDocumentId);
  if (input.documentId && !contacts.some(contact => contact.documentId === input.documentId &&
    contact.sourceProject?.documentId === scope.projectDocumentId)) {
    throw new Error('Solo se pueden editar contactos propios de este proyecto.');
  }
  const duplicate = contacts.find(contact => contact.documentId !== input.documentId &&
    (contact.email && fields.email ? identity(contact.email) === identity(fields.email)
      : identity(contact.name) === identity(fields.name)));
  if (duplicate) throw new Error('Este contacto ya existe en el proyecto o directorio de la organización.');
  if (input.documentId) return boundary.update(input.documentId, fields);
  return boundary.create({ ...fields, organizationDocumentId: scope.organizationDocumentId,
    sourceProjectDocumentId: scope.projectDocumentId });
}
