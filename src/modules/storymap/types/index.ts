export interface Role {
  id: string;
  projectId: string;
  name: string;
}

export interface Epic {
  id: string;
  projectId: string;
  roleId: string;
  name: string;
}

export interface Story {
  id: string;
  projectId: string;
  epicId: string;
  name: string;
}

export interface StoryFunctionalityLink {
  id: string;
  storyId: string;
  functionalityId: string;
}

export interface StoryMapSnapshot {
  roles: Role[];
  epics: Epic[];
  stories: Story[];
  links: StoryFunctionalityLink[];
  taskOrder: Record<string, string[]>;
}

export interface StoryMapStoryNode extends Story {
  functionalities: { id: string; name: string; module: string }[];
}

export interface StoryMapEpicNode extends Epic {
  stories: StoryMapStoryNode[];
}

export interface StoryMapRoleNode extends Role {
  epics: StoryMapEpicNode[];
}
