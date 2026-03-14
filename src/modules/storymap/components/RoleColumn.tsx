import { Button, Card, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Functionality } from '../../../types';
import type { StoryMapRoleNode } from '../types';
import { EpicColumn } from './EpicColumn';

const { Text } = Typography;

export function RoleColumn({
  role,
  unassignedFunctionalities,
  onCreateEpic,
  onCreateStory,
  onCreateFunctionality,
  onAssignFunctionality,
  onUnassignFunctionality,
}: {
  role: StoryMapRoleNode;
  unassignedFunctionalities: Functionality[];
  onCreateEpic: (roleId: string) => void;
  onCreateStory: (epicId: string) => void;
  onCreateFunctionality: (storyId: string) => void;
  onAssignFunctionality: (storyId: string, functionalityId: string) => void;
  onUnassignFunctionality: (functionalityId: string) => void;
}) {
  return (
    <Card
      className="w-[380px] min-w-[380px] rounded-2xl border-slate-100 shadow-sm"
      title={<span className="font-black text-slate-800">{role.name}</span>}
      extra={
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onCreateEpic(role.id)}
          className="rounded-lg"
        >
          Nuevo Epic
        </Button>
      }
    >
      <div className="space-y-4">
        {role.epics.length === 0 ? (
          <Text type="secondary" className="text-xs">Sin epics</Text>
        ) : (
          role.epics.map(epic => (
            <EpicColumn
              key={epic.id}
              epic={epic}
              unassignedFunctionalities={unassignedFunctionalities}
              onCreateStory={onCreateStory}
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
