type OrderStore = Record<string, Record<string, string[]>>; // projectId -> storyId -> functionalityIds

const orderStore: OrderStore = {};

export const taskOrderService = {
  getProjectOrder(projectId: string): Record<string, string[]> {
    return orderStore[projectId] || {};
  },

  saveProjectOrder(projectId: string, orderByStory: Record<string, string[]>) {
    orderStore[projectId] = orderByStory;
  },

  hydrateProjectOrder(projectId: string, orderByStory: Record<string, string[]>) {
    taskOrderService.saveProjectOrder(projectId, orderByStory);
    return orderByStory;
  },
};
