import { useQuery } from '@tanstack/react-query';
import { getExternalParticipants } from '../services/participantDirectoryService';

export function useExternalParticipants(sourceProjectDocumentId?: string) {
  return useQuery({
    queryKey: ['external-participants', sourceProjectDocumentId || 'all'],
    queryFn: () => getExternalParticipants(sourceProjectDocumentId),
    staleTime: 1000 * 60 * 5,
  });
}
