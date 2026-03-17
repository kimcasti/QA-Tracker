import { Button, Card, Tag, Tooltip, Typography } from 'antd';
import { EditOutlined, PlusOutlined, RocketOutlined, UserOutlined } from '@ant-design/icons';
import { createSwapy, type SlotItemMapArray, type Swapy } from 'swapy';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Functionality } from '../../../types';
import { qaPalette, softSurface } from '../../../theme/palette';
import type { StoryMapRoleNode } from '../types';
import { taskOrderService } from '../services/taskOrderService';
import {
  storyAssociationsService,
  type StoryFunctionalityLink,
} from '../services/storyAssociationsService';
import { StoryColumn } from './StoryColumn';
import { TaskCard, TaskPlaceholderCard } from './TaskCard';

const { Text } = Typography;

const EMPTY_PREFIX = '__EMPTY__:'; // __EMPTY__:storyId

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

function emptyId(storyId: string) {
  return `${EMPTY_PREFIX}${storyId}`;
}

function isEmptyItem(itemId: string) {
  return itemId.startsWith(EMPTY_PREFIX);
}

function storyIdFromSlot(slotId: string) {
  return slotId.split('::')[0];
}

export default function StoryMapBoard({
  projectId,
  roles,
  functionalities,
  onCreateEpic,
  onCreateStory,
  onCreateFunctionality,
  onEditRole,
  onEditEpic,
  onEditStory,
  onEnsurePrimaryAssociation,
  onSyncPrimaryStoryAfterUnassign,
  onMoveFunctionality,
}: {
  projectId: string;
  roles: StoryMapRoleNode[];
  functionalities: Functionality[];
  onCreateEpic: (roleId: string) => void;
  onCreateStory: (epicId: string) => void;
  onCreateFunctionality: (storyId: string) => void;
  onEditRole: (roleId: string, roleName: string) => void;
  onEditEpic: (epicId: string, epicName: string) => void;
  onEditStory: (storyId: string, storyName: string) => void;
  onEnsurePrimaryAssociation: (storyId: string, functionalityId: string) => void;
  onSyncPrimaryStoryAfterUnassign: (storyId: string, functionalityId: string) => void;
  onMoveFunctionality: (functionalityId: string, storyId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const swapyRef = useRef<Swapy | null>(null);

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

  const storyIdsRef = useRef(storyIdsInRenderOrder);
  useEffect(() => {
    storyIdsRef.current = storyIdsInRenderOrder;
  }, [storyIdsInRenderOrder]);

  useEffect(() => {
    setTasksByStory(taskOrderService.getProjectOrder(projectId));
    setLinks(storyAssociationsService.getProjectLinks(projectId));
  }, [projectId]);

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

  const funcByIdRef = useRef(funcById);
  const onMoveRef = useRef(onMoveFunctionality);

  useEffect(() => {
    funcByIdRef.current = funcById;
  }, [funcById]);

  useEffect(() => {
    onMoveRef.current = onMoveFunctionality;
  }, [onMoveFunctionality]);

  useEffect(() => {
    const syncedLinks = storyAssociationsService.syncProjectLinks(
      projectId,
      functionalities,
      storyIdsInRenderOrder,
    );
    setLinks(syncedLinks);

    setTasksByStory(prev => {
      const next: Record<string, string[]> = {};
      const linkIdsByStory = new Map<string, string[]>();

      syncedLinks.forEach(link => {
        const storyLinks = linkIdsByStory.get(link.storyId) || [];
        storyLinks.push(link.id);
        linkIdsByStory.set(link.storyId, storyLinks);
      });

      storyIdsInRenderOrder.forEach(storyId => {
        const validIds = linkIdsByStory.get(storyId) || [];
        const orderedIds = (prev[storyId] || []).filter(id => validIds.includes(id));
        const missingIds = validIds.filter(id => !orderedIds.includes(id));
        next[storyId] = [...orderedIds, ...missingIds];
      });

      taskOrderService.saveProjectOrder(projectId, next);
      return next;
    });
  }, [functionalities, projectId, storyIdsInRenderOrder]);

  const canonicalSlotItemMap = useMemo<SlotItemMapArray>(() => {
    const map: SlotItemMapArray = [];
    for (const storyId of storyIdsInRenderOrder) {
      const tasks = (tasksByStory[storyId] || []).filter(id => linkById.has(id));
      const items = [...tasks, emptyId(storyId)];
      items.forEach((itemId, idx) => map.push({ slot: `${storyId}::${idx}`, item: itemId }));
    }
    return map;
  }, [linkById, storyIdsInRenderOrder, tasksByStory]);

  const slotsByStory = useMemo(() => {
    const grouped: Record<string, Array<{ slotId: string; itemId: string }>> = {};
    for (const entry of canonicalSlotItemMap) {
      const sid = storyIdFromSlot(entry.slot);
      if (!grouped[sid]) grouped[sid] = [];
      grouped[sid].push({ slotId: entry.slot, itemId: entry.item });
    }
    return grouped;
  }, [canonicalSlotItemMap]);

  const normalizeAndPersist = async (mapArray: SlotItemMapArray) => {
    const nextOrderDraft: Record<string, string[]> = {};
    storyIdsRef.current.forEach(storyId => (nextOrderDraft[storyId] = []));
    const nextStoryByLinkId = new Map<string, string>();
    const currentLinks = Array.from(linkById.values());
    const movedLinks: Array<{
      functionalityId: string;
      fromStoryId: string;
      toStoryId: string;
    }> = [];

    for (const { slot, item } of mapArray) {
      const sid = storyIdFromSlot(slot);
      if (isEmptyItem(item)) continue;
      if (!nextOrderDraft[sid]) nextOrderDraft[sid] = [];
      nextOrderDraft[sid].push(item);
      nextStoryByLinkId.set(item, sid);
    }

    let nextLinks = currentLinks;
    currentLinks.forEach(link => {
      const nextStoryId = nextStoryByLinkId.get(link.id);
      if (!nextStoryId || nextStoryId === link.storyId) {
        return;
      }

      movedLinks.push({
        functionalityId: link.functionalityId,
        fromStoryId: link.storyId,
        toStoryId: nextStoryId,
      });
      nextLinks = storyAssociationsService.moveAssociation(projectId, link.id, nextStoryId);
    });

    const validLinkIdsByStory = new Map<string, string[]>();
    nextLinks.forEach(link => {
      const storyLinkIds = validLinkIdsByStory.get(link.storyId) || [];
      storyLinkIds.push(link.id);
      validLinkIdsByStory.set(link.storyId, storyLinkIds);
    });

    const nextOrder: Record<string, string[]> = {};
    storyIdsRef.current.forEach(storyId => {
      const validIds = validLinkIdsByStory.get(storyId) || [];
      const orderedIds = (nextOrderDraft[storyId] || []).filter(id => validIds.includes(id));
      const missingIds = validIds.filter(id => !orderedIds.includes(id));
      nextOrder[storyId] = [...orderedIds, ...missingIds];
    });

    setTasksByStory(nextOrder);
    taskOrderService.saveProjectOrder(projectId, nextOrder);
    setLinks(nextLinks);
    storyAssociationsService.saveProjectLinks(projectId, nextLinks);

    const persistPrimaryMoves = movedLinks
      .filter((move, index, moves) => {
        return (
          index ===
          moves.findIndex(
            item =>
              item.functionalityId === move.functionalityId &&
              item.toStoryId === move.toStoryId,
          )
        );
      })
      .filter(move => {
        const current = funcByIdRef.current.get(move.functionalityId);
        if (!current) {
          return false;
        }

        const sameFunctionalityLinks = nextLinks.filter(
          item => item.functionalityId === move.functionalityId,
        );

        return current.storyId === move.fromStoryId || sameFunctionalityLinks.length === 1;
      });

    if (persistPrimaryMoves.length > 0) {
      await Promise.all(
        persistPrimaryMoves.map(move =>
          onMoveRef.current(move.functionalityId, move.toStoryId),
        ),
      );
    }
  };

  const handleAssignExisting = (storyId: string, functionalityId: string) => {
    const link = storyAssociationsService.ensureAssociation(projectId, storyId, functionalityId);
    const nextLinks = storyAssociationsService.getProjectLinks(projectId);
    setLinks(nextLinks);
    onEnsurePrimaryAssociation(storyId, functionalityId);

    setTasksByStory(prev => {
      const next = { ...prev };
      if (!next[storyId]) next[storyId] = [];
      if (!next[storyId].includes(link.id)) {
        next[storyId] = [...next[storyId], link.id];
      }
      taskOrderService.saveProjectOrder(projectId, next);
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
      const ids = storyIdsRef.current;
      ids.forEach(sid => {
        next[sid] = (prev[sid] || []).filter(id => id !== linkId);
      });
      taskOrderService.saveProjectOrder(projectId, next);
      return next;
    });
  };

  // Initialize Swapy.
  useEffect(() => {
    if (!containerRef.current) return;

    const swapy = createSwapy(containerRef.current, {
      animation: 'dynamic',
      enabled: true,
      swapMode: 'drop',
      dragAxis: 'both',
      manualSwap: true,
      autoScrollOnDrag: true,
    });

    swapyRef.current = swapy;

    swapy.onSwapEnd((event) => {
      if (!event.hasChanged) return;
      const next = event.slotItemMap.asArray;
      // Swapy can temporarily move placeholder items across stories; normalize by rebuilding
      // a canonical mapping from the resulting order and re-inserting story-specific empties.
      void normalizeAndPersist(next);
      // The board will re-render based on updated tasksByStory.
    });

    return () => {
      swapy.destroy();
      swapyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // When DOM changes (slots count), refresh swapy.
  useEffect(() => {
    swapyRef.current?.update();
  }, [canonicalSlotItemMap]);

  return (
    <div ref={containerRef} className="space-y-6">
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
              <Tag color="blue" className="m-0 text-[10px] font-black uppercase">
                {t('storymap.role')}
              </Tag>
              <UserOutlined style={{ color: qaPalette.primary }} />
              <span className="font-black text-slate-800 truncate" title={role.name}>
                {role.name}
              </span>
              <Tooltip title={t('common.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  className="shrink-0 text-slate-500"
                  onClick={() => onEditRole(role.id, role.name)}
                />
              </Tooltip>
            </div>
          }
          extra={
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => onCreateEpic(role.id)}
              className="rounded-lg"
            >
              {t('storymap.new_epic')}
            </Button>
          }
        >
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
                    <Tooltip title={t('common.edit')}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        className="shrink-0 text-slate-500"
                        onClick={() => onEditEpic(epic.id, epic.name)}
                      />
                    </Tooltip>
                  </div>
                }
                extra={
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => onCreateStory(epic.id)}
                    className="rounded-lg"
                  >
                    {t('storymap.new_story')}
                  </Button>
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
                          slots={slotsByStory[story.id] || [{ slotId: `${story.id}::0`, itemId: emptyId(story.id) }]}
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
                          renderItem={(itemId) => {
                            if (isEmptyItem(itemId)) {
                              return <TaskPlaceholderCard />;
                            }
                            const link = linkById.get(itemId);
                            const f = link ? funcById.get(link.functionalityId) : undefined;
                            return (
                              <TaskCard
                                projectId={projectId}
                                functionality={f}
                                onUnassign={() => handleUnassign(itemId)}
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
        </Card>
      ))}
    </div>
  );
}
