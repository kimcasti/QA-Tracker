import { useQuery } from '@tanstack/react-query';
import { getSlackMembers } from '../services/slackMembersService';

export function useSlackMembers(enabled = true) {
  return useQuery({
    queryKey: ['slack-members'],
    queryFn: getSlackMembers,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}
