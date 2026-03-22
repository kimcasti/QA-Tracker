import { Button, Card, Tag, Tooltip, Typography } from 'antd';
import {
  CaretDownOutlined,
  CaretRightOutlined,
  EditOutlined,
  PlusOutlined,
  RocketOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { createSwapy, type SlotItemMapArray, type Swapy } from 'swapy';
import type { SwapEvent } from 'swapy';
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
  onMoveFunctionality,
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
  onMoveFunctionality: (functionalityId: string, storyId: string) => Promise<void>;
  onStructureChange?: () => void;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const swapyRef = useRef<Swapy | null>(null);
  const isDraggingRef = useRef(false);
  const pendingSwapyUpdateRef = useRef(false);
  const latestSwapRef = useRef<SwapEvent | null>(null);

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

  const storyIdsRef = useRef(storyIdsInRenderOrder);
  useEffect(() => {
    storyIdsRef.current = storyIdsInRenderOrder;
  }, [storyIdsInRenderOrder]);

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
      const next = buildNormalizedTaskOrder(storyIdsInRenderOrder, syncedLinks, prev);

      taskOrderService.saveProjectOrder(projectId, next);
      onStructureChange?.();
      return next;
    });
  }, [functionalities, onStructureChange, projectId, storyIdsInRenderOrder]);

  const canonicalSlotItemMap = useMemo<SlotItemMapArray>(() => {
    const map: SlotItemMapArray = [];
    const seenItemIds = new Set<string>();
    for (const storyId of storyIdsInRenderOrder) {
      const tasks = (tasksByStory[storyId] || []).filter(id => {
        if (!linkById.has(id) || seenItemIds.has(id)) {
          return false;
        }

        seenItemIds.add(id);
        return true;
      });
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

  const normalizeAndPersist = async (
    mapArray: SlotItemMapArray,
    explicitMove?: Pick<SwapEvent, 'draggingItem' | 'fromSlot' | 'toSlot'>,
  ) => {
    const nextOrderDraft: Record<string, string[]> = {};
    storyIdsRef.current.forEach(storyId => (nextOrderDraft[storyId] = []));
    const currentLinks = Array.from(linkById.values());
    const movedLinks: Array<{
      linkId: string;
      functionalityId: string;
      fromStoryId: string;
      toStoryId: string;
    }> = [];

    for (const { slot, item } of mapArray) {
      const sid = storyIdFromSlot(slot);
      if (isEmptyItem(item)) continue;
      if (!nextOrderDraft[sid]) nextOrderDraft[sid] = [];
      nextOrderDraft[sid].push(item);
    }

    let nextLinks = currentLinks.map(link => ({ ...link }));

    if (
      explicitMove &&
      !isEmptyItem(explicitMove.draggingItem) &&
      explicitMove.fromSlot !== explicitMove.toSlot
    ) {
      const link = currentLinks.find(item => item.id === explicitMove.draggingItem);
      const fromStoryId = storyIdFromSlot(explicitMove.fromSlot);
      const toStoryId = storyIdFromSlot(explicitMove.toSlot);

      if (link && fromStoryId !== toStoryId) {
        movedLinks.push({
          linkId: link.id,
          functionalityId: link.functionalityId,
          fromStoryId,
          toStoryId,
        });
        nextLinks = storyAssociationsService.moveAssociation(projectId, link.id, toStoryId);
      }
    } else {
      const nextStoryByLinkId = new Map<string, string>();

      mapArray.forEach(({ slot, item }) => {
        if (!isEmptyItem(item)) {
          nextStoryByLinkId.set(item, storyIdFromSlot(slot));
        }
      });

      currentLinks.forEach(link => {
        const nextStoryId = nextStoryByLinkId.get(link.id);
        if (!nextStoryId || nextStoryId === link.storyId) {
          return;
        }

        const currentLinkExists = nextLinks.some(item => item.id === link.id);
        if (!currentLinkExists) {
          return;
        }

        movedLinks.push({
          linkId: link.id,
          functionalityId: link.functionalityId,
          fromStoryId: link.storyId,
          toStoryId: nextStoryId,
        });

        nextLinks = nextLinks
          .map(item => (item.id === link.id ? { ...item, storyId: nextStoryId } : item))
          .filter((item, index, all) => {
            if (item.storyId !== nextStoryId || item.functionalityId !== link.functionalityId) {
              return true;
            }

            return (
              index ===
              all.findIndex(
                candidate =>
                  candidate.storyId === nextStoryId &&
                  candidate.functionalityId === link.functionalityId &&
                  candidate.id === link.id,
              )
            );
          });
      });
    }

    storyAssociationsService.saveProjectLinks(projectId, nextLinks);

    const nextOrder = buildNormalizedTaskOrder(
      storyIdsRef.current,
      nextLinks,
      nextOrderDraft,
    );

    movedLinks.forEach(move => {
      storyIdsRef.current.forEach(storyId => {
        nextOrder[storyId] = (nextOrder[storyId] || []).filter(itemId => itemId !== move.linkId);
      });

      if (!nextOrder[move.toStoryId]) {
        nextOrder[move.toStoryId] = [];
      }

      if (
        nextLinks.some(item => item.id === move.linkId) &&
        !nextOrder[move.toStoryId].includes(move.linkId)
      ) {
        nextOrder[move.toStoryId] = [...nextOrder[move.toStoryId], move.linkId];
      }
    });

    setTasksByStory(nextOrder);
    taskOrderService.saveProjectOrder(projectId, nextOrder);
    setLinks(nextLinks);
    storyAssociationsService.saveProjectLinks(projectId, nextLinks);
    onStructureChange?.();

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

  const flushSwapyUpdate = () => {
    if (isDraggingRef.current) {
      pendingSwapyUpdateRef.current = true;
      return;
    }

    pendingSwapyUpdateRef.current = false;
    swapyRef.current?.update();
  };

  const handleAssignExisting = (storyId: string, functionalityId: string) => {
    const link = storyAssociationsService.ensureAssociation(projectId, storyId, functionalityId);
    const nextLinks = storyAssociationsService.getProjectLinks(projectId);
    setLinks(nextLinks);
    onEnsurePrimaryAssociation(storyId, functionalityId);

    setTasksByStory(prev => {
      const next = buildNormalizedTaskOrder(storyIdsRef.current, nextLinks, {
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
      const ids = storyIdsRef.current;
      ids.forEach(sid => {
        next[sid] = (prev[sid] || []).filter(id => id !== linkId);
      });
      taskOrderService.saveProjectOrder(projectId, next);
      onStructureChange?.();
      return next;
    });
  };

  // Initialize Swapy.
  useEffect(() => {
    if (!containerRef.current) return;

    const swapy = createSwapy(containerRef.current, {
      animation: 'dynamic',
      enabled: !readOnly,
      swapMode: 'drop',
      dragAxis: 'both',
      manualSwap: true,
      autoScrollOnDrag: true,
    });

    swapyRef.current = swapy;

    swapy.onSwapStart(() => {
      isDraggingRef.current = true;
      latestSwapRef.current = null;
    });

    swapy.onSwap((event) => {
      latestSwapRef.current = event;
    });

    swapy.onSwapEnd((event) => {
      isDraggingRef.current = false;
      if (pendingSwapyUpdateRef.current) {
        requestAnimationFrame(() => {
          flushSwapyUpdate();
        });
      }
      if (!event.hasChanged) return;
      const next = event.slotItemMap.asArray;
      const explicitMove = latestSwapRef.current
        ? {
            draggingItem: latestSwapRef.current.draggingItem,
            fromSlot: latestSwapRef.current.fromSlot,
            toSlot: latestSwapRef.current.toSlot,
          }
        : undefined;
      latestSwapRef.current = null;
      // Swapy fires onSwapEnd before it finishes its own DOM cleanup animation.
      // Defer React persistence by two animation frames so the library can settle
      // before we re-render the board and refresh slot/item bindings.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void normalizeAndPersist(next, explicitMove);
        });
      });
    });

    return () => {
      isDraggingRef.current = false;
      pendingSwapyUpdateRef.current = false;
      latestSwapRef.current = null;
      swapy.destroy();
      swapyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, readOnly]);

  // When DOM changes (slots count), refresh swapy.
  useEffect(() => {
    flushSwapyUpdate();
  }, [canonicalSlotItemMap]);

  useEffect(() => {
    flushSwapyUpdate();
  }, [collapsedRoles]);

  const toggleRoleCollapsed = (roleId: string) => {
    setCollapsedRoles(prev => ({
      ...prev,
      [roleId]: !prev[roleId],
    }));
  };

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
                            readOnly={readOnly}
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
