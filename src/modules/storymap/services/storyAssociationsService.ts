import type { Functionality } from '../../../types';

const LS_KEY = 'qa_story_functionality_links';

export interface StoryFunctionalityLink {
  id: string;
  storyId: string;
  functionalityId: string;
}

type AssociationStore = Record<string, StoryFunctionalityLink[]>;

function readStore(): AssociationStore {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: AssociationStore) {
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

function newLinkId() {
  return `LINK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sameLink(left: StoryFunctionalityLink, right: StoryFunctionalityLink) {
  return (
    left.id === right.id &&
    left.storyId === right.storyId &&
    left.functionalityId === right.functionalityId
  );
}

export const storyAssociationsService = {
  getProjectLinks(projectId: string): StoryFunctionalityLink[] {
    const store = readStore();
    return store[projectId] || [];
  },

  saveProjectLinks(projectId: string, links: StoryFunctionalityLink[]) {
    const store = readStore();
    store[projectId] = links;
    writeStore(store);
  },

  ensureAssociation(projectId: string, storyId: string, functionalityId: string) {
    const links = storyAssociationsService.getProjectLinks(projectId);
    const existing = links.find(
      link => link.storyId === storyId && link.functionalityId === functionalityId,
    );

    if (existing) {
      return existing;
    }

    const created = {
      id: newLinkId(),
      storyId,
      functionalityId,
    };

    storyAssociationsService.saveProjectLinks(projectId, [...links, created]);
    return created;
  },

  removeAssociation(projectId: string, linkId: string) {
    const links = storyAssociationsService
      .getProjectLinks(projectId)
      .filter(link => link.id !== linkId);

    storyAssociationsService.saveProjectLinks(projectId, links);
    return links;
  },

  moveAssociation(projectId: string, linkId: string, storyId: string) {
    const links = storyAssociationsService.getProjectLinks(projectId);
    const link = links.find(item => item.id === linkId);

    if (!link) {
      return links;
    }

    const duplicate = links.find(
      item =>
        item.id !== linkId &&
        item.storyId === storyId &&
        item.functionalityId === link.functionalityId,
    );

    if (duplicate) {
      return storyAssociationsService.removeAssociation(projectId, linkId);
    }

    const nextLinks = links.map(item => (item.id === linkId ? { ...item, storyId } : item));
    storyAssociationsService.saveProjectLinks(projectId, nextLinks);
    return nextLinks;
  },

  syncProjectLinks(
    projectId: string,
    functionalities: Functionality[],
    validStoryIds: string[],
  ): StoryFunctionalityLink[] {
    const validStoryIdsSet = new Set(validStoryIds);
    const validFunctionalityIds = new Set(functionalities.map(item => item.id));
    const existingLinks = storyAssociationsService.getProjectLinks(projectId);

    const normalizedLinks = existingLinks.filter(
      link =>
        validStoryIdsSet.has(link.storyId) && validFunctionalityIds.has(link.functionalityId),
    );

    const nextLinks = [...normalizedLinks];

    functionalities.forEach(functionality => {
      if (!functionality.storyId || !validStoryIdsSet.has(functionality.storyId)) {
        return;
      }

      const alreadyLinked = nextLinks.some(
        link =>
          link.storyId === functionality.storyId && link.functionalityId === functionality.id,
      );

      if (!alreadyLinked) {
        nextLinks.push({
          id: newLinkId(),
          storyId: functionality.storyId,
          functionalityId: functionality.id,
        });
      }
    });

    const changed =
      nextLinks.length !== existingLinks.length ||
      nextLinks.some((link, index) => !sameLink(link, existingLinks[index]));

    if (changed) {
      storyAssociationsService.saveProjectLinks(projectId, nextLinks);
    }

    return nextLinks;
  },
};
