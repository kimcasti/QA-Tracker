export type ProjectCommentAuthor = {
  id: number;
  username: string;
  email?: string;
};

export type ProjectComment = {
  documentId: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  projectDocumentId: string;
  author: ProjectCommentAuthor | null;
};
