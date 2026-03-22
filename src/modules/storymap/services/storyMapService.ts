import type { Functionality } from '../../../types';
import type { Epic, Role, Story, StoryMapRoleNode, StoryMapSnapshot } from '../types';
import { storyAssociationsService } from './storyAssociationsService';
import { taskOrderService } from './taskOrderService';

const storyMapStore = {
  roles: [] as Role[],
  epics: [] as Epic[],
  stories: [] as Story[],
};

function readRoles() {
  return storyMapStore.roles;
}

function writeRoles(items: Role[]) {
  storyMapStore.roles = items;
}

function readEpics() {
  return storyMapStore.epics;
}

function writeEpics(items: Epic[]) {
  storyMapStore.epics = items;
}

function readStories() {
  return storyMapStore.stories;
}

function writeStories(items: Story[]) {
  storyMapStore.stories = items;
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function updateItem<T extends { id: string; projectId: string; name: string }>(
  readItems: () => T[],
  writeItems: (items: T[]) => void,
  projectId: string,
  itemId: string,
  name: string,
) {
  const items = readItems();
  let updated: T | null = null;

  const nextItems = items.map(item => {
    if (item.projectId !== projectId || item.id !== itemId) {
      return item;
    }

    updated = { ...item, name: name.trim() };
    return updated;
  });

  writeItems(nextItems);
  return updated;
}

export const storyMapService = {
  getRoles(projectId?: string): Role[] {
    const all = readRoles();
    return projectId ? all.filter(r => r.projectId === projectId) : all;
  },

  createRole(projectId: string, name: string): Role {
    const role: Role = { id: newId('ROLE'), projectId, name: name.trim() };
    const roles = readRoles();
    roles.push(role);
    writeRoles(roles);
    return role;
  },

  updateRole(projectId: string, roleId: string, name: string) {
    return updateItem<Role>(readRoles, writeRoles, projectId, roleId, name);
  },

  getEpics(projectId?: string): Epic[] {
    const all = readEpics();
    return projectId ? all.filter(e => e.projectId === projectId) : all;
  },

  createEpic(projectId: string, roleId: string, name: string): Epic {
    const epic: Epic = { id: newId('EPIC'), projectId, roleId, name: name.trim() };
    const epics = readEpics();
    epics.push(epic);
    writeEpics(epics);
    return epic;
  },

  updateEpic(projectId: string, epicId: string, name: string) {
    return updateItem<Epic>(readEpics, writeEpics, projectId, epicId, name);
  },

  getStories(projectId?: string): Story[] {
    const all = readStories();
    return projectId ? all.filter(s => s.projectId === projectId) : all;
  },

  createStory(projectId: string, epicId: string, name: string): Story {
    const story: Story = { id: newId('STORY'), projectId, epicId, name: name.trim() };
    const stories = readStories();
    stories.push(story);
    writeStories(stories);
    return story;
  },

  updateStory(projectId: string, storyId: string, name: string) {
    return updateItem<Story>(readStories, writeStories, projectId, storyId, name);
  },

  getProjectSnapshot(projectId: string): StoryMapSnapshot {
    return {
      roles: storyMapService.getRoles(projectId),
      epics: storyMapService.getEpics(projectId),
      stories: storyMapService.getStories(projectId),
      links: storyAssociationsService.getProjectLinks(projectId),
      taskOrder: taskOrderService.getProjectOrder(projectId),
    };
  },

  hydrateProjectSnapshot(projectId: string, snapshot?: StoryMapSnapshot | null) {
    const roles = readRoles().filter(item => item.projectId !== projectId);
    const epics = readEpics().filter(item => item.projectId !== projectId);
    const stories = readStories().filter(item => item.projectId !== projectId);

    writeRoles([...roles, ...((snapshot?.roles || []) as Role[])]);
    writeEpics([...epics, ...((snapshot?.epics || []) as Epic[])]);
    writeStories([...stories, ...((snapshot?.stories || []) as Story[])]);
    storyAssociationsService.hydrateProjectLinks(projectId, snapshot?.links || []);
    taskOrderService.hydrateProjectOrder(projectId, snapshot?.taskOrder || {});
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
