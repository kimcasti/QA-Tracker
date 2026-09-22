export type ProjectCommentDto = {
  documentId: string;
  content: string;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
  project?: { documentId?: string };
  author?: { id: number; username?: string; email?: string };
};
