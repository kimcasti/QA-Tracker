export interface ParticipantDirectoryMember {
  id: string;
  username: string;
  realName: string;
  displayName: string;
  fullName: string;
  email?: string;
  title?: string;
  avatarUrl?: string;
  isExternal?: boolean;
}

export interface ExternalParticipantRecord {
  documentId: string;
  name: string;
  role?: string;
  email?: string;
  organization?: {
    documentId?: string;
    name?: string;
  };
  sourceProject?: {
    documentId?: string;
    name?: string;
    key?: string;
  };
}
