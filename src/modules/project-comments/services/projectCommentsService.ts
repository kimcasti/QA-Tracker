import { deleteDocument, listDocuments, relation, updateDocument, createDocument } from '../../shared/services/strapi';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { ProjectCommentDto } from '../types/api';
import type { ProjectComment } from '../types/model';

const ENDPOINT = '/api/project-comments';

function mapProjectComment(comment: ProjectCommentDto): ProjectComment {
  return {
    documentId: comment.documentId,
    content: comment.content || '',
    isPinned: Boolean(comment.isPinned),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    projectDocumentId: comment.project?.documentId || '',
    author: comment.author
      ? {
          id: comment.author.id,
          username: comment.author.username || comment.author.email || 'Usuario',
          email: comment.author.email,
        }
      : null,
  };
}

export async function getProjectComments(projectId?: string) {
  if (!projectId) return [];
  const context = await findProjectContext(projectId);
  if (!context) return [];
  const comments = await listDocuments<ProjectCommentDto>(ENDPOINT, {
    project: context.documentId,
  });
  return comments.map(mapProjectComment);
}

export async function createProjectComment(projectId: string, content: string) {
  const context = await findProjectContext(projectId);
  if (!context) throw new Error('El proyecto no está disponible en el espacio de trabajo.');
  const comment = await createDocument<ProjectCommentDto>(ENDPOINT, {
    content,
    project: relation(context.documentId),
  });
  return mapProjectComment(comment);
}

export async function updateProjectComment(
  documentId: string,
  update: Pick<Partial<ProjectComment>, 'content' | 'isPinned'>,
) {
  const comment = await updateDocument<ProjectCommentDto>(ENDPOINT, documentId, update);
  return mapProjectComment(comment);
}

export async function removeProjectComment(documentId: string) {
  await deleteDocument(ENDPOINT, documentId);
}
