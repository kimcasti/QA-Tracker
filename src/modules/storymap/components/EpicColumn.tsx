import { Button, Card, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Functionality } from '../../../types';
import type { StoryMapEpicNode } from '../types';
import { StoryCard } from './StoryCard';

const { Text } = Typography;

export function EpicColumn({
  epic,
  unassignedFunctionalities,
  onCreateStory,
  onCreateFunctionality,
  onAssignFunctionality,
  onUnassignFunctionality,
}: {
  epic: StoryMapEpicNode;
  unassignedFunctionalities: Functionality[];
  onCreateStory: (epicId: string) => void;
  onCreateFunctionality: (storyId: string) => void;
  onAssignFunctionality: (storyId: string, functionalityId: string) => void;
  onUnassignFunctionality: (functionalityId: string) => void;
}) {
  return (
    <Card
      size="small"
      className="rounded-2xl border-slate-100 shadow-sm"
      title={<span className="font-bold text-slate-800">{epic.name}</span>}
      extra={
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onCreateStory(epic.id)}
          className="rounded-lg"
        >
          Nueva Story
        </Button>
      }
    >
      <div className="space-y-3">
        {epic.stories.length === 0 ? (
          <Text type="secondary" className="text-xs">Sin stories</Text>
        ) : (
          epic.stories.map(story => (
            <StoryCard
              key={story.id}
              story={story}
              unassignedFunctionalities={unassignedFunctionalities}
              onCreateFunctionality={onCreateFunctionality}
              onAssignFunctionality={onAssignFunctionality}
              onUnassignFunctionality={onUnassignFunctionality}
            />
          ))
        )}
      </div>
    </Card>
  );
}
