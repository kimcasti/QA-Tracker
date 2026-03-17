import type { Functionality } from '../../../types';
import type { Epic, Role, Story, StoryMapRoleNode } from '../types';

const LS_KEYS = {
  ROLES: 'qa_roles',
  EPICS: 'qa_epics',
  STORIES: 'qa_stories',
} as const;

function readArray<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function updateItem<T extends { id: string; projectId: string; name: string }>(
  key: string,
  projectId: string,
  itemId: string,
  name: string,
) {
  const items = readArray<T>(key);
  let updated: T | null = null;

  const nextItems = items.map(item => {
    if (item.projectId !== projectId || item.id !== itemId) {
      return item;
    }

    updated = { ...item, name: name.trim() };
    return updated;
  });

  writeArray(key, nextItems);
  return updated;
}

export const storyMapService = {
  getRoles(projectId?: string): Role[] {
    const all = readArray<Role>(LS_KEYS.ROLES);
    return projectId ? all.filter(r => r.projectId === projectId) : all;
  },

  createRole(projectId: string, name: string): Role {
    const role: Role = { id: newId('ROLE'), projectId, name: name.trim() };
    const roles = readArray<Role>(LS_KEYS.ROLES);
    roles.push(role);
    writeArray(LS_KEYS.ROLES, roles);
    return role;
  },

  updateRole(projectId: string, roleId: string, name: string) {
    return updateItem<Role>(LS_KEYS.ROLES, projectId, roleId, name);
  },

  getEpics(projectId?: string): Epic[] {
    const all = readArray<Epic>(LS_KEYS.EPICS);
    return projectId ? all.filter(e => e.projectId === projectId) : all;
  },

  createEpic(projectId: string, roleId: string, name: string): Epic {
    const epic: Epic = { id: newId('EPIC'), projectId, roleId, name: name.trim() };
    const epics = readArray<Epic>(LS_KEYS.EPICS);
    epics.push(epic);
    writeArray(LS_KEYS.EPICS, epics);
    return epic;
  },

  updateEpic(projectId: string, epicId: string, name: string) {
    return updateItem<Epic>(LS_KEYS.EPICS, projectId, epicId, name);
  },

  getStories(projectId?: string): Story[] {
    const all = readArray<Story>(LS_KEYS.STORIES);
    return projectId ? all.filter(s => s.projectId === projectId) : all;
  },

  createStory(projectId: string, epicId: string, name: string): Story {
    const story: Story = { id: newId('STORY'), projectId, epicId, name: name.trim() };
    const stories = readArray<Story>(LS_KEYS.STORIES);
    stories.push(story);
    writeArray(LS_KEYS.STORIES, stories);
    return story;
  },

  updateStory(projectId: string, storyId: string, name: string) {
    return updateItem<Story>(LS_KEYS.STORIES, projectId, storyId, name);
  },

  getFullStoryMap(projectId: string, functionalities: Functionality[]): StoryMapRoleNode[] {
    const roles = storyMapService.getRoles(projectId);
    const epics = storyMapService.getEpics(projectId);
    const stories = storyMapService.getStories(projectId);

    return roles.map(role => {
      const roleEpics = epics
        .filter(e => e.roleId === role.id)
        .map(epic => {
          const epicStories = stories
            .filter(s => s.epicId === epic.id)
            .map(story => {
              const storyFuncs = functionalities
                .filter(f => f.storyId === story.id)
                .map(f => ({ id: f.id, name: f.name, module: f.module }));

              return { ...story, functionalities: storyFuncs };
            });

          return { ...epic, stories: epicStories };
        });

      return { ...role, epics: roleEpics };
    });
  },
};
