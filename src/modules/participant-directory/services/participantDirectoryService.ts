import { Http } from '../../../config/http';
import { createDocument, relation } from '../../shared/services/strapi';
import type { ParticipantDirectoryMembersResponse } from '../types/api';
import type { ParticipantDirectoryMember } from '../types/model';

export async function getParticipantDirectoryMembers(): Promise<ParticipantDirectoryMember[]> {
  const response = await Http.get<ParticipantDirectoryMembersResponse>(
    '/api/participant-directory/members',
  );
  return response.data?.data || [];
}

export async function createExternalParticipant(input: {
  name: string;
  role?: string;
  email?: string;
  organizationDocumentId?: string;
  sourceProjectDocumentId?: string;
}) {
  return createDocument('/api/external-participants', {
    name: input.name.trim(),
    role: input.role?.trim() || '',
    email: input.email?.trim() || null,
    organization: relation(input.organizationDocumentId),
    sourceProject: relation(input.sourceProjectDocumentId),
  });
}
