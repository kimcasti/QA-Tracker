import type { StoryMapSnapshot } from '../types';
import type { ProjectStoryMapDto } from '../types/api';
import { Http } from '../../../config/http';
import { updateDocument } from '../../shared/services/strapi';
import { findProjectContext } from '../../workspace/services/workspaceService';

function normalizeStoryMapData(value?: string | null): StoryMapSnapshot | null {
  if (!value) {
    return null;
  }

  try {
    const rawValue = JSON.parse(value) as Partial<StoryMapSnapshot>;
    return {
      roles: Array.isArray(rawValue.roles) ? rawValue.roles : [],
      epics: Array.isArray(rawValue.epics) ? rawValue.epics : [],
      stories: Array.isArray(rawValue.stories) ? rawValue.stories : [],
      links: Array.isArray(rawValue.links) ? rawValue.links : [],
      taskOrder:
        rawValue.taskOrder && typeof rawValue.taskOrder === 'object' ? rawValue.taskOrder : {},
    };
  } catch {
    return null;
  }
}

async function getProjectDocumentId(projectId: string) {
  const context = await findProjectContext(projectId);
  return context?.documentId || null;
}

export async function getProjectStoryMap(projectId: string) {
  const projectDocumentId = await getProjectDocumentId(projectId);

  if (!projectDocumentId) {
    return null;
  }

  const response = await Http.get<{ data: ProjectStoryMapDto | null }>(
    `/api/projects/${projectDocumentId}/story-map`,
  );

  return normalizeStoryMapData(response.data.data?.snapshot || null);
}

export async function saveProjectStoryMap(projectId: string, snapshot: StoryMapSnapshot) {
  const projectDocumentId = await getProjectDocumentId(projectId);

  if (!projectDocumentId) {
    throw new Error('Project context was not found for Story Map persistence.');
  }

  const payload = {
    snapshot: JSON.stringify(snapshot),
  };

  return updateDocument<ProjectStoryMapDto>(
    '/api/projects',
    `${projectDocumentId}/story-map`,
    payload,
  );
}
