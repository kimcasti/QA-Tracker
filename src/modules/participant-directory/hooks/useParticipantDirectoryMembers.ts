import { useQuery } from '@tanstack/react-query';
import { getParticipantDirectoryMembers } from '../services/participantDirectoryService';

export function useParticipantDirectoryMembers(enabled = true) {
  return useQuery({
    queryKey: ['participant-directory-members'],
    queryFn: getParticipantDirectoryMembers,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}
