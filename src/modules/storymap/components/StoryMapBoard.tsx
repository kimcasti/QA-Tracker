import { Button, Card, Tag, Tooltip, Typography } from 'antd';
import {
  CaretDownOutlined,
  CaretRightOutlined,
  EditOutlined,
  PlusOutlined,
  RocketOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Functionality } from '../../../types';
import { qaPalette, softSurface } from '../../../theme/palette';
import type { StoryMapRoleNode } from '../types';
import { taskOrderService } from '../services/taskOrderService';
import {
  storyAssociationsService,
} from '../services/storyAssociationsService';
import type { StoryFunctionalityLink } from '../types';
import { StoryColumn } from './StoryColumn';
import { TaskCard } from './TaskCard';

const { Text } = Typography;

const EPIC_ACCENT_CLASSES = [
  'qa-story-accent',
  'qa-story-accent',
  'qa-story-accent',
  'qa-story-accent',
  'qa-story-accent',
  'qa-story-accent',
];

function hashStringToUint(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function epicAccentClass(epicId: string) {
  return EPIC_ACCENT_CLASSES[hashStringToUint(epicId) % EPIC_ACCENT_CLASSES.length];
}

function collapsedRolesStorageKey(projectId: string) {
  return `qa-tracker:storymap:collapsed-roles:${projectId}`;
}

function buildNormalizedTaskOrder(
  storyIds: string[],
  links: StoryFunctionalityLink[],
  sourceOrder: Record<string, string[]>,
) {
  const validLinkIdsByStory = new Map<string, string[]>();

  links.forEach(link => {
    const storyLinkIds = validLinkIdsByStory.get(link.storyId) || [];
    if (!storyLinkIds.includes(link.id)) {
      storyLinkIds.push(link.id);
    }
    validLinkIdsByStory.set(link.storyId, storyLinkIds);
  });

  const seenItemIds = new Set<string>();
  const nextOrder: Record<string, string[]> = {};

  storyIds.forEach(storyId => {
    const validIds = validLinkIdsByStory.get(storyId) || [];
    const validIdSet = new Set(validIds);
    const orderedIds: string[] = [];

    (sourceOrder[storyId] || []).forEach(itemId => {
      if (seenItemIds.has(itemId) || !validIdSet.has(itemId)) {
        return;
      }

      orderedIds.push(itemId);
      seenItemIds.add(itemId);
    });

    validIds.forEach(itemId => {
      if (seenItemIds.has(itemId)) {
        return;
      }

      orderedIds.push(itemId);
      seenItemIds.add(itemId);
    });

    nextOrder[storyId] = orderedIds;
  });

  return nextOrder;
}

export default function StoryMapBoard({
  projectId,
  roles,
  functionalities,
  readOnly = false,
  onCreateEpic,
  onCreateStory,
  onCreateFunctionality,
  onEditRole,
  onEditEpic,
  onEditStory,
  onEnsurePrimaryAssociation,
  onSyncPrimaryStoryAfterUnassign,
  onStructureChange,
}: {
  projectId: string;
  roles: StoryMapRoleNode[];
  functionalities: Functionality[];
  readOnly?: boolean;
  onCreateEpic: (roleId: string) => void;
  onCreateStory: (epicId: string) => void;
  onCreateFunctionality: (storyId: string) => void;
  onEditRole: (roleId: string, roleName: string) => void;
  onEditEpic: (epicId: string, epicName: string) => void;
  onEditStory: (storyId: string, storyName: string) => void;
  onEnsurePrimaryAssociation: (storyId: string, functionalityId: string) => void;
  onSyncPrimaryStoryAfterUnassign: (storyId: string, functionalityId: string) => void;
  onStructureChange?: () => void;
}) {
  const { t } = useTranslation();

  const storyIdsInRenderOrder = useMemo(() => {
    const ids: string[] = [];
    for (const role of roles) {
      for (const epic of role.epics) {
        for (const story of epic.stories) {
          ids.push(story.id);
        }
      }
    }
    return ids;
  }, [roles]);

  const [tasksByStory, setTasksByStory] = useState<Record<string, string[]>>(() =>
    taskOrderService.getProjectOrder(projectId)
  );
  const [links, setLinks] = useState<StoryFunctionalityLink[]>(() =>
    storyAssociationsService.getProjectLinks(projectId)
  );
  const [collapsedRoles, setCollapsedRoles] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') {
      return {};
    }

    try {
      const rawValue = window.localStorage.getItem(collapsedRolesStorageKey(projectId));
      return rawValue ? (JSON.parse(rawValue) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    setTasksByStory(taskOrderService.getProjectOrder(projectId));
    setLinks(storyAssociationsService.getProjectLinks(projectId));
    if (typeof window === 'undefined') {
      setCollapsedRoles({});
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(collapsedRolesStorageKey(projectId));
      setCollapsedRoles(rawValue ? (JSON.parse(rawValue) as Record<string, boolean>) : {});
    } catch {
      setCollapsedRoles({});
    }
  }, [projectId]);

  useEffect(() => {
    setCollapsedRoles(prev => {
      const next: Record<string, boolean> = {};
      roles.forEach(role => {
        if (prev[role.id]) {
          next[role.id] = true;
        }
      });
      return next;
    });
  }, [roles]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        collapsedRolesStorageKey(projectId),
        JSON.stringify(collapsedRoles),
      );
    } catch {
      // Ignore storage issues and keep the UI responsive.
    }
  }, [collapsedRoles, projectId]);

  const funcById = useMemo(() => {
    const m = new Map<string, Functionality>();
    for (const f of functionalities) m.set(f.id, f);
    return m;
  }, [functionalities]);

  const linkById = useMemo(() => {
    const map = new Map<string, StoryFunctionalityLink>();
    links.forEach(link => map.set(link.id, link));
    return map;
  }, [links]);

  useEffect(() => {
    const syncedLinks = storyAssociationsService.syncProjectLinks(
      projectId,
      functionalities,
      storyIdsInRenderOrder,
    );
    setLinks(syncedLinks);

    setTasksByStory(prev => {
      const next = buildNormalizedTaskOrder(storyIdsInRenderOrder, syncedLinks, prev);

      taskOrderService.saveProjectOrder(projectId, next);
      onStructureChange?.();
      return next;
    });
  }, [functionalities, onStructureChange, projectId, storyIdsInRenderOrder]);

  const slotsByStory = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    const seenItemIds = new Set<string>();

    for (const storyId of storyIdsInRenderOrder) {
      const itemIds = (tasksByStory[storyId] || []).filter(itemId => {
        if (!linkById.has(itemId) || seenItemIds.has(itemId)) {
          return false;
        }

        seenItemIds.add(itemId);
        return true;
      });

      grouped[storyId] = itemIds;
    }

    return grouped;
  }, [linkById, storyIdsInRenderOrder, tasksByStory]);

  const handleAssignExisting = (storyId: string, functionalityId: string) => {
    const link = storyAssociationsService.ensureAssociation(projectId, storyId, functionalityId);
    const nextLinks = storyAssociationsService.getProjectLinks(projectId);
    setLinks(nextLinks);
    onEnsurePrimaryAssociation(storyId, functionalityId);

    setTasksByStory(prev => {
      const next = buildNormalizedTaskOrder(storyIdsInRenderOrder, nextLinks, {
        ...prev,
        [storyId]: [...(prev[storyId] || []), link.id],
      });
      taskOrderService.saveProjectOrder(projectId, next);
      onStructureChange?.();
      return next;
    });
  };

  const handleUnassign = (linkId: string) => {
    const link = linkById.get(linkId);
    if (!link) return;

    const nextLinks = storyAssociationsService.removeAssociation(projectId, linkId);
    setLinks(nextLinks);
    onSyncPrimaryStoryAfterUnassign(link.storyId, link.functionalityId);

    setTasksByStory(prev => {
      const next: Record<string, string[]> = {};
      storyIdsInRenderOrder.forEach(sid => {
        next[sid] = (prev[sid] || []).filter(id => id !== linkId);
      });
      taskOrderService.saveProjectOrder(projectId, next);
      onStructureChange?.();
      return next;
    });
  };

  const toggleRoleCollapsed = (roleId: string) => {
    setCollapsedRoles(prev => ({
      ...prev,
      [roleId]: !prev[roleId],
    }));
  };

  return (
    <div className="space-y-6">
      {roles.map(role => (
        <Card
          key={role.id}
          variant="borderless"
          className="rounded-2xl qa-surface-card border-l-4"
          style={{ borderLeftColor: qaPalette.primary }}
          styles={{
            header: { padding: '10px 14px' },
            body: { padding: 14 },
          }}
          title={
            <div className="flex items-center gap-2 min-w-0">
              <Button
                type="text"
                size="small"
                className="shrink-0 text-slate-500"
                icon={
                  collapsedRoles[role.id] ? <CaretRightOutlined /> : <CaretDownOutlined />
                }
                onClick={() => toggleRoleCollapsed(role.id)}
              />
              <Tag color="blue" className="m-0 text-[10px] font-black uppercase">
                {t('storymap.role')}
              </Tag>
              <UserOutlined style={{ color: qaPalette.primary }} />
              <span className="font-black text-slate-800 truncate" title={role.name}>
                {role.name}
              </span>
              <Text type="secondary" className="text-xs whitespace-nowrap">
                {role.epics.length}
              </Text>
              {!readOnly && (
                <Tooltip title={t('common.edit')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    className="shrink-0 text-slate-500"
                    onClick={() => onEditRole(role.id, role.name)}
                  />
                </Tooltip>
              )}
            </div>
          }
          extra={
            !readOnly ? (
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => onCreateEpic(role.id)}
                className="rounded-lg"
              >
                {t('storymap.new_epic')}
              </Button>
            ) : null
          }
        >
          {collapsedRoles[role.id] ? null : (
            <div className="space-y-6">
              {role.epics.map((epic) => (
                <Card
                  key={epic.id}
                  size="small"
                  variant="borderless"
                  className={`rounded-2xl qa-story-surface shadow-none border-l-4 ${epicAccentClass(epic.id)}`}
                  style={{ background: `linear-gradient(180deg, ${qaPalette.storyMapCard} 0%, ${softSurface(qaPalette.storyMapBorder)} 100%)` }}
                  styles={{
                    header: { padding: '8px 12px' },
                    body: { padding: 12 },
                  }}
                  title={
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag color="orange" className="m-0 text-[10px] font-black uppercase">
                        {t('storymap.epic')}
                      </Tag>
                      <RocketOutlined style={{ color: qaPalette.storyMapBorder }} />
                      <span className="font-bold text-slate-800 truncate" title={epic.name}>
                        {epic.name}
                      </span>
                      {!readOnly && (
                        <Tooltip title={t('common.edit')}>
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            className="shrink-0 text-slate-500"
                            onClick={() => onEditEpic(epic.id, epic.name)}
                          />
                        </Tooltip>
                      )}
                    </div>
                  }
                  extra={
                    !readOnly ? (
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => onCreateStory(epic.id)}
                        className="rounded-lg"
                      >
                        {t('storymap.new_story')}
                      </Button>
                    ) : null
                  }
                >
                  <div className="flex gap-6 overflow-x-auto pb-1">
                    {epic.stories.length === 0 ? (
                      <Text type="secondary" className="text-xs">{t('storymap.no_stories')}</Text>
                    ) : (
                      epic.stories.map(story => (
                        <div key={story.id} className="w-[360px] min-w-[360px]">
                          <StoryColumn
                            storyId={story.id}
                            storyName={story.name}
                            itemIds={slotsByStory[story.id] || []}
                            availableFunctionalities={functionalities.filter(
                              functionality =>
                                !links.some(
                                  link =>
                                    link.storyId === story.id &&
                                    link.functionalityId === functionality.id,
                                ),
                            )}
                            onCreateFunctionality={onCreateFunctionality}
                            onEditStory={onEditStory}
                            onAssignExisting={handleAssignExisting}
                            readOnly={readOnly}
                            renderItem={(itemId) => {
                              const link = linkById.get(itemId);
                              const f = link ? funcById.get(link.functionalityId) : undefined;
                              return (
                                <TaskCard
                                  projectId={projectId}
                                  functionality={f}
                                  readOnly={readOnly}
                                  onUnassign={!readOnly ? () => handleUnassign(itemId) : undefined}
                                />
                              );
                            }}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
