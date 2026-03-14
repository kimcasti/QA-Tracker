export interface SlackMember {
  id: string;
  username: string;
  realName: string;
  displayName: string;
  fullName: string;
  email?: string;
  title?: string;
  avatarUrl?: string;
}
