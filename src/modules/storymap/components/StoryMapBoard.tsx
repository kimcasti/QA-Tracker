import { Button, Card, Tag, Typography } from 'antd';
import { PlusOutlined, RocketOutlined, UserOutlined } from '@ant-design/icons';
import { createSwapy, type SlotItemMapArray, type Swapy } from 'swapy';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Functionality } from '../../../types';
import { qaPalette, softSurface } from '../../../theme/palette';
import type { StoryMapRoleNode } from '../types';
import { taskOrderService } from '../services/taskOrderService';
import { StoryColumn } from './StoryColumn';
import { TaskCard } from './TaskCard';

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
  unassignedFunctionalities,
  onCreateEpic,
  onCreateStory,
  onCreateFunctionality,
  onAssignExisting,
  onUnassignFunctionality,
  onSaveFunctionality,
}: {
  projectId: string;
  roles: StoryMapRoleNode[];
  functionalities: Functionality[];
  unassignedFunctionalities: Functionality[];
  onCreateEpic: (roleId: string) => void;
  onCreateStory: (epicId: string) => void;
  onCreateFunctionality: (storyId: string) => void;
  onAssignExisting: (storyId: string, functionalityId: string) => void;
  onUnassignFunctionality: (functionalityId: string) => void;
  onSaveFunctionality: (func: Functionality) => void;
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

  const storyIdsRef = useRef(storyIdsInRenderOrder);
  useEffect(() => {
    storyIdsRef.current = storyIdsInRenderOrder;
  }, [storyIdsInRenderOrder]);

  const funcById = useMemo(() => {
    const m = new Map<string, Functionality>();
    for (const f of functionalities) m.set(f.id, f);
    return m;
  }, [functionalities]);

  const funcByIdRef = useRef(funcById);
  const onSaveRef = useRef(onSaveFunctionality);

  useEffect(() => {
    funcByIdRef.current = funcById;
  }, [funcById]);

  useEffect(() => {
    onSaveRef.current = onSaveFunctionality;
  }, [onSaveFunctionality]);

  // Keep board-local ordering as the visual source of truth. When new functionalities
  // appear (create/associate), append them to their story if not present.
  useEffect(() => {
    setTasksByStory(prev => {
      const next: Record<string, string[]> = { ...prev };

      const existingFuncIds = new Set(functionalities.map(f => f.id));

      // Remove ids that no longer exist.
      Object.keys(next).forEach(storyId => {
        next[storyId] = (next[storyId] || []).filter(id => existingFuncIds.has(id));
      });

      // Ensure every rendered story has a list.
      storyIdsInRenderOrder.forEach(storyId => {
        if (!next[storyId]) next[storyId] = [];
      });

      // Track what's already placed on the board.
      const placed = new Set<string>();
      storyIdsInRenderOrder.forEach(storyId => {
        next[storyId].forEach(id => placed.add(id));
      });

      // Add missing assigned functionalities.
      functionalities.forEach(f => {
        if (!f.storyId) return;
        if (!next[f.storyId]) return;
        if (placed.has(f.id)) return;
        next[f.storyId].push(f.id);
        placed.add(f.id);
      });

      return next;
    });
  }, [functionalities, storyIdsInRenderOrder]);

  const canonicalSlotItemMap = useMemo<SlotItemMapArray>(() => {
    const map: SlotItemMapArray = [];
    for (const storyId of storyIdsInRenderOrder) {
      const tasks = (tasksByStory[storyId] || []).filter(id => funcByIdRef.current.has(id));
      const items = [...tasks, emptyId(storyId)];
      items.forEach((itemId, idx) => map.push({ slot: `${storyId}::${idx}`, item: itemId }));
    }
    return map;
  }, [storyIdsInRenderOrder, tasksByStory]);

  const slotsByStory = useMemo(() => {
    const grouped: Record<string, Array<{ slotId: string; itemId: string }>> = {};
    for (const entry of canonicalSlotItemMap) {
      const sid = storyIdFromSlot(entry.slot);
      if (!grouped[sid]) grouped[sid] = [];
      grouped[sid].push({ slotId: entry.slot, itemId: entry.item });
    }
    return grouped;
  }, [canonicalSlotItemMap]);

  const normalizeAndPersist = (mapArray: SlotItemMapArray) => {
    // Build new order per story (ignore empties), for all rendered stories.
    const nextOrder: Record<string, string[]> = {};
    storyIdsRef.current.forEach(storyId => (nextOrder[storyId] = []));
    const nextStoryByFuncId = new Map<string, string>();

    for (const { slot, item } of mapArray) {
      const sid = storyIdFromSlot(slot);
      if (isEmptyItem(item)) continue;
      if (!nextOrder[sid]) nextOrder[sid] = [];
      nextOrder[sid].push(item);
      nextStoryByFuncId.set(item, sid);
    }

    // Persist order.
    setTasksByStory(nextOrder);
    taskOrderService.saveProjectOrder(projectId, nextOrder);

    // Update storyId only when item moved to a different story.
    nextStoryByFuncId.forEach((newStoryId, funcId) => {
      const current = funcByIdRef.current.get(funcId);
      if (!current) return;
      if (current.storyId !== newStoryId) {
        onSaveRef.current({ ...current, storyId: newStoryId });
      }
    });
  };

  const handleAssignExisting = (storyId: string, functionalityId: string) => {
    onAssignExisting(storyId, functionalityId);
    setTasksByStory(prev => {
      const next: Record<string, string[]> = {};
      const ids = storyIdsRef.current;
      ids.forEach(sid => {
        next[sid] = (prev[sid] || []).filter(id => id !== functionalityId);
      });
      if (!next[storyId]) next[storyId] = [];
      next[storyId] = [...next[storyId], functionalityId];
      taskOrderService.saveProjectOrder(projectId, next);
      return next;
    });
  };

  const handleUnassign = (functionalityId: string) => {
    onUnassignFunctionality(functionalityId);
    setTasksByStory(prev => {
      const next: Record<string, string[]> = {};
      const ids = storyIdsRef.current;
      ids.forEach(sid => {
        next[sid] = (prev[sid] || []).filter(id => id !== functionalityId);
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
      normalizeAndPersist(next);
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
          bordered={false}
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
                bordered={false}
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
                          unassignedFunctionalities={unassignedFunctionalities}
                          onCreateFunctionality={onCreateFunctionality}
                          onAssignExisting={handleAssignExisting}
                          renderItem={(itemId) => {
                            if (isEmptyItem(itemId)) {
                              return <TaskCard isPlaceholder />;
                            }
                            const f = funcById.get(itemId);
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
