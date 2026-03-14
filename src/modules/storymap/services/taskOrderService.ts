const LS_KEY = 'qa_story_task_order';

type OrderStore = Record<string, Record<string, string[]>>; // projectId -> storyId -> functionalityIds

function readStore(): OrderStore {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: OrderStore) {
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

export const taskOrderService = {
  getProjectOrder(projectId: string): Record<string, string[]> {
    const store = readStore();
    return store[projectId] || {};
  },

  saveProjectOrder(projectId: string, orderByStory: Record<string, string[]>) {
    const store = readStore();
    store[projectId] = orderByStory;
    writeStore(store);
  },
};

