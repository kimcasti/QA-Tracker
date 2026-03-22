import type { Functionality } from '../../../types';
import type { StoryFunctionalityLink } from '../types';

type AssociationStore = Record<string, StoryFunctionalityLink[]>;

const associationStore: AssociationStore = {};

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

function dedupeLinks(links: StoryFunctionalityLink[]) {
  const seenIds = new Set<string>();
  const seenPairs = new Set<string>();

  return links.filter(link => {
    const pairKey = `${link.storyId}::${link.functionalityId}`;
    if (seenIds.has(link.id) || seenPairs.has(pairKey)) {
      return false;
    }

    seenIds.add(link.id);
    seenPairs.add(pairKey);
    return true;
  });
}

export const storyAssociationsService = {
  getProjectLinks(projectId: string): StoryFunctionalityLink[] {
    return associationStore[projectId] || [];
  },

  saveProjectLinks(projectId: string, links: StoryFunctionalityLink[]) {
    associationStore[projectId] = dedupeLinks(links);
  },

  hydrateProjectLinks(projectId: string, links: StoryFunctionalityLink[]) {
    storyAssociationsService.saveProjectLinks(projectId, links);
    return links;
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

    const movedLinks = links.map(item => (item.id === linkId ? { ...item, storyId } : item));
    const nextLinks = movedLinks.filter((item, index) => {
      if (item.storyId !== storyId || item.functionalityId !== link.functionalityId) {
        return true;
      }

      return (
        index ===
        movedLinks.findIndex(
          candidate =>
            candidate.storyId === storyId &&
            candidate.functionalityId === link.functionalityId &&
            candidate.id === linkId,
        )
      );
    });

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
    const existingLinks = dedupeLinks(
      storyAssociationsService.getProjectLinks(projectId).filter(
      link =>
        validStoryIdsSet.has(link.storyId) && validFunctionalityIds.has(link.functionalityId),
      ),
    );

    const nextLinks = [...existingLinks];

    functionalities.forEach(functionality => {
      if (!functionality.storyId || !validStoryIdsSet.has(functionality.storyId)) {
        return;
      }

      const hasAnyLink = nextLinks.some(link => link.functionalityId === functionality.id);
      const alreadyLinked = nextLinks.some(
        link =>
          link.storyId === functionality.storyId && link.functionalityId === functionality.id,
      );

      if (!alreadyLinked && !hasAnyLink) {
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
