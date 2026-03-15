import type { Functionality } from '../../../types';
import type { Epic, Role, Story } from '../types';
import { storyAssociationsService } from './storyAssociationsService';
import { storyMapService } from './storyMapService';

export type StoryMapExportStory = Story & { tasks: Functionality[] };
export type StoryMapExportEpic = Epic & { stories: StoryMapExportStory[] };
export type StoryMapExportRole = Role & { epics: StoryMapExportEpic[] };

export type StoryMapExportPayload = {
  exportedAt: string;
  projectId: string;
  roles: StoryMapExportRole[];
  unassignedTasks: Functionality[];
};

function toCsvValue(v: unknown) {
  const s = String(v ?? '');
  // RFC4180-ish: quote when needed and escape quotes.
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export const storyMapExportService = {
  build(projectId: string, functionalities: Functionality[]): StoryMapExportPayload {
    const roles = storyMapService.getRoles(projectId);
    const epics = storyMapService.getEpics(projectId);
    const stories = storyMapService.getStories(projectId);
    const links = storyAssociationsService.syncProjectLinks(
      projectId,
      functionalities,
      stories.map(story => story.id),
    );

    const rolesOut: StoryMapExportRole[] = roles.map(role => {
      const roleEpics: StoryMapExportEpic[] = epics
        .filter(e => e.roleId === role.id)
        .map(epic => {
          const epicStories: StoryMapExportStory[] = stories
            .filter(s => s.epicId === epic.id)
            .map(story => {
              const tasks = links
                .filter(link => link.storyId === story.id)
                .map(link => functionalities.find(f => f.id === link.functionalityId))
                .filter((task): task is Functionality => Boolean(task));
              return { ...story, tasks };
            });

          return { ...epic, stories: epicStories };
        });

      return { ...role, epics: roleEpics };
    });

    return {
      exportedAt: new Date().toISOString(),
      projectId,
      roles: rolesOut,
      unassignedTasks: functionalities.filter(
        functionality => !links.some(link => link.functionalityId === functionality.id),
      ),
    };
  },

  toJson(payload: StoryMapExportPayload) {
    return JSON.stringify(payload, null, 2);
  },

  toCsv(payload: StoryMapExportPayload) {
    // Excel (Windows) often requires UTF-8 BOM to display accents correctly.
    const UTF8_BOM = '\uFEFF';

    const header = [
      'roleId',
      'roleName',
      'epicId',
      'epicName',
      'storyId',
      'storyName',
      'taskId',
      'taskName',
      'module',
      'status',
      'priority',
      'riskLevel',
      'sprint',
      'deliveryDate',
    ];

    const rows: string[][] = [];

    for (const role of payload.roles) {
      for (const epic of role.epics) {
        for (const story of epic.stories) {
          for (const task of story.tasks) {
            rows.push([
              role.id,
              role.name,
              epic.id,
              epic.name,
              story.id,
              story.name,
              task.id,
              task.name,
              task.module,
              task.status,
              task.priority,
              task.riskLevel,
              task.sprint || '',
              task.deliveryDate || '',
            ]);
          }
        }
      }
    }

    // Include unassigned tasks (no story).
    for (const task of payload.unassignedTasks) {
      rows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        task.id,
        task.name,
        task.module,
        task.status,
        task.priority,
        task.riskLevel,
        task.sprint || '',
        task.deliveryDate || '',
      ]);
    }

    const lines = [header, ...rows].map(cols => cols.map(toCsvValue).join(','));
    return UTF8_BOM + lines.join('\r\n');
  },
};
