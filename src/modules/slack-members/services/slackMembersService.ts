import { Http } from '../../../config/http';
import type { SlackMembersResponse } from '../types/api';
import type { SlackMember } from '../types/model';

export async function getSlackMembers(): Promise<SlackMember[]> {
  const response = await Http.get<SlackMembersResponse>('/api/slack/members');
  return response.data?.data || [];
}
